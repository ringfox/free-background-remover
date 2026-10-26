# Free AI Background Remover

Remove an image background in the browser and download a transparent PNG. The ISNet int8 model runs on-device with ONNX Runtime Web. Photos are not uploaded. There is no account, database, payment, or server-side image processing.

The page is a static [Astro](https://astro.build/) site for [Cloudflare Pages](https://developers.cloudflare.com/pages/). Model weights live in Cloudflare R2, not in git.

## Stack

- Astro + React + TypeScript
- ONNX Runtime Web (`onnxruntime-web`) in a module worker
- ISNet int8 weights from [chenjindu/isnet-web](https://huggingface.co/chenjindu/isnet-web) (Apache-2.0)
- Cloudflare Pages for the site, Cloudflare R2 for the model

Preprocess and composite follow the Apache-2.0 reference at [browser-remove-background/index.html](https://github.com/chenjindu/browser-remove-background/blob/main/index.html):

1. Stretch the image to 1024×1024 (no letterbox).
2. Pack RGB as float32 NCHW `[1, 3, 1024, 1024]`.
3. Normalize each channel with `(pixel / 255 - 0.5)`.
4. Run the session with input name `input_image`.
5. Read the single-channel `output_image` matte.
6. Min-max scale that matte to 0–255 alpha.
7. Composite it onto the original RGB with canvas `destination-in`, at the original resolution, and export a PNG.

The worker prefers WebGPU when `navigator.gpu.requestAdapter()` returns an adapter, then falls back to WASM. WASM is pinned to `ort.env.wasm.numThreads = 1` and `wasmPaths` points at the runtime files. This environment did not have a working WebGPU adapter, so WebGPU was not verified here. The WASM path is what local real-model runs should exercise unless your browser exposes WebGPU.

## Requirements

- Node.js 20 or newer
- npm
- A Cloudflare account for R2 and Pages. The bucket and account already in use:
  - Account ID: `3cbe3dbbd5650161a784846887f23f94`
  - R2 bucket: `free-bg-remover-models`
  - Public r2.dev base: `https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev`

No API token is stored in this repo. Wrangler uses the OAuth session from `npx wrangler login` on a machine where that login exists.

## Install

```sh
npm ci
cp .env.example .env
```

`.env.example` contains only public URLs and a sample contact address. Edit `PUBLIC_SITE_URL` and `PUBLIC_CONTACT_EMAIL` before a production build. `PUBLIC_*` values are inlined at build time.

| Variable | Role |
| --- | --- |
| `PUBLIC_MODEL_BASE_URL` | Base for the three model parts. Trailing slash optional. Default, if unset: `https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models` |
| `PUBLIC_ORT_BASE_URL` | Directory of ONNX Runtime `.wasm` / `.mjs` files. Default: `/ort/` (shipped with the Pages build). |
| `PUBLIC_SITE_URL` | Canonical origin for Open Graph, `robots.txt`, and the sitemap. |
| `PUBLIC_CONTACT_EMAIL` | Address on the contact, privacy, and terms pages. |
| `PUBLIC_ALLOW_INFERENCE_MOCK` | Unused by the app. The Playwright mock is available only while `astro dev` is running. |

Part URLs are `${PUBLIC_MODEL_BASE_URL}/isnet-w8.part00`, `part01`, and `part02`.

## Local development

```sh
npm run dev
```

The dev server copies ONNX Runtime files into `public/ort/` (gitignored) and serves the site at `http://localhost:4321`. The model is not fetched until you choose an image.

To run real inference against files on disk instead of R2:

```sh
npm run model:download -- --link
```

Then set `PUBLIC_MODEL_BASE_URL=/models/` in `.env` and restart `npm run dev`. `public/models` is a symlink to `.model-cache/` and both are gitignored.

`npm run model:download` fetches the parts from Hugging Face, checks size and SHA-256 against `model/manifest.json`, and writes them to `.model-cache/`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Copy the ORT runtime and start Astro. |
| `npm run build` | Copy only runtime files under the 25 MiB Pages limit, then `astro build`. Output is `dist/`. |
| `npm run preview` | Serve `dist/`. |
| `npm run typecheck` | `astro check`. |
| `npm run lint` | ESLint. |
| `npm test` | Unit tests for preprocess, alpha, composite, validation, URLs, and checksum verification. |
| `npm run test:e2e` | Playwright. Uploads a synthetic PNG, runs a **mocked** matte (no ORT), and checks the downloaded PNG has alpha. |
| `npm run test:e2e:real` | Playwright against the real ISNet model. Requires `npm run model:download -- --link`. |
| `npm run model:download` | Download and verify the three parts into `.model-cache/`. `--link` also symlinks `public/models`. |
| `npm run model:verify` | Check `.model-cache/` against the manifest. Add `--url <base>` to hash a remote copy. |
| `npm run model:upload` | Upload the parts to R2 with Wrangler. |
| `npm run runtime:upload` | Upload ONNX Runtime wasm/js to R2 (needed for WebGPU; see below). |
| `npm run r2:cors` | Apply `infra/r2-cors.json`. This overwrites the bucket CORS policy. |
| `npm run deploy` | Build, then `wrangler pages deploy dist`. |

## Tests and what they do not claim

Unit tests cover NCHW normalization, min-max alpha, destination-in math, file-type and size checks, the R2 URL join, and the checksum helper. Fixtures are synthetic (`tests/fixtures/red-square.png`), not photographs.

`npm run test:e2e` starts `astro dev` and opens `/?mock=1`. The dev server returns a hard circle matte instead of calling ONNX Runtime. That branch is compiled out of production builds (`import.meta.env.DEV` is false). The test checks that the PNG is 64×64, the center is opaque, and a corner is transparent. It also checks that choosing a file is what starts work: the first paint does not request `isnet-w8` or `/ort/`.

`npm run test:e2e:real` does not mock ORT. It serves the downloaded parts from `/models/` and waits for a real session. Skip it when the parts are not linked. A solid red square is only a pipeline check (RGBA PNG comes back); it is not a quality score.

WebGPU was not exercised in this environment. If the browser has no adapter, the worker logs a fallback and the UI says `Ran on WASM`.

## R2 model hosting

Objects (not in git):

| Key | Bytes | SHA-256 |
| --- | --- | --- |
| `models/isnet-w8.part00` | 20971520 | `4a9400b963ab3c6b6458026afe0e5e0d0d62b5a80d9373ea9b292835df3b3081` |
| `models/isnet-w8.part01` | 20971520 | `0486a7019b37b985504a70ecbe378b103feb1555bc43c0bc543c703503a98296` |
| `models/isnet-w8.part02` | 4771450 | `84fa00f9b72f85fb6af7833c54560d635cc05d0dfad7bce6ce623145fe6acc27` |

Public URLs, once uploaded:

- `https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models/isnet-w8.part00`
- `https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models/isnet-w8.part01`
- `https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models/isnet-w8.part02`

`r2.dev` is Cloudflare’s public development hostname and is rate-limited. For production traffic, attach a custom domain to the bucket and set `PUBLIC_MODEL_BASE_URL` to `https://<that-domain>/models`.

Upload from a machine that is already logged in to Wrangler (`npx wrangler login`). This does not create or print an API token.

```sh
npm run model:download
npm run model:verify
npm run model:upload
npm run model:verify -- --url https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models
```

`model:upload` runs, for each part:

```sh
npx wrangler r2 object put free-bg-remover-models/models/isnet-w8.part00 \
  --file .model-cache/isnet-w8.part00 \
  --content-type application/octet-stream \
  --cache-control "public, max-age=31536000, immutable" \
  --remote \
  --force
```

The account id is `3cbe3dbbd5650161a784846887f23f94` (`wrangler.jsonc` and `CLOUDFLARE_ACCOUNT_ID`). Filenames are versioned (`isnet-w8`), so the immutable cache header is safe until the weights change. If you publish new weights, change the object names or purge the cache. Do not commit `.model-cache/` or `public/models/`.

### CORS, headers, and MIME

Browser fetches need CORS because the site origin and the r2.dev host differ. `infra/r2-cors.json` allows `GET` and `HEAD` from any origin, allows the `Range` request header, and exposes `ETag`, `Content-Length`, `Content-Range`, `Accept-Ranges`, and `Content-Type`. Apply it only if you need to replace the live policy:

```sh
npm run r2:cors
npx wrangler r2 bucket cors list free-bg-remover-models
```

The Wrangler file shape is `{ "rules": [{ "allowed": { "origins", "methods", "headers" }, "exposeHeaders", "maxAgeSeconds" }] }` ([R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)).

Model objects use `Content-Type: application/octet-stream`. The browser reads them as bytes; it does not execute them.

Enable the public r2.dev URL or a custom domain before the site can fetch the parts ([public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)). The dev URL for this bucket is already enabled.

### ONNX Runtime files and the 25 MiB Pages limit

Pages refuses a single asset at or above 25 MiB ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/)). `onnxruntime-web` 1.30’s WASM file (`ort-wasm-simd-threaded.wasm`, about 14 MiB) fits and is copied into `public/ort/` for the Pages build. The WebGPU runtime (`ort-wasm-simd-threaded.asyncify.wasm`, about 26 MiB, and the JSEP build, about 28 MiB) does not fit.

With the default `PUBLIC_ORT_BASE_URL=/ort/`, inference uses WASM from the Pages origin. WebGPU will fail to fetch its larger wasm and the worker falls back to WASM.

To turn WebGPU on after you have confirmed an adapter in your browser:

```sh
npm run runtime:upload
```

That uploads every `ort-wasm-simd-threaded.*` file to `free-bg-remover-models/ort/` with `application/wasm` or `application/javascript` and the same immutable cache header. Then set:

```sh
PUBLIC_ORT_BASE_URL=https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/ort
```

Rebuild. `wasmPaths` has to be a single directory, so the R2 prefix must contain the small WASM files as well as the large ones. Re-upload the runtime when you upgrade `onnxruntime-web`.

## Cloudflare Pages

`wrangler.jsonc` names the project `free-background-remover`, sets the account id, and points `pages_build_output_dir` at `dist/`.

Direct upload from a logged-in machine:

```sh
npm run deploy
```

which is `npm run build` followed by:

```sh
npx wrangler pages deploy dist --project-name free-background-remover
```

Git integration ([build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)):

| Setting | Value |
| --- | --- |
| Project name | `free-background-remover` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | 20 or 22 |

Set these build-time variables in the Pages project before the first production build:

- `PUBLIC_MODEL_BASE_URL` = `https://pub-8351688b2a9b42318f662dc52714bef3.r2.dev/models`
- `PUBLIC_SITE_URL` = the public site origin, no path
- `PUBLIC_CONTACT_EMAIL` = the address that should appear on the contact page
- `PUBLIC_ORT_BASE_URL` = `/ort/` unless you have uploaded the runtime to R2

The site is static. Do not add a Pages Function for image processing.

`public/_headers` sets `nosniff`, a referrer policy, `X-Frame-Options: DENY`, and a locked-down permissions policy. `npm run build` rewrites the content security policy in `dist/_headers` with SHA-256 hashes of Astro’s inline island scripts, `wasm-unsafe-eval`, and `connect-src` access to HTTPS (the model host). Style attributes stay allowed because the progress bar sets its width inline. The model bucket origin is also allowed as a script host so an optional R2 copy of the ONNX Runtime can be imported.

## Pages on the site

- `/` tool, how-to, and FAQ
- `/privacy/` what stays on device, what the host can still log
- `/terms/` plain-language terms
- `/contact/` mailto link from `PUBLIC_CONTACT_EMAIL`

There is no analytics and no ad script. The app does not set cookies and does not write the photo to Cache Storage or IndexedDB. It does cache the model parts there after a SHA-256 check.

## License notes

See `NOTICE`. The weights and the reference preprocess are Apache-2.0. ONNX Runtime Web is MIT. This repository does not add a separate license for the site source.
