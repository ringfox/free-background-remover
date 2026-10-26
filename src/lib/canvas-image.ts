import { MODEL_INPUT_SIZE } from './limits';

export async function decodeImageFile(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the element decoder for browsers that reject the blob.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The browser could not decode that image.'));
    });
    image.src = url;
    const element = await loaded;
    return await createImageBitmap(element);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readModelInput(source: CanvasImageSource, size = MODEL_INPUT_SIZE): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot read pixels from a canvas.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, size, size);
  return context.getImageData(0, 0, size, size);
}

/**
 * Draw the original image, then apply the 1024 matte with destination-in.
 * The matte is scaled to the original width and height.
 */
export function compositeToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  alpha: Uint8Array,
  modelSize = MODEL_INPUT_SIZE,
): HTMLCanvasElement {
  if (alpha.length !== modelSize * modelSize) {
    throw new Error(`Expected a ${modelSize}×${modelSize} matte, received ${alpha.length} samples.`);
  }
  const matte = document.createElement('canvas');
  matte.width = modelSize;
  matte.height = modelSize;
  const matteContext = matte.getContext('2d');
  if (!matteContext) throw new Error('This browser cannot build the cutout mask.');
  const mask = matteContext.createImageData(modelSize, modelSize);
  for (let i = 0; i < alpha.length; i++) {
    const offset = i * 4;
    mask.data[offset] = 255;
    mask.data[offset + 1] = 255;
    mask.data[offset + 2] = 255;
    mask.data[offset + 3] = alpha[i];
  }
  matteContext.putImageData(mask, 0, 0);

  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) throw new Error('This browser cannot composite the transparent PNG.');
  context.drawImage(source, 0, 0, width, height);
  context.globalCompositeOperation = 'destination-in';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(matte, 0, 0, width, height);
  return output;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not encode the transparent PNG.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}
