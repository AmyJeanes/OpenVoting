General:
- Using tools on Windows must use actual Windows file paths i.e. C:\_git\, not /c/_git/ etc
- Make sure all changes are covered by unit tests where appropriate
- You are running in a PowerShell terminal, you do not need to run `pwsh -Command` before using PowerShell commands / syntax
- User-facing text in the UI should rarely have a full stop at the end, except for longer sentences, e.g. instructions, where it may be appropriate

OpenVoting.Server:
- This is a .NET backend server application using EF Core Migrations
- Use `dotnet build` to compile
- Use `dotnet test` to run unit tests
- Always run build and unit tests after changing backend code
- `ImplicitUsings` is enabled so common namespaces are included automatically and do not need to be added
- Do not manually create or edit database migration files, use `dotnet ef migrations add <Name>` to generate them
- Do not manually edit the database model snapshot, you may edit migrations if absolutely necessary after generating them
- Use `dotnet ef database update` to apply migrations to the database after adding new migration files
- Do not directly add packages to the project file, use `dotnet add package <PackageName>` instead

OpenVoting.Client:
- This is a React frontend application
- Use `npm run build` to compile
- Use `npm run test` to run unit tests
- Always run build and unit tests after changing frontend code to test
- TypeScript is used with strict type checking enabled, do not use the `any` type unless absolutely necessary
- Use shared CSS variables where possible for consistency, e.g. colors, spacing, etc
