import { defineConfig, devices } from '@playwright/test';

const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '54197';
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `https://localhost:${frontendPort}`;
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:7192';
const serverUrls = process.env.PLAYWRIGHT_SERVER_URLS ?? apiBaseUrl;
const dbConnection = process.env.PLAYWRIGHT_DB_CONNECTION ?? 'Host=127.0.0.1;Port=5432;Database=openvoting_smoke;Username=postgres;Password=postgres';
const jwtSigningKey = process.env.PLAYWRIGHT_JWT_SIGNING_KEY ?? 'smoke-test-signing-key-1234567890';
const guildId = process.env.PLAYWRIGHT_GUILD_ID ?? 'smoke-guild';
const adminRoleId = process.env.PLAYWRIGHT_ADMIN_ROLE_ID ?? 'smoke-admin';

export default defineConfig({
  testDir: './playwright',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: frontendBaseUrl,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  globalSetup: './playwright/global-setup.ts',
  webServer: [
    {
      command: 'dotnet run --project ../OpenVoting.Server --no-launch-profile',
      url: `${apiBaseUrl}/healthz`,
      reuseExistingServer: false,
      ignoreHTTPSErrors: true,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'SmokeTest',
        ASPNETCORE_URLS: serverUrls,
        ConnectionStrings__Database: dbConnection,
        Settings__Jwt__Issuer: 'OpenVoting',
        Settings__Jwt__Audience: 'OpenVoting',
        Settings__Jwt__SigningKey: jwtSigningKey,
        Settings__Discord__GuildId: guildId,
        Settings__Discord__AdminRoleIds__0: adminRoleId,
        Settings__BlobStorage__ConnectionString: 'UseDevelopmentStorage=true',
        Settings__BlobStorage__ContainerName: 'assets',
      },
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
    {
      command: 'npm run dev',
      url: frontendBaseUrl,
      reuseExistingServer: false,
      ignoreHTTPSErrors: true,
      env: {
        ...process.env,
        ASPNETCORE_URLS: serverUrls,
        DEV_SERVER_PORT: frontendPort,
      },
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './playwright/.auth/storage-state.json',
      },
    },
  ],
});