import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';

const execFileAsync = promisify(execFile);

type TestSessionResponse = {
  token: string;
  livePollTitle: string;
  closedPollTitle: string;
  liveEntryTitle: string;
  displayName: string;
};

export default async function globalSetup(config: FullConfig) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, '..', '..');
  const project = config.projects[0];
  const baseURL = project?.use.baseURL;
  if (typeof baseURL !== 'string' || baseURL.length === 0) {
    throw new Error('Playwright baseURL is required for test setup');
  }

  const authDir = path.resolve(currentDir, '.auth');
  await fs.mkdir(authDir, { recursive: true });

  const storageStatePath = path.join(authDir, 'storage-state.json');
  const sessionPath = path.join(authDir, 'session.json');

  await execFileAsync('dotnet', ['run', path.join(repoRoot, 'scripts', 'test-seed.cs')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_SESSION_FILE: sessionPath,
    },
  });

  const session = JSON.parse(await fs.readFile(sessionPath, 'utf8')) as TestSessionResponse;

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          {
            name: 'ov_token',
            value: session.token,
          },
        ],
      },
    ],
  };

  await fs.writeFile(storageStatePath, JSON.stringify(storageState, null, 2));
}