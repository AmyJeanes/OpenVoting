# Local Development

## Prerequisites

- .NET SDK 10.x
- Node.js 20.x + npm
- PostgreSQL
- (Optional) Azurite for local blob emulation

## 1) Restore dependencies

From repo root:

```bash
dotnet restore OpenVoting.slnx
cd OpenVoting.Client
npm ci
```

## 2) Configure backend settings

Set environment variables or user secrets for required keys in [Configuration](configuration.md).

You can start from `OpenVoting.Server/appsettings.json` and override secrets locally.

## 3) Apply database migrations

From repo root:

```bash
dotnet ef database update --project OpenVoting.Server --startup-project OpenVoting.Server
```

## 4) Run the app

The backend automatically builds and runs the frontend dev server when you start it, so only the backend project needs to be started:

```bash
dotnet run --project OpenVoting.Server/OpenVoting.Server.csproj --launch-profile https
```

The site starts by default on: https://localhost:54196

The Vite dev server proxies `/api/*` requests to the backend.