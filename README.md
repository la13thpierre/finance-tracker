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

## Kubernetes Migration (In Progress)

Migrating orchestration from Docker Compose to Kubernetes, aiming to run locally via a lightweight cluster tool before eventually deploying to AWS EKS via Terraform.

### Manifests
All Kubernetes manifests live in `k8s/`, one Deployment + Service pair per component:
- `postgres-*.yaml` — includes a PersistentVolumeClaim for data durability
- `redis-*.yaml` — queue only, no persistence needed
- `auth-service-*.yaml`, `ingestion-service-*.yaml`, `reporting-service-*.yaml`, `frontend-*.yaml`
- `categorization-service-deployment.yaml` — background worker, no Service (not called by other pods)

### Local cluster tooling: kind → k3d
Initially used [kind](https://kind.sigs.k8s.io/) for a local cluster. Hit a persistent, reproducible failure pulling images inside GitHub Codespaces: `kind load docker-image` and in-cluster image pulls both failed with a "content digest not found" error, confirmed across two independent, freshly-created Codespaces — ruling out corruption and pointing to an incompatibility between Codespaces' own overlay filesystem and kind's nested overlay-based node containers.

Also hit a related DNS issue: the kind node's `/etc/resolv.conf` pointed at Docker's internal bridge gateway (`172.19.0.1`), which timed out from inside the Codespace's networking. Overriding it to the host's actual upstream resolver (`168.63.129.16`, Azure's internal DNS) resolved the DNS lookup but not the underlying image-import failure — confirming the overlay-filesystem issue was the real root cause, not DNS.

Switched to [k3d](https://k3d.io/) (k3s-in-Docker), which avoids the same nested-overlay pattern and is a better fit for containerized dev environments like Codespaces.

### Notes for reproducing locally
- Custom-built service images use `imagePullPolicy: Never` and are loaded into the cluster directly (`k3d image import <image>:latest -c finance-tracker`) rather than pulled from a registry.
- Plaid sandbox credentials are provided via a Kubernetes Secret (`plaid-secrets`), not hardcoded in manifests.
- Frontend's `API_BASE` needs to point at reporting-service's externally reachable address (NodePort/Ingress), not its internal cluster DNS name, since the browser — not another pod — makes that request.

### Remaining work
- [ ] Build and import remaining service images
- [ ] Apply and verify full stack in cluster
-- [x] Fixed categorization-service's Postgres startup race condition using a Kubernetes `initContainer` (`wait-for-postgres`, polling `pg_isready`) — replaces the manual `docker start`/restart workaround needed in Docker Compose
- [ ] Helm charts
- [ ] Per-service CI/CD
- [ ] EKS deployment via Terraform
## CI/CD

Each service has its own independent GitHub Actions workflow (`.github/workflows/`), triggered only when that service's files change — keeping builds fast and matching the microservices' independent deploy story.

Each workflow: installs dependencies for that service's language (Node, Go, or Python), runs tests if present, builds the Docker image, and scans it with Trivy for known vulnerabilities.

## Environment Setup
Each service has a `.env.example` listing required environment variables. Copy to `.env` and fill in real values before running locally.