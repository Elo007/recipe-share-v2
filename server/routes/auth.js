const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');

const router = express.Router();

// A small rotating palette so each new signup gets a distinct avatar color
// without the user having to pick one.
const AVATAR_COLORS = ['#E8590C', '#2F9E44', '#C2255C', '#1971C2', '#F08C00', '#7048E8'];

router.post('/signup', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are all required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'That username or email is already taken.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)')
    .run(username, email, passwordHash, avatarColor);

  req.session.userId = Number(result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, username, email, avatarColor });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username, email: user.email, bio: user.bio, avatarColor: user.avatar_color });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = db
    .prepare('SELECT id, username, email, bio, avatar_color as avatarColor FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  res.json(user);
});

module.exports = router;
