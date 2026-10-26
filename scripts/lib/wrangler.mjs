import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudflare from '../../infra/cloudflare.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

export function runWrangler(args) {
  const cli = join(root, 'node_modules/wrangler/bin/wrangler.js');
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || cloudflare.accountId,
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export { cloudflare, root };
