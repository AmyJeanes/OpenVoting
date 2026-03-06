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

## End-to-end tests

From repo root:

```powershell
./scripts/Run-PlaywrightTests.ps1 -TestType Smoke
./scripts/Run-PlaywrightTests.ps1 -TestType Full
```

Use `Smoke` for the fast seeded sanity pass that checks the main authenticated routes and seeded poll data.

Use `Full` for broader end-to-end coverage of admin and voter flows, including poll creation, lifecycle transitions, entry submission, moderation, voting, history, and cleanup.

The runner script:

- Provisions a temporary PostgreSQL Docker container unless one is explicitly kept
- Seeds shared Playwright test data through `scripts/test-seed.cs`
- Starts the backend and frontend dev servers with the correct test environment variables
- Runs the requested Playwright suite and then cleans up the temporary test infrastructure

CI currently runs the `Smoke` suite on every build. The `Full` suite is available for deeper local verification and future CI expansion.