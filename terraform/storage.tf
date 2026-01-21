resource "random_string" "storage_suffix" {
  length  = 6
  upper   = false
  lower   = true
  numeric = true
  special = false
}

resource "azurerm_storage_account" "main" {
  name                            = "openvoting${random_string.storage_suffix.result}"
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = true

  blob_properties {
    cors_rule {
      allowed_methods    = ["GET", "HEAD", "OPTIONS"]
      allowed_origins    = [
        "https://localhost:54196",
        "https://voting.${data.cloudflare_zone.main.name}"
      ]
      allowed_headers    = ["*"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }
}

resource "azurerm_storage_container" "assets" {
  name                  = "assets"
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = "blob"
}
