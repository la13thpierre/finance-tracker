# Personal Finance Tracker — DevOps Portfolio Project

A microservices-based personal finance tracker built to demonstrate containerization, service orchestration, and real-world infrastructure troubleshooting. Connects to Plaid's **sandbox** API (fake bank data only — no real bank accounts or money involved).

## Architecture

Five services + two data stores, orchestrated with Docker Compose:

- **auth-service** — user registration/login (port 4001)
- **ingestion-service** — connects to Plaid sandbox, syncs transactions into Redis (port 4002)
- **categorization-service** — consumes Redis queue, categorizes and persists transactions to Postgres (port 4004)
- **reporting-service** — reads Postgres, serves spending summaries (port 4003)
- **frontend** — dashboard UI (port 4000)
- **Redis** — transaction sync queue
- **Postgres** — persistent transaction storage

## Tech Stack

Node.js, Express, Redis, PostgreSQL, Docker Compose, Plaid API (sandbox)

## Running Locally / in Codespaces

```bash
docker compose up -d
```



You'll need a `.env` file in `ingestion-service/` with your own Plaid sandbox credentials (get these free from the [Plaid Dashboard](https://dashboard.plaid.com/)):

Then walk through the flow:
```bash
curl -X POST localhost:4002/dev/plaid-sandbox-connect      # returns an item_id
curl -X POST localhost:4002/sync/<item_id>                  # syncs sandbox transactions
curl localhost:4003/balance                                  # check aggregated spending
```

## Known Issues / Workarounds

**Container-to-container networking in GitHub Codespaces:** ingestion-service, reporting-service, and categorization-service intermittently failed to resolve/connect to Redis and Postgres over Docker's default bridge network — confirmed via testing (including a from-scratch vanilla container test) that this is a Codespaces-environment networking issue, not an application or config bug. **Fix:** each affected service runs with `network_mode: "host"` in `docker-compose.yml`, with its environment variables pointing at `localhost` instead of the other services' container names.

**`.env` files don't persist across new Codespaces:** since `.env` is gitignored (correctly, to avoid committing secrets), it must be manually recreated with fresh Plaid sandbox credentials each time you start a brand-new Codespace.

## Roadmap

- [ ] Kubernetes manifests (replacing Docker Compose for orchestration)
- [ ] Frontend visual polish
