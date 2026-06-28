const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/collections - all of the logged-in user's collections, with recipe counts
router.get('/', requireAuth, (req, res) => {
  const collections = db
    .prepare(`
      SELECT c.*, COUNT(cr.id) as recipeCount
      FROM collections c
      LEFT JOIN collection_recipes cr ON cr.collection_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `)
    .all(req.session.userId);
  res.json(collections);
});

router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Collection needs a name.' });
  }
  const result = db
    .prepare('INSERT INTO collections (user_id, name) VALUES (?, ?)')
    .run(req.session.userId, name.trim());
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
});

router.delete('/:id', requireAuth, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });
  if (collection.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'You can only delete your own collections.' });
  }
  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  res.json({ message: 'Collection deleted.' });
});

// GET /api/collections/:id/recipes - recipes inside one collection
router.get('/:id/recipes', requireAuth, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });
  if (collection.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'This is not your collection.' });
  }

  const recipes = db
    .prepare(`
      SELECT r.*, u.username as author, u.avatar_color as authorColor
      FROM collection_recipes cr
      JOIN recipes r ON r.id = cr.recipe_id
      JOIN users u ON u.id = r.user_id
      WHERE cr.collection_id = ?
    `)
    .all(req.params.id);
  res.json({ ...collection, recipes });
});

router.post('/:id/recipes/:recipeId', requireAuth, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found.' });
  if (collection.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'This is not your collection.' });
  }

  try {
    db.prepare('INSERT INTO collection_recipes (collection_id, recipe_id) VALUES (?, ?)').run(
      req.params.id, req.params.recipeId
    );
    res.status(201).json({ message: 'Added to collection.' });
  } catch (err) {
    res.json({ message: 'Already in this collection.' });
  }
});

router.delete('/:id/recipes/:recipeId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?').run(
    req.params.id, req.params.recipeId
  );
  res.json({ message: 'Removed from collection.' });
});

module.exports = router;
