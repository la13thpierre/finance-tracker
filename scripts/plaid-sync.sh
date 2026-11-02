#!/usr/bin/env bash
pkill -f "port-forward svc/redis-service" || true
pkill -f "node src/index.js" || true
kubectl port-forward svc/redis-service 6379:6379 >/dev/null 2>&1 &
sleep 3
(cd ingestion-service && REDIS_URL=redis://localhost:6379 PORT=4002 node src/index.js >/tmp/ingestion.log 2>&1 &)
sleep 5
ID=$(curl -s -X POST localhost:4002/dev/plaid-sandbox-connect | sed 's/.*"item_id":"\([^"]*\)".*/\1/')
echo "item: $ID"
sleep 20
curl -s -X POST localhost:4002/sync/$ID
echo