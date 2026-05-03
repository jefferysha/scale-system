import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PID_FILE = path.join(__dirname, '.uvicorn.pid');

export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(PID_FILE)) return;
  const pid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim());
  if (Number.isFinite(pid) && pid > 0) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[e2e-teardown] uvicorn(pid=${pid}) 已发 SIGTERM`);
    } catch (e) {
      console.warn('[e2e-teardown] kill 失败（可能已退出）：', e);
    }
  }
  fs.unlinkSync(PID_FILE);
}
