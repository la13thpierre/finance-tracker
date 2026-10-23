require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 4003;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'reporting-service' }));

app.get('/transactions', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`txn_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`txn_date <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT id, merchant_name, amount, category, txn_date FROM transactions ${where} ORDER BY txn_date DESC LIMIT 100`,
    params
  );
  res.json(result.rows);
});

app.get('/spend-by-category', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const conditions = [];
  const params = [];
  if (from) { params.push(from); conditions.push(`txn_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`txn_date <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT category, SUM(amount) AS total FROM transactions ${where} GROUP BY category ORDER BY total DESC`,
    params
  );
  res.json(result.rows);
});

app.get('/balance', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total_spent FROM transactions');
res.json({ balance: Number(result.rows[0].total_spent) });
});
pool.query('CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, monthly_limit NUMERIC NOT NULL)');

app.get('/budgets', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT b.category, b.monthly_limit, COALESCE(SUM(t.amount), 0) AS spent
     FROM budgets b
     LEFT JOIN transactions t
       ON t.category = b.category AND t.txn_date >= date_trunc('month', CURRENT_DATE)
     GROUP BY b.category, b.monthly_limit
     ORDER BY b.category`
  );
  res.json(result.rows.map(r => ({
    category: r.category,
    limit: Number(r.monthly_limit),
    spent: Number(r.spent)
  })));
});

app.put('/budgets/:category', requireAuth, async (req, res) => {
  const limit = Number(req.body.monthly_limit);
  if (!(limit > 0)) return res.status(400).json({ error: 'monthly_limit must be a positive number' });
  await pool.query(
    `INSERT INTO budgets (category, monthly_limit) VALUES ($1, $2)
     ON CONFLICT (category) DO UPDATE SET monthly_limit = $2`,
    [req.params.category, limit]
  );
  res.json({ ok: true });
});

app.listen(PORT, () => console.log('reporting-service listening on ' + PORT));

