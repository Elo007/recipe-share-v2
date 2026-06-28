const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:recipeId', requireAuth, (req, res) => {
  const { rating, comment } = req.body;
  const recipeId = req.params.recipeId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  const recipe = db.prepare('SELECT id, user_id FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  if (recipe.user_id === req.session.userId) {
    return res.status(400).json({ error: "You can't review your own recipe." });
  }

  const existing = db
    .prepare('SELECT id FROM reviews WHERE user_id = ? AND recipe_id = ?')
    .get(req.session.userId, recipeId);

  if (existing) {
    db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ?').run(
      rating, comment || '', existing.id
    );
  } else {
    db.prepare('INSERT INTO reviews (user_id, recipe_id, rating, comment) VALUES (?, ?, ?, ?)').run(
      req.session.userId, recipeId, rating, comment || ''
    );
  }

  res.status(201).json({ message: 'Review saved.' });
});

router.delete('/:recipeId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE user_id = ? AND recipe_id = ?').run(
    req.session.userId,
    req.params.recipeId
  );
  res.json({ message: 'Review removed.' });
});

module.exports = router;
