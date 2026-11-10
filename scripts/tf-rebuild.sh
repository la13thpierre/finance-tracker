#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
SERVICES="auth-service ingestion-service categorization-service reporting-service frontend"

export TF_VAR_plaid_client_id=$(grep PLAID_CLIENT_ID ingestion-service/.env | cut -d= -f2)
export TF_VAR_plaid_secret=$(grep PLAID_SECRET ingestion-service/.env | cut -d= -f2)
export TF_VAR_jwt_secret=${TF_VAR_jwt_secret:-$(openssl rand -hex 32)}
export TF_VAR_postgres_password=finance

cd terraform/local
if ! KUBECONFIG=kubeconfig kubectl get nodes >/dev/null 2>&1; then
  echo "Cluster not answering - resetting"
  docker rm -f finance-tf-control-plane 2>/dev/null || true
  rm -f terraform.tfstate terraform.tfstate.backup kubeconfig
fi
terraform init -input=false
terraform apply -auto-approve -target=kind_cluster.finance
cd ../..

for s in $SERVICES; do
  if ! docker image inspect $s:latest >/dev/null 2>&1; then
    f=$(ls $s | grep -ix dockerfile)
    docker build -t $s:latest -f $s/$f $s
  fi
  kind load docker-image $s:latest --name finance-tf
done
for i in postgres:16 redis:7; do
  docker image inspect $i >/dev/null 2>&1 || docker pull $i
  kind load docker-image $i --name finance-tf
done

cd terraform/local
terraform apply -auto-approve
cd ../..
KUBECONFIG=terraform/local/kubeconfig kubectl get pods
