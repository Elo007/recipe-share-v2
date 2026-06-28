const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function getRatingStats(recipeId) {
  const row = db
    .prepare('SELECT AVG(rating) as avgRating, COUNT(*) as reviewCount FROM reviews WHERE recipe_id = ?')
    .get(recipeId);
  return {
    avgRating: row.avgRating ? Math.round(row.avgRating * 10) / 10 : null,
    reviewCount: row.reviewCount,
  };
}

// Whether a given user has unlocked a paid recipe (owns it, bought it, or
// it's simply free, in which case everyone "has access").
function hasAccess(recipe, userId) {
  if (!recipe.is_paid) return true;
  if (userId && recipe.user_id === userId) return true;
  if (!userId) return false;
  const purchase = db
    .prepare('SELECT id FROM purchases WHERE user_id = ? AND recipe_id = ?')
    .get(userId, recipe.id);
  return !!purchase;
}

// GET /api/recipes - browse with search, category, cuisine, ingredient, and free/paid filters
router.get('/', (req, res) => {
  const { search, category, cuisine, ingredient, pricing } = req.query;

  let query = `
    SELECT DISTINCT r.*, u.username as author, u.avatar_color as authorColor
    FROM recipes r
    JOIN users u ON u.id = r.user_id
  `;
  const conditions = [];
  const params = [];

  if (ingredient) {
    query += ' JOIN ingredients i ON i.recipe_id = r.id';
    conditions.push('i.name LIKE ?');
    params.push(`%${ingredient}%`);
  }
  if (search) {
    conditions.push('(r.title LIKE ? OR r.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    conditions.push('r.category = ?');
    params.push(category);
  }
  if (cuisine) {
    conditions.push('r.cuisine = ?');
    params.push(cuisine);
  }
  if (pricing === 'free') {
    conditions.push('r.is_paid = 0');
  } else if (pricing === 'paid') {
    conditions.push('r.is_paid = 1');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY r.created_at DESC';

  const recipes = db.prepare(query).all(...params);
  const userId = req.session.userId || null;
  const withStats = recipes.map((r) => ({
    ...r,
    ...getRatingStats(r.id),
    unlocked: hasAccess(r, userId),
  }));
  res.json(withStats);
});

router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM recipes ORDER BY category').all();
  res.json(rows.map((r) => r.category));
});

router.get('/cuisines', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT cuisine FROM recipes WHERE cuisine != '' ORDER BY cuisine").all();
  res.json(rows.map((r) => r.cuisine));
});

router.get('/random', (req, res) => {
  const recipe = db
    .prepare(`
      SELECT r.*, u.username as author, u.avatar_color as authorColor FROM recipes r
      JOIN users u ON u.id = r.user_id
      ORDER BY RANDOM() LIMIT 1
    `)
    .get();
  if (!recipe) return res.status(404).json({ error: 'No recipes exist yet.' });
  res.json({ ...recipe, ...getRatingStats(recipe.id) });
});

// GET /api/recipes/:id - full detail. Paid recipes show a teaser only
// (everything except ingredients/steps) unless the requester has access.
router.get('/:id', (req, res) => {
  const recipe = db
    .prepare(`
      SELECT r.*, u.username as author, u.avatar_color as authorColor FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `)
    .get(req.params.id);

  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });

  const userId = req.session.userId || null;
  const unlocked = hasAccess(recipe, userId);

  const reviews = db
    .prepare(`
      SELECT rv.*, u.username, u.avatar_color as authorColor FROM reviews rv
      JOIN users u ON u.id = rv.user_id
      WHERE rv.recipe_id = ?
      ORDER BY rv.created_at DESC
    `)
    .all(req.params.id);

  const comments = db
    .prepare(`
      SELECT c.*, u.username, u.avatar_color as authorColor FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.recipe_id = ?
      ORDER BY c.created_at ASC
    `)
    .all(req.params.id);

  const base = { ...recipe, ...getRatingStats(recipe.id), unlocked, reviews, comments };

  if (!unlocked) {
    // Teaser only: no ingredients or steps for locked paid recipes.
    return res.json({ ...base, ingredients: [], steps: [] });
  }

  const ingredients = db
    .prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY sort_order')
    .all(req.params.id);
  const steps = db
    .prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY step_number')
    .all(req.params.id);

  res.json({ ...base, ingredients, steps });
});

router.post('/', requireAuth, (req, res) => {
  const {
    title, description, category, cuisine, cookTimeMinutes, servings, difficulty,
    imageUrl, isPaid, priceCents, calories, proteinG, carbsG, fatG, ingredients, steps,
  } = req.body;

  if (!title || !category || !cookTimeMinutes || !ingredients?.length || !steps?.length) {
    return res.status(400).json({
      error: 'Title, category, cook time, at least one ingredient and one step are required.',
    });
  }
  if (isPaid && (!priceCents || priceCents < 50)) {
    return res.status(400).json({ error: 'Paid recipes need a price of at least $0.50.' });
  }

  const result = db
    .prepare(`
      INSERT INTO recipes (
        user_id, title, description, category, cuisine, cook_time_minutes, servings,
        difficulty, image_url, is_paid, price_cents, calories, protein_g, carbs_g, fat_g
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.session.userId, title, description || '', category, cuisine || '', cookTimeMinutes,
      servings || 4, difficulty || 'Easy', imageUrl || '', isPaid ? 1 : 0, isPaid ? priceCents : 0,
      calories || null, proteinG || null, carbsG || null, fatG || null
    );

  const recipeId = result.lastInsertRowid;

  const insertIngredient = db.prepare(
    'INSERT INTO ingredients (recipe_id, name, amount, sort_order) VALUES (?, ?, ?, ?)'
  );
  ingredients.forEach((ing, idx) => insertIngredient.run(recipeId, ing.name, ing.amount || '', idx));

  const insertStep = db.prepare('INSERT INTO steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)');
  steps.forEach((instruction, idx) => insertStep.run(recipeId, idx + 1, instruction));

  res.status(201).json({ id: recipeId });
});

router.put('/:id', requireAuth, (req, res) => {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  if (recipe.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'You can only edit your own recipes.' });
  }

  const {
    title, description, category, cuisine, cookTimeMinutes, servings, difficulty,
    imageUrl, isPaid, priceCents, calories, proteinG, carbsG, fatG, ingredients, steps,
  } = req.body;

  if (isPaid && (!priceCents || priceCents < 50)) {
    return res.status(400).json({ error: 'Paid recipes need a price of at least $0.50.' });
  }

  db.prepare(`
    UPDATE recipes SET title = ?, description = ?, category = ?, cuisine = ?, cook_time_minutes = ?,
      servings = ?, difficulty = ?, image_url = ?, is_paid = ?, price_cents = ?,
      calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?
    WHERE id = ?
  `).run(
    title, description || '', category, cuisine || '', cookTimeMinutes, servings || 4,
    difficulty || 'Easy', imageUrl || '', isPaid ? 1 : 0, isPaid ? priceCents : 0,
    calories || null, proteinG || null, carbsG || null, fatG || null, req.params.id
  );

  db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').run(req.params.id);
  db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(req.params.id);

  const insertIngredient = db.prepare(
    'INSERT INTO ingredients (recipe_id, name, amount, sort_order) VALUES (?, ?, ?, ?)'
  );
  (ingredients || []).forEach((ing, idx) => insertIngredient.run(req.params.id, ing.name, ing.amount || '', idx));

  const insertStep = db.prepare('INSERT INTO steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)');
  (steps || []).forEach((instruction, idx) => insertStep.run(req.params.id, idx + 1, instruction));

  res.json({ message: 'Recipe updated.' });
});

router.delete('/:id', requireAuth, (req, res) => {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  if (recipe.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'You can only delete your own recipes.' });
  }

  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Recipe deleted.' });
});

// GET /api/recipes/:id/related - same category, excluding itself, for the "related recipes" section
router.get('/:id/related', (req, res) => {
  const recipe = db.prepare('SELECT category FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });

  const related = db
    .prepare(`
      SELECT r.*, u.username as author, u.avatar_color as authorColor FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.category = ? AND r.id != ?
      ORDER BY RANDOM() LIMIT 4
    `)
    .all(recipe.category, req.params.id);

  const withStats = related.map((r) => ({ ...r, ...getRatingStats(r.id) }));
  res.json(withStats);
});

// POST /api/recipes/:id/comments - add a top-level comment or a reply
router.post('/:id/comments', requireAuth, (req, res) => {
  const { body, parentId } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment cannot be empty.' });
  }
  const recipe = db.prepare('SELECT id FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });

  const result = db
    .prepare('INSERT INTO comments (recipe_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.session.userId, parentId || null, body.trim());

  res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;
