#!/usr/bin/env bash
set -e
CLUSTER=finance-tracker
SERVICES="auth-service ingestion-service categorization-service reporting-service frontend"

kind delete cluster --name $CLUSTER || true
kind create cluster --name $CLUSTER

for s in $SERVICES; do
  if ! docker image inspect $s:latest >/dev/null 2>&1; then
    f=$(ls $s | grep -ix dockerfile)
    docker build -t $s:latest -f $s/$f $s
  fi
  kind load docker-image $s:latest --name $CLUSTER
done

for i in postgres:16 redis:7; do
  docker pull $i
  kind load docker-image $i --name $CLUSTER
done

kubectl create secret generic plaid-secrets \
  --from-literal=client-id="$(grep PLAID_CLIENT_ID ingestion-service/.env | cut -d= -f2)" \
  --from-literal=secret="$(grep PLAID_SECRET ingestion-service/.env | cut -d= -f2)"
kubectl create secret generic finance-secrets \
  --from-literal=DATABASE_URL='postgres://finance:finance@postgres-service:5432/finance_tracker' \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=POSTGRES_PASSWORD='finance'

kubectl apply -f k8s/Finance-config.yaml
kubectl apply -f k8s/
kubectl wait --for=condition=available deployment --all --timeout=180s || true
kubectl get pods