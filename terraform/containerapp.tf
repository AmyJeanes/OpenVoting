resource "azurerm_container_app_environment" "main" {
  name                       = "openvoting-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

locals {
  discord_redirect_uri = "https://voting.${data.cloudflare_zone.main.name}/api/auth/discord"

  discord_admin_role_env = [
    for idx, role_id in var.discord_admin_role_ids : {
      name  = "Settings__Discord__AdminRoleIds__${idx}"
      value = role_id
    }
  ]
}

resource "azurerm_container_app" "main" {
  name                         = "openvoting"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"

  template {
    container {
      name   = "openvoting"
      image  = var.image_sha != "" ? "ghcr.io/amyjeanes/openvoting/openvoting@${var.image_sha}" : "ghcr.io/amyjeanes/openvoting/openvoting:${var.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name        = "ConnectionStrings__Database"
        secret_name = "db-connection-string"
      }

      env {
        name  = "Settings__Discord__ClientId"
        value = var.discord_client_id
      }

      env {
        name        = "Settings__Discord__ClientSecret"
        secret_name = "discord-client-secret"
      }

      env {
        name  = "Settings__Discord__RedirectUri"
        value = local.discord_redirect_uri
      }

      env {
        name  = "Settings__Discord__GuildId"
        value = var.discord_guild_id
      }

      dynamic "env" {
        for_each = var.discord_bot_token == "" ? [] : [1]
        content {
          name        = "Settings__Discord__BotToken"
          secret_name = "discord-bot-token"
        }
      }

      dynamic "env" {
        for_each = local.discord_admin_role_env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      env {
        name        = "Settings__Jwt__SigningKey"
        secret_name = "jwt-signing-key"
      }

      env {
        name        = "Settings__BlobStorage__ConnectionString"
        secret_name = "storage-connection-string"
      }

      env {
        name  = "Settings__BlobStorage__ContainerName"
        value = azurerm_storage_container.assets.name
      }

      env {
        name  = "Settings__BlobStorage__PublicBaseUrl"
        value = "${azurerm_storage_account.main.primary_blob_endpoint}${azurerm_storage_container.assets.name}"
      }
    }
  }

  ingress {
    external_enabled = true
    transport        = "auto"
    target_port      = 8080
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  secret {
    name  = "storage-connection-string"
    value = azurerm_storage_account.main.primary_connection_string
  }

  secret {
    name  = "db-connection-string"
    value = var.database_connection_string
  }

  secret {
    name  = "discord-client-secret"
    value = var.discord_client_secret
  }

  dynamic "secret" {
    for_each = var.discord_bot_token == "" ? [] : [var.discord_bot_token]
    content {
      name  = "discord-bot-token"
      value = secret.value
    }
  }

  secret {
    name  = "jwt-signing-key"
    value = var.jwt_signing_key
  }
}

resource "azurerm_container_app_custom_domain" "main" {
  lifecycle {
    ignore_changes = [certificate_binding_type, container_app_environment_certificate_id]
  }

  name             = cloudflare_dns_record.main.name
  container_app_id = azurerm_container_app.main.id

  depends_on = [
    cloudflare_dns_record.main_validation
  ]
}
