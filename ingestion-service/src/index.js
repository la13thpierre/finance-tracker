require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4002;
const QUEUE_KEY = 'transactions:raw';

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error', err));

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ingestion-service' }));

// Real Plaid webhooks land here in production.
app.post('/webhook/plaid', async (req, res) => {
  const event = req.body;
  console.log('Received Plaid webhook:', event.webhook_type, event.webhook_code);
  res.status(200).json({ received: true });
});

// Simulates a user linking a fake sandbox bank account (skips the Plaid Link UI for now).
// Returns an item_id you'll use to sync transactions from that fake account.
app.post('/dev/plaid-sandbox-connect', async (req, res) => {
  try {
    const sandboxResponse = await plaidClient.sandboxPublicTokenCreate({
      institution_id: 'ins_109508', // Plaid's "First Platypus Bank" test institution
      initial_products: ['transactions'],
    });
    const publicToken = sandboxResponse.data.public_token;

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Store the access token so /sync can use it later. Redis is fine for now;
    // in production this belongs in a proper database tied to a real user.
    await redisClient.set(`plaid:access_token:${itemId}`, accessToken);

    res.json({ item_id: itemId, message: 'Sandbox bank connected' });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'failed to connect sandbox bank' });
  }
});

// Pulls real (sandbox) transactions for a connected item and pushes them onto the queue.
app.post('/sync/:itemId', async (req, res) => {
  try {
    const accessToken = await redisClient.get(`plaid:access_token:${req.params.itemId}`);
    if (!accessToken) return res.status(404).json({ error: 'unknown item_id' });

    const syncResponse = await plaidClient.transactionsSync({ access_token: accessToken });
    const added = syncResponse.data.added;

    for (const txn of added) {
      const transaction = {
        id: txn.transaction_id,
        item_id: req.params.itemId,
        amount: txn.amount,
        merchant_name: txn.merchant_name || txn.name,
        date: txn.date,
      };
      await redisClient.lPush(QUEUE_KEY, JSON.stringify(transaction));
    }

    res.json({ synced: added.length, transactions: added.length });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'failed to sync transactions' });
  }
});

redisClient
  .connect()
  .then(() => app.listen(PORT, () => console.log(`ingestion-service listening on ${PORT}`)))
  .catch((err) => {
    console.error('failed to connect to redis', err);
    process.exit(1);
  });