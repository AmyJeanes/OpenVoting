# Configuration

Settings are provided via `appsettings.json` and environment variables.

## Required backend settings

At minimum, configure:

- `ConnectionStrings__Database`
- `Settings__Jwt__SigningKey`
- `Settings__Discord__ClientId`
- `Settings__Discord__ClientSecret`
- `Settings__Discord__GuildId`
- `Settings__BlobStorage__ConnectionString`
- `Settings__BlobStorage__ContainerName`

Common optional settings:

- `Settings__Discord__BotToken` (for slash command registration and guild metadata)
- `Settings__Discord__PublicKey` (Discord interaction signature verification)
- `Settings__Discord__AdminRoleIds__0`, `__1`, ...
- `Settings__BlobStorage__PublicBaseUrl`
- `Settings__Upload__MaxFileSizeMB`

See `OpenVoting.Server/appsettings.json` for schema and defaults.

## Discord app setup

Configure your Discord application with:

- OAuth2 client id/secret
- Redirect URI(s) pointing to your deployment and/or local callback:
  - `https://<host>/api/auth/discord`
  - local dev: `https://localhost:54196/api/auth/discord` (if using default profile)
- Bot token
- Interaction endpoint URL (for slash commands): `https://<host>/api/discord/interactions`

## Local blob storage options

You can use:

- Azure Storage account connection string, or
- Azurite-compatible connection string for local development