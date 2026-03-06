# Architecture Overview

## Backend (`OpenVoting.Server`)

Tech stack:

- ASP.NET Core (.NET 10)
- EF Core + Npgsql (PostgreSQL)
- JWT Bearer authentication
- Azure Blob Storage SDK

## Frontend (`OpenVoting.Client`)

Tech stack:

- React 19
- TypeScript (strict)
- Vite
- React Router
- Vitest + Testing Library
- Playwright for seeded end-to-end smoke/full coverage

Primary responsibilities:

- Session bootstrap and token refresh
- Poll browsing and interaction UX
- Entry submission and client-side image prevalidation
- Voting UI for Approval and IRV
- Admin controls for lifecycle and moderation

## Project structure

```text
OpenVoting.Server/         ASP.NET Core backend API
OpenVoting.Server.Tests/   NUnit tests for backend
OpenVoting.Client/         React + TypeScript frontend
scripts/                   Shared local automation, including Playwright orchestration and test seeding
charts/openvoting/         Helm chart for Kubernetes deployment
terraform/                 OpenTofu infrastructure definitions
```