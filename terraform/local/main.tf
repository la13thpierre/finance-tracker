terraform {
  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = ">= 0.5.0"
    }
  }
}

provider "kind" {}

resource "kind_cluster" "finance" {
  name            = "finance-tf"
  wait_for_ready  = true
  kubeconfig_path = "${path.module}/kubeconfig"
}

output "cluster_name" {
  value = kind_cluster.finance.name
}
