export const SITE_NAME = 'Free AI Background Remover';

export const SITE_TITLE = 'Free AI Background Remover – Transparent PNG in Seconds';

export const SITE_DESCRIPTION =
  'Remove an image background in your browser and download a transparent PNG. Free, no account, and the photo never leaves your device.';

export const faqs = [
  {
    question: 'Does my photo get uploaded?',
    answer:
      'No. The image is decoded, segmented, and composited in your browser. The photo is not sent to a server. The page downloads the segmentation model (about 45 MB) from the model host, then keeps that model in your browser cache.',
  },
  {
    question: 'Is it actually free?',
    answer:
      'Yes. There is no account, no payment, and no paid AI API behind this page. Your own device does the work, so a large image can take longer on an older phone.',
  },
  {
    question: 'Why is the first image slower?',
    answer:
      'The first run downloads the model, checks its checksum, and starts ONNX Runtime. Later visits reuse the cached model (Cache API and IndexedDB) and only spend time on the cutout itself.',
  },
  {
    question: 'Does it use WebGPU or the CPU?',
    answer:
      'The page prefers WebGPU when the browser provides a working adapter, and otherwise uses WASM on the CPU with a single thread. Both paths produce a transparent PNG. WebGPU availability depends on your browser and device.',
  },
  {
    question: 'Which files are supported?',
    answer:
      'JPEG, PNG, and WebP up to 12 MB. Each side must be 8,192 pixels or less. The result is a PNG at the original resolution with a transparent background. HEIC and GIF are not accepted.',
  },
  {
    question: 'How good are the edges?',
    answer:
      'The model is ISNet, quantized to int8, and it looks at a 1024×1024 stretch of the image. Hair, glass, motion blur, and busy backgrounds can be imperfect. Try a tighter crop if the matte looks wrong.',
  },
  {
    question: 'Do you store images or set tracking cookies?',
    answer:
      'The app does not store your image and does not set analytics cookies. The model weights may remain in browser storage until you clear site data. The host (Cloudflare) can still log ordinary requests for the page and the model file, including IP addresses. See the privacy policy for the exact boundary.',
  },
  {
    question: 'Can I use the cutout commercially?',
    answer:
      'You must have the rights to the images you process. The ISNet weights are Apache-2.0. This page does not claim ownership of your result. This is not legal advice.',
  },
] as const;

export const steps = [
  {
    title: 'Choose an image',
    text: 'Drop a JPEG, PNG, or WebP, or browse for one. Nothing is uploaded when you pick the file.',
  },
  {
    title: 'Wait for the on-device model',
    text: 'The first visit downloads the ISNet int8 model from the configured host and caches it. After that, the cutout starts immediately.',
  },
  {
    title: 'Download a transparent PNG',
    text: 'Compare the original and the cutout, then save a PNG at the original resolution. Use Replace to try another image.',
  },
] as const;
