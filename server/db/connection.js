const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'recipeshare.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

module.exports = db;
