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

## Kubernetes Migration

Migrated the Docker Compose stack to Kubernetes manifests and a Helm chart (see `k8s/` and `k8s/helm/finance-tracker/`), covering all 5 services, Postgres, Redis, Ingress, and Secrets.

**Deployment infrastructure:** Several free/low-cost Kubernetes hosting options were evaluated for a live demo:

- **GitHub Codespaces + kind** — blocked by an overlay-filesystem incompatibility between Codespaces' nested containers and kind's image-loading mechanism (`ctr: content digest not found`, reproduced across multiple fresh clusters).
- **GitHub Codespaces + k3d** — got further (worked around the above with a native snapshotter), but Codespaces' nested Docker containers have no outbound internet access, so the cluster couldn't pull images or resolve DNS.
- **Oracle Cloud Always Free (VM.Standard.A1.Flex)** — a real, non-nested VM that sidesteps the Codespaces networking restriction entirely. Setup was in progress when an MFA/authenticator reset locked the account out.
- **Google Cloud Free Tier (e2-micro)** — successfully installed k3s directly on the VM (no nesting, so no networking issues), but the always-free e2-micro's 1GB RAM is too constrained for k3s's control plane to run reliably under sustained load.

**Current state:** manifests, Helm chart, and CI/CD pipelines are complete and ready to deploy on any VM with ≥2GB RAM. To run locally:

\`\`\`bash
kubectl apply -f k8s/
# or
helm install finance-tracker k8s/helm/finance-tracker/
\`\`\`
## CI/CD

Each service has its own independent GitHub Actions workflow (`.github/workflows/`), triggered only when that service's files change — keeping builds fast and matching the microservices' independent deploy story.

Each workflow: installs dependencies for that service's language (Node, Go, or Python), runs tests if present, builds the Docker image, and scans it with Trivy for known vulnerabilities.

## Environment Setup
Each service has a `.env.example` listing required environment variables. Copy to `.env` and fill in real values before running locally.

