General:
- You can only delete files by running shell commands, the patch tool does not work for this
  - TODO: Remove when fixed: https://github.com/microsoft/vscode/issues/275705
- Using tools on Windows must use actual Windows file paths i.e. C:\_git\, not /c/_git/ etc
- Make sure all changes are covered by unit tests where appropriate

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
