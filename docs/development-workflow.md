# Development Workflow

## Backend

Build:

```bash
dotnet build OpenVoting.Server/OpenVoting.Server.csproj
```

Tests:

```bash
dotnet test OpenVoting.Server.Tests/OpenVoting.Server.Tests.csproj
```

Migrations:

```bash
dotnet ef migrations add <Name> --project OpenVoting.Server --startup-project OpenVoting.Server
dotnet ef database update --project OpenVoting.Server --startup-project OpenVoting.Server
```

## Frontend

From `OpenVoting.Client`:

```bash
npm run lint
npm run test
npm run build
```