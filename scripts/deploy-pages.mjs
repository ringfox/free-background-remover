import { spawnSync } from 'node:child_process';
import { cloudflare, root, runWrangler } from './lib/wrangler.mjs';

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error(
    `CLOUDFLARE_API_TOKEN is not set. Export a Cloudflare API token that can deploy Pages on account ${cloudflare.accountId}, then rerun npm run deploy. The token is not stored in this repo.`,
  );
  process.exit(1);
}

const build = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    PUBLIC_MODEL_BASE_URL: process.env.PUBLIC_MODEL_BASE_URL?.trim() || cloudflare.modelBaseUrl,
    PUBLIC_ORT_BASE_URL: process.env.PUBLIC_ORT_BASE_URL?.trim() || '/ort/',
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || cloudflare.accountId,
  },
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

runWrangler([
  'pages',
  'deploy',
  'dist',
  '--project-name',
  cloudflare.pagesProject,
  '--commit-dirty',
]);
