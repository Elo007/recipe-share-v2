const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Stripe is only initialized if a secret key is actually configured, so the
// rest of the app still runs (and demos fine) before you've set up Stripe.
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// POST /api/payments/checkout/:recipeId - creates a Stripe Checkout session
// for buying a single paid recipe, and returns the URL to redirect to.
router.post('/checkout/:recipeId', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: 'Payments are not configured yet. Add a STRIPE_SECRET_KEY to the server to enable checkout.',
    });
  }

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  if (!recipe.is_paid) return res.status(400).json({ error: 'This recipe is free, no purchase needed.' });
  if (recipe.user_id === req.session.userId) {
    return res.status(400).json({ error: "You can't buy your own recipe." });
  }

  const existing = db
    .prepare('SELECT id FROM purchases WHERE user_id = ? AND recipe_id = ?')
    .get(req.session.userId, recipe.id);
  if (existing) {
    return res.status(400).json({ error: 'You already own this recipe.' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: recipe.title,
              description: recipe.description || undefined,
            },
            unit_amount: recipe.price_cents,
          },
          quantity: 1,
        },
      ],
      // These query params let the success page confirm and unlock access
      // immediately, the webhook below is the durable source of truth.
      success_url: `${frontendUrl}/recipes/${recipe.id}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/recipes/${recipe.id}?purchase=cancelled`,
      metadata: {
        recipeId: String(recipe.id),
        userId: String(req.session.userId),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// GET /api/payments/confirm/:sessionId - called by the success page to
// verify the session actually completed and record the purchase. Using the
// session itself as the source of truth means this is safe to call even if
// a webhook is not configured (which is normal for local/demo setups).
router.get('/confirm/:sessionId', requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payments are not configured.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment has not completed yet.' });
    }

    const recipeId = Number(session.metadata.recipeId);
    const userId = Number(session.metadata.userId);

    if (userId !== req.session.userId) {
      return res.status(403).json({ error: 'This purchase session does not belong to you.' });
    }

    // Idempotent on purpose: re-confirming the same session twice (e.g. a
    // page refresh) should not error, just confirm access is recorded.
    const already = db
      .prepare('SELECT id FROM purchases WHERE stripe_session_id = ?')
      .get(session.id);

    if (!already) {
      db.prepare(`
        INSERT INTO purchases (user_id, recipe_id, stripe_session_id, amount_cents)
        VALUES (?, ?, ?, ?)
      `).run(userId, recipeId, session.id, session.amount_total);
    }

    res.json({ unlocked: true, recipeId });
  } catch (err) {
    console.error('Stripe confirm error:', err.message);
    res.status(500).json({ error: 'Could not confirm payment.' });
  }
});

// GET /api/payments/my-purchases - everything the logged-in user has bought
router.get('/my-purchases', requireAuth, (req, res) => {
  const rows = db
    .prepare(`
      SELECT r.*, u.username as author, p.amount_cents, p.created_at as purchasedAt
      FROM purchases p
      JOIN recipes r ON r.id = p.recipe_id
      JOIN users u ON u.id = r.user_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `)
    .all(req.session.userId);
  res.json(rows);
});

// GET /api/payments/my-sales - creator dashboard: what's sold, how much earned
router.get('/my-sales', requireAuth, (req, res) => {
  const rows = db
    .prepare(`
      SELECT p.*, r.title as recipeTitle, u.username as buyerUsername
      FROM purchases p
      JOIN recipes r ON r.id = p.recipe_id
      JOIN users u ON u.id = p.user_id
      WHERE r.user_id = ?
      ORDER BY p.created_at DESC
    `)
    .all(req.session.userId);

  const totalCents = rows.reduce((sum, r) => sum + r.amount_cents, 0);
  res.json({ sales: rows, totalCents, salesCount: rows.length });
});

module.exports = router;
