provider "kubernetes" {
  host                   = kind_cluster.finance.endpoint
  client_certificate     = kind_cluster.finance.client_certificate
  client_key             = kind_cluster.finance.client_key
  cluster_ca_certificate = kind_cluster.finance.cluster_ca_certificate
}

provider "helm" {
  kubernetes = {
    host                   = kind_cluster.finance.endpoint
    client_certificate     = kind_cluster.finance.client_certificate
    client_key             = kind_cluster.finance.client_key
    cluster_ca_certificate = kind_cluster.finance.cluster_ca_certificate
  }
}

variable "plaid_client_id" {
  type      = string
  sensitive = true
}

variable "plaid_secret" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

resource "kubernetes_secret_v1" "finance_secrets" {
  metadata {
    name = "finance-secrets"
  }
  data = {
    DATABASE_URL      = "postgres://finance:${var.postgres_password}@postgres-service:5432/finance_tracker"
    JWT_SECRET        = var.jwt_secret
    POSTGRES_PASSWORD = var.postgres_password
  }
}

resource "kubernetes_secret_v1" "plaid_secrets" {
  metadata {
    name = "plaid-secrets"
  }
  data = {
    "client-id" = var.plaid_client_id
    "secret"    = var.plaid_secret
  }
}

resource "helm_release" "finance_tracker" {
  name       = "finance-tracker"
  chart      = "${path.module}/../../k8s/helm/finance-tracker"
  wait       = false
  depends_on = [kubernetes_secret_v1.finance_secrets, kubernetes_secret_v1.plaid_secrets]
}
