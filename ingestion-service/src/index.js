require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;
const QUEUE_KEY = 'transactions:raw';

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error', err));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ingestion-service' }));

// Real Plaid webhooks arrive here. In sandbox, Plaid sends a notification
// like { webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE' },
// then you separately call Plaid's /transactions/sync to fetch the actual data.
// For now this stub pushes a mock transaction so we can test the queue hand-off.
app.post('/webhook/plaid', async (req, res) => {
  const event = req.body;
  console.log('Received Plaid webhook:', event.webhook_type, event.webhook_code);

  const mockTransaction = {
    id: `txn_${Date.now()}`,
    item_id: event.item_id || 'sandbox-item',
    amount: 42.5,
    merchant_name: 'Sandbox Coffee Co',
    date: new Date().toISOString().slice(0, 10),
  };

  await redisClient.lPush(QUEUE_KEY, JSON.stringify(mockTransaction));
  res.status(200).json({ received: true, queued: mockTransaction.id });
});

// Lets us push a transaction manually for testing, without needing a real webhook yet
app.post('/dev/simulate', async (req, res) => {
  const txn = { id: `txn_${Date.now()}`, ...req.body };
  await redisClient.lPush(QUEUE_KEY, JSON.stringify(txn));
  res.json({ queued: txn });
});

redisClient
  .connect()
  .then(() => app.listen(PORT, () => console.log(`ingestion-service listening on ${PORT}`)))
  .catch((err) => {
    console.error('failed to connect to redis', err);
    process.exit(1);
  });