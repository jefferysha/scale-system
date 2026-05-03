import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Phase 5 E2E 全局 setup：
 * 1. 确保 docker pg（端口 5433）可达；如果未起则启动。
 * 2. 跑 alembic upgrade head（幂等）。
 * 3. 跑 seed admin（幂等）。
 * 4. 启 uvicorn 在 8000，等到 /health 200。
 */

const REPO_ROOT = path.resolve(__dirname, '../../../../../scale-system');
const API_DIR = path.join(REPO_ROOT, 'apps', 'api');
const COMPOSE = path.join(REPO_ROOT, 'docker', 'docker-compose.yml');
const PID_FILE = path.join(__dirname, '.uvicorn.pid');

const ping = async (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });

const waitForHealth = async (timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await ping('http://localhost:8000/health')) return true;
    await wait(500);
  }
  return false;
};

const runSync = (cmd: string, cwd: string): void => {
  console.log(`[e2e-setup] $ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
};

export default async function globalSetup(): Promise<void> {
  if (await ping('http://localhost:8000/health')) {
    console.log('[e2e-setup] BE 已就绪，跳过 alembic + seed + uvicorn 启动');
    return;
  }

  try {
    runSync('docker compose -f "' + COMPOSE + '" up -d pg', REPO_ROOT);
  } catch (e) {
    console.warn('[e2e-setup] docker compose 启动 pg 失败（可能已在运行）：', e);
  }
  await wait(2000);

  runSync('uv run alembic upgrade head', API_DIR);
  runSync('uv run python scripts/seed.py', API_DIR);

  console.log('[e2e-setup] 启动 uvicorn 8000');
  const proc: ChildProcess = spawn(
    'uv',
    ['run', 'uvicorn', 'scale_api.main:app', '--port', '8000'],
    {
      cwd: API_DIR,
      detached: true,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env,
    },
  );
  proc.unref();
  if (proc.pid) fs.writeFileSync(PID_FILE, String(proc.pid));

  const ok = await waitForHealth(30_000);
  if (!ok) {
    throw new Error('[e2e-setup] uvicorn 30s 内未就绪');
  }
  console.log('[e2e-setup] BE 就绪 ✓');
}
