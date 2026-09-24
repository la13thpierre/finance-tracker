## Terminal checklist (post-Codespaces-limit reset)

### 1. Environment sanity check
- [ ] Confirm Codespace is up, or spin up a fresh one
- [ ] `git pull` to sync everything built this session (frontend, k8s/, helm/, .github/workflows/, README)

### 2. Verify service details against real code
- [ ] Check auth-service's actual listening port + env var names (guessed 4001, DATABASE_URL, JWT_SECRET)
- [ ] Check ingestion-service's actual listening port + env var names (guessed 4002, REDIS_URL, PLAID_*)
- [ ] Check reporting-service's actual listening port + env var name (guessed 4003, DATABASE_URL)
- [ ] Update k8s/ manifests AND helm/finance-tracker/templates/ if any of the above were wrong

### 3. Fix known typo
- [ ] Rename k8s/categorizatation-deployment.yaml → categorization-deployment.yaml

### 4. Frontend
- [ ] Pull real JSON responses from /balance, /spend-by-category, /transactions
- [ ] Match field names in frontend/src/index.html JS to actual API response shape
- [ ] Decide reporting-service's external access method (NodePort vs Ingress) and update API_BASE accordingly

### 5. Secrets
- [ ] Create Kubernetes secret: kubectl create secret generic plaid-secrets --from-literal=client-id=... --from-literal=secret=...

### 6. Cluster setup
- [ ] Confirm k3d cluster is still alive: kubectl get nodes (recreate with k3d cluster create finance-tracker if not)

### 7. Build and import custom images
- [ ] docker build each of: auth-service, ingestion-service, categorization-service, reporting-service, frontend
- [ ] k3d image import <image>:latest -c finance-tracker for each

### 8. Apply and test (in dependency order)
- [ ] kubectl apply -f k8s/postgres-pvc.yaml, postgres-deployment.yaml, postgres-service.yaml → confirm Running
- [ ] kubectl apply -f k8s/redis-deployment.yaml, redis-service.yaml → confirm Running
- [ ] kubectl apply -f k8s/auth-service-*.yaml → confirm Running, test endpoints
- [ ] kubectl apply -f k8s/ingestion-service-*.yaml → confirm Running, test Plaid sandbox connect + sync
- [ ] kubectl apply -f k8s/categorizatation-deployment.yaml (renamed) → confirm initContainer waits properly, then Running
- [ ] kubectl apply -f k8s/reporting-service-*.yaml → confirm Running, test endpoints
- [ ] kubectl apply -f k8s/frontend-*.yaml → confirm dashboard loads and displays real data end to end

### 9. Once plain manifests work end to end
- [ ] Tear down: kubectl delete -f k8s/ (excluding helm/ subfolder)
- [ ] Test Helm chart instead: helm install finance-tracker k8s/helm/finance-tracker
- [ ] Confirm identical behavior to plain manifests

### 10. CI/CD
- [ ] Push a small change to one service folder, confirm its GitHub Actions workflow triggers correctly
- [ ] Check Trivy scan results, address any CRITICAL findings