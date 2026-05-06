const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../temp_mail.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
  // Accounts table
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      deleted BOOLEAN DEFAULT 0
    )
  `);

  // Messages table
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT,
      text TEXT,
      html TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_token ON accounts(token)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at)`);
});

module.exports = db;
