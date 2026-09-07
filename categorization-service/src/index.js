require('dotenv').config();
const http = require('http');
const { Pool } = require('pg');
const { createClient } = require('redis');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const QUEUE_KEY = 'transactions:raw';
const PORT = process.env.PORT || 4004;

// Simple rule-based categorization — placeholder for something smarter later.
const RULES = [
  { match: /coffee|cafe|starbucks/i, category: 'Food & Drink' },
  { match: /uber|lyft|transit|train/i, category: 'Transport' },
  { match: /netflix|spotify|disney/i, category: 'Entertainment' },
  { match: /rent|mortgage/i, category: 'Housing' },
];

function categorize(merchantName) {
  const rule = RULES.find((r) => r.match.test(merchantName));
  return rule ? rule.category : 'Uncategorized';
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      merchant_name TEXT,
      amount NUMERIC NOT NULL,
      category TEXT NOT NULL,
      txn_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function processQueue(redisClient) {
  console.log('categorization-service: waiting for transactions...');
  while (true) {
    // Blocking pop — waits here until a transaction arrives, no polling loop
    const result = await redisClient.brPop(QUEUE_KEY, 0);
    const txn = JSON.parse(result.element);
    const category = categorize(txn.merchant_name || '');

    try {
      await pool.query(
        `INSERT INTO transactions (id, item_id, merchant_name, amount, category, txn_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [txn.id, txn.item_id, txn.merchant_name, txn.amount, category, txn.date]
      );
      console.log(`categorized ${txn.id} -> ${category}`);
    } catch (err) {
      console.error('failed to save transaction', err);
    }
  }
}

// Minimal health endpoint — this service is mostly a background worker,
// but having /health lets it get a proper check later when it's containerized.
http
  .createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'categorization-service' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(PORT, () => console.log(`categorization-service health check on ${PORT}`));

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error', err));

ensureSchema()
  .then(() => redisClient.connect())
  .then(() => processQueue(redisClient))
  .catch((err) => {
    console.error('categorization-service failed to start', err);
    process.exit(1);
  });
