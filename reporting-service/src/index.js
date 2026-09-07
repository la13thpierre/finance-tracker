require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 4003;

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'reporting-service' }));

app.get('/transactions', async (req, res) => {
  const result = await pool.query('SELECT id, merchant_name, amount, category, txn_date FROM transactions ORDER BY txn_date DESC LIMIT 100');
  res.json(result.rows);
});

app.get('/spend-by-category', async (req, res) => {
  const result = await pool.query('SELECT category, SUM(amount) AS total FROM transactions GROUP BY category ORDER BY total DESC');
  res.json(result.rows);
});

app.get('/balance', async (req, res) => {
  const result = await pool.query('SELECT COALESCE(SUM(amount), 0) AS total_spent FROM transactions');
  res.json({ total_spent: Number(result.rows[0].total_spent) });
});

app.listen(PORT, () => console.log('reporting-service listening on ' + PORT));
