require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const db = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter connection
transporter.verify((error) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('✅ SMTP connection established');
  }
});

// Middleware: Verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.accountId = decoded.accountId;
    req.email = decoded.email;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes

/**
 * GET /api/domains - Get available email domains
 */
app.get('/api/domains', (req, res) => {
  res.json({
    domains: ['temp.mail', 'temp.test', 'test.mail'],
  });
});

/**
 * POST /api/accounts - Create a new temporary email account
 */
app.post('/api/accounts', (req, res) => {
  try {
    const { domain } = req.body || {};
    const selectedDomain = domain || 'temp.mail';
    const username = generateUsername();
    const email = `${username}@${selectedDomain}`;
    const accountId = uuidv4();
    const token = jwt.sign(
      { accountId, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    // Calculate expiry time
    const expiryHours = parseInt(process.env.EMAIL_EXPIRY_HOURS) || 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    // Insert into database
    db.run(
      `INSERT INTO accounts (id, email, token, expires_at) VALUES (?, ?, ?, ?)`,
      [accountId, email, token, expiresAt.toISOString()],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to create account' });
        }

        // Setup temporary SMTP inbox for this email
        setupEmailReceiver(email, accountId);

        res.json({
          success: true,
          accountId,
          email,
          token,
          expiresIn: expiryHours * 60 * 60,
          createdAt: new Date().toISOString(),
        });
      }
    );
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/token - Generate/verify token for existing account
 */
app.post('/api/token', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    db.get(
      `SELECT * FROM accounts WHERE email = ? AND deleted = 0`,
      [email],
      (err, row) => {
        if (err || !row) {
          return res.status(404).json({ error: 'Account not found' });
        }

        // In production, verify password properly
        const token = jwt.sign(
          { accountId: row.id, email: row.email },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRY }
        );

        res.json({
          token,
          email: row.email,
          expiresIn: process.env.JWT_EXPIRY,
        });
      }
    );
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/messages - Fetch messages for authenticated account
 */
app.get('/api/messages', verifyToken, (req, res) => {
  try {
    db.all(
      `SELECT * FROM messages WHERE account_id = ? ORDER BY received_at DESC LIMIT 50`,
      [req.accountId],
      (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to fetch messages' });
        }

        res.json({
          success: true,
          email: req.email,
          messages: rows || [],
          count: (rows || []).length,
        });
      }
    );
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/messages/:id - Get specific message
 */
app.get('/api/messages/:id', verifyToken, (req, res) => {
  try {
    db.get(
      `SELECT * FROM messages WHERE id = ? AND account_id = ?`,
      [req.params.id, req.accountId],
      (err, row) => {
        if (err || !row) {
          return res.status(404).json({ error: 'Message not found' });
        }

        res.json({ success: true, message: row });
      }
    );
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/accounts - Delete account
 */
app.delete('/api/accounts', verifyToken, (req, res) => {
  try {
    db.run(
      `UPDATE accounts SET deleted = 1 WHERE id = ?`,
      [req.accountId],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete account' });
        }

        res.json({
          success: true,
          message: 'Account deleted successfully',
        });
      }
    );
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/messages/:id - Delete specific message
 */
app.delete('/api/messages/:id', verifyToken, (req, res) => {
  try {
    db.run(
      `DELETE FROM messages WHERE id = ? AND account_id = ?`,
      [req.params.id, req.accountId],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to delete message' });
        }

        res.json({ success: true, message: 'Message deleted' });
      }
    );
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/health - Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper Functions

/**
 * Generate random username for email
 */
function generateUsername() {
  const adjectives = ['swift', 'bright', 'calm', 'cool', 'epic', 'fast', 'free', 'glad', 'happy', 'keen', 'lively', 'neat', 'quick', 'silent', 'smooth', 'swift', 'vivid', 'wise'];
  const nouns = ['bird', 'cat', 'dog', 'fox', 'lion', 'panda', 'tiger', 'wolf', 'bear', 'eagle', 'shark', 'snake', 'whale'];
  const number = Math.floor(Math.random() * 1000);

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj}${noun}${number}`;
}

/**
 * Setup email receiver for the generated email
 * In production, you would use a proper webhook or SMTP relay
 */
function setupEmailReceiver(email, accountId) {
  // This is a placeholder for actual email receiving setup
  // In production, use:
  // - Mailgun webhooks
  // - SendGrid inbound parse
  // - Custom SMTP server
  // - Email forwarding service
  console.log(`📧 Email receiver setup for ${email}`);
}

/**
 * Cleanup expired accounts (run periodically)
 */
function cleanupExpiredAccounts() {
  db.run(
    `DELETE FROM messages WHERE account_id IN (SELECT id FROM accounts WHERE expires_at < CURRENT_TIMESTAMP AND deleted = 1)`,
    (err) => {
      if (err) console.error('Cleanup error:', err);
    }
  );

  db.run(
    `DELETE FROM accounts WHERE expires_at < CURRENT_TIMESTAMP AND deleted = 1`,
    (err) => {
      if (err) console.error('Cleanup error:', err);
      else console.log('🧹 Cleanup completed');
    }
  );
}

// Run cleanup every hour
setInterval(cleanupExpiredAccounts, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Temp Mail Backend is ready`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});
