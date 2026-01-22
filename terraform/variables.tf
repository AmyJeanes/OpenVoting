variable "azure_subscription_id" {
  sensitive = true
}

variable "cloudflare_api_token" {
  sensitive = true
}

variable "cloudflare_zone_id" {
  sensitive = true
}

variable "database_connection_string" {
  description = "PostgreSQL connection string used by the API."
  type        = string
  sensitive   = true
}

variable "discord_client_id" {
  description = "Discord application client id."
  type        = string
}

variable "discord_client_secret" {
  description = "Discord application client secret."
  type        = string
  sensitive   = true
}

variable "discord_guild_id" {
  description = "Discord guild id to scope membership checks."
  type        = string
}

variable "discord_bot_token" {
  description = "Optional Discord bot token for guild operations."
  type        = string
  default     = ""
  sensitive   = true
}

variable "discord_admin_role_ids" {
  description = "List of Discord role ids that should be treated as admins."
  type        = list(string)
  default     = []
}

variable "jwt_signing_key" {
  description = "Symmetric signing key for JWT tokens."
  type        = string
  sensitive   = true
}

variable "image_sha" {
  description = "The image sha to use for the container app."
  type        = string
}

variable "image_tag" {
  description = "The image tag to use for the container app if sha is not provided."
  type        = string
  default     = "latest"
}
