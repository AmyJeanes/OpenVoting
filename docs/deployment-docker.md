# Docker Deployment

If you want to run OpenVoting without building locally, use the published image:

- `ghcr.io/amyjeanes/openvoting/openvoting:latest`

## Docker run

The app serves on container port `8080`.

```bash
docker run --name openvoting --rm -p 8080:8080 \
  -e ConnectionStrings__Database="Host=<db-host>;Database=<db-name>;Username=<db-user>;Password=<db-password>" \
  -e Settings__Discord__ClientId="<discord-client-id>" \
  -e Settings__Discord__ClientSecret="<discord-client-secret>" \
  -e Settings__Discord__GuildId="<discord-guild-id>" \
  -e Settings__Discord__BotToken="<discord-bot-token>" \
  -e Settings__Discord__PublicKey="<discord-public-key>" \
  -e Settings__Jwt__SigningKey="<long-random-signing-key>" \
  -e Settings__BlobStorage__ConnectionString="<blob-connection-string>" \
  -e Settings__BlobStorage__ContainerName="assets" \
  -e Settings__BlobStorage__PublicBaseUrl="https://<cdn-or-storage-public-url>" \
  -e Settings__Upload__MaxFileSizeMB="10" \
  ghcr.io/amyjeanes/openvoting/openvoting:latest
```

Then open: `http://localhost:8080`

## Docker Compose

Create a `docker-compose.yml` like this:

```yaml
services:
  openvoting:
    image: ghcr.io/amyjeanes/openvoting/openvoting:latest
    container_name: openvoting
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      ConnectionStrings__Database: Host=<db-host>;Database=<db-name>;Username=<db-user>;Password=<db-password>
      Settings__Discord__ClientId: <discord-client-id>
      Settings__Discord__ClientSecret: <discord-client-secret>
      Settings__Discord__GuildId: <discord-guild-id>
      Settings__Discord__BotToken: <discord-bot-token>
      Settings__Discord__PublicKey: <discord-public-key>
      Settings__Discord__AdminRoleIds__0: <admin-role-id-1>
      Settings__Discord__AdminRoleIds__1: <admin-role-id-2>
      Settings__Jwt__SigningKey: <long-random-signing-key>
      Settings__BlobStorage__ConnectionString: <blob-connection-string>
      Settings__BlobStorage__ContainerName: assets
      Settings__BlobStorage__PublicBaseUrl: https://<cdn-or-storage-public-url>
      Settings__Upload__MaxFileSizeMB: "10"
```

Start it:

```bash
docker compose up -d
```

## Important notes

- You still need external PostgreSQL and blob storage (or local equivalents such as Azurite)
- Run EF migrations against your target database before first use
- For local container testing, add `http://localhost:8080/api/auth/discord` to Discord OAuth redirect URIs
- For production, use HTTPS and set:
  - OAuth redirect URI: `https://<host>/api/auth/discord`
  - Discord interaction endpoint: `https://<host>/api/discord/interactions`