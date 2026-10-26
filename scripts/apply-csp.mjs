import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import cloudflare from '../infra/cloudflare.json' with { type: 'json' };

const dist = new URL('../dist/', import.meta.url);

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (name.endsWith('.html')) files.push(path);
  }
  return files;
}

const hashes = new Set();
for (const file of walk(dist.pathname)) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const type = /type\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1] ?? '';
    if (type && !/javascript/i.test(type)) continue;
    const body = match[2];
    if (!body.trim()) continue;
    const digest = createHash('sha256').update(body).digest('base64');
    hashes.add(`'sha256-${digest}'`);
  }
}

const r2Origin = new URL(cloudflare.modelBaseUrl).origin;
const scriptSrc = [
  "'self'",
  "'wasm-unsafe-eval'",
  r2Origin,
  ...[...hashes].sort(),
].join(' ');

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' blob: data:",
  `connect-src 'self' https: blob: ${r2Origin}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const headersPath = join(dist.pathname, '_headers');
const current = readFileSync(headersPath, 'utf8');
const next = current.replace(/Content-Security-Policy:.*/g, `Content-Security-Policy: ${csp}`);
if (next === current || !current.includes('Content-Security-Policy:')) {
  throw new Error('dist/_headers is missing a Content-Security-Policy line to replace.');
}
writeFileSync(headersPath, next);
console.log(`Wrote CSP with ${hashes.size} inline script hashes to dist/_headers`);
