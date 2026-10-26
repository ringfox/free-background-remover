import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { canvasToPngBlob, compositeToCanvas, decodeImageFile, readModelInput } from '../lib/canvas-image';
import { configuredModelBaseUrl, configuredOrtBaseUrl } from '../lib/config';
import { CancelledError, createInferenceClient, mockInferenceAllowed, type EngineName } from '../lib/inference-client';
import { MAX_EDGE_PX, MAX_FILE_BYTES, formatMegabytes } from '../lib/limits';
import { validateDimensions, validateImageSelection } from '../lib/validate-image';

type Phase = 'idle' | 'working' | 'done' | 'error';

function outputName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim() || 'image';
  return `${base}-transparent.png`;
}

function engineLabel(ep: EngineName): string {
  return ep === 'webgpu' ? 'WebGPU' : 'WASM';
}

export default function BackgroundRemover() {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const clientRef = useRef<ReturnType<typeof createInferenceClient> | null>(null);
  const generation = useRef(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('Your image stays in this browser. The model downloads only after you choose a file.');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileLabel, setFileLabel] = useState('');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('transparent.png');
  const [engine, setEngine] = useState<EngineName | null>(null);
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    rootRef.current?.setAttribute('data-hydrated', 'true');
    const prevent = (event: globalThis.DragEvent) => event.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  async function processFile(file: File) {
    const token = ++generation.current;
    const stale = () => token !== generation.current;
    setPhase('working');
    setError('');
    setEngine(null);
    setResultUrl(null);
    setProgress(null);
    setMessage('Reading the image…');
    setFileLabel(file.name);
    fileRef.current = file;
    setHasFile(true);

    let bitmap: ImageBitmap | null = null;
    try {
      const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (stale()) return;
      const valid = validateImageSelection({ name: file.name, size: file.size }, header);
      if (!valid.ok) throw new Error(valid.message);

      bitmap = await decodeImageFile(file);
      if (stale()) return;
      const dimensions = validateDimensions(bitmap.width, bitmap.height);
      if (!dimensions.ok) throw new Error(dimensions.message);

      const nextOriginal = URL.createObjectURL(file);
      if (stale()) {
        URL.revokeObjectURL(nextOriginal);
        return;
      }
      setOriginalUrl(nextOriginal);

      const mock =
        mockInferenceAllowed() && new URLSearchParams(window.location.search).get('mock') === '1';
      const baseUrl = configuredModelBaseUrl();
      const ortBaseUrl = configuredOrtBaseUrl();

      const input = readModelInput(bitmap);
      const pixels = new Uint8Array(input.data);
      if (!clientRef.current) clientRef.current = createInferenceClient();
      const { done } = clientRef.current.process({
        baseUrl,
        ortBaseUrl,
        pixels,
        width: input.width,
        height: input.height,
        mock,
        onProgress: (update) => {
          if (stale()) return;
          setMessage(update.cached ? `${update.message} (cached)` : update.message);
          setProgress(update.total > 0 ? Math.max(0, Math.min(100, Math.round((update.loaded / update.total) * 100))) : null);
        },
      });
      const result = await done;
      if (stale()) return;

      setMessage('Building the transparent PNG…');
      const canvas = compositeToCanvas(bitmap, bitmap.width, bitmap.height, result.alpha, input.width);
      const blob = await canvasToPngBlob(canvas);
      if (stale()) return;
      setResultUrl(URL.createObjectURL(blob));
      setDownloadName(outputName(file.name));
      setEngine(result.ep);
      setProgress(100);
      setPhase('done');
      setMessage('Background removed. The PNG keeps the original resolution.');
    } catch (caught) {
      if (stale() || caught instanceof CancelledError) return;
      const text = caught instanceof Error ? caught.message : 'Something went wrong while removing the background.';
      setPhase('error');
      setProgress(null);
      setError(text);
      setMessage('The image was not uploaded.');
    } finally {
      bitmap?.close();
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void processFile(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function retry() {
    if (fileRef.current) void processFile(fileRef.current);
  }

  function cancel() {
    generation.current += 1;
    clientRef.current?.dispose();
    clientRef.current = null;
    setPhase('idle');
    setProgress(null);
    setError('');
    setMessage('Cancelled. The image stayed on this device.');
  }

  const showPreview = Boolean(originalUrl || resultUrl);

  return (
    <div className="tool" ref={rootRef} data-hydrated="false" aria-busy={phase === 'working'}>
      <div className="tool-heading">
        <h2 id="tool-title">Remove a background</h2>
        <p>JPEG, PNG, or WebP · up to {formatMegabytes(MAX_FILE_BYTES)} · longest side {MAX_EDGE_PX.toLocaleString('en-US')} px</p>
      </div>

      <label
        className={dragOver ? 'dropzone is-over' : 'dropzone'}
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={onInputChange}
        />
        <span className="dropzone-title">Drop an image here</span>
        <span className="dropzone-action">or browse files</span>
        <span className="dropzone-note">The model stays unloaded until you add an image.</span>
      </label>

      <p className="status" role="status" aria-live="polite">
        {message}
        {fileLabel && phase !== 'idle' ? ` · ${fileLabel}` : ''}
      </p>

      {phase === 'working' && (
        <div
          className={progress == null ? 'progress is-indeterminate' : 'progress'}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ?? undefined}
          aria-label={message}
        >
          <span style={{ width: `${progress ?? 35}%` }} />
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {showPreview && (
        <div className="preview-grid">
          <figure>
            <figcaption>Before</figcaption>
            {originalUrl ? (
              <img src={originalUrl} alt="Original image before background removal" />
            ) : (
              <div className="preview-empty">No preview yet</div>
            )}
          </figure>
          <figure>
            <figcaption>After · transparent PNG</figcaption>
            <div className="checker">
              {resultUrl ? (
                <img src={resultUrl} alt="Image with the background removed" />
              ) : (
                <div className="preview-empty">{phase === 'working' ? 'Working…' : 'Cutout will appear here'}</div>
              )}
            </div>
          </figure>
        </div>
      )}

      <div className="actions">
        {resultUrl && phase === 'done' && (
          <a className="button primary" href={resultUrl} download={downloadName}>
            Download transparent PNG
          </a>
        )}
        {phase === 'working' && (
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel
          </button>
        )}
        {hasFile && phase !== 'working' && (
          <button type="button" className="button secondary" onClick={retry}>
            Retry
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          onClick={() => inputRef.current?.click()}
          disabled={phase === 'working'}
        >
          {fileLabel ? 'Replace image' : 'Browse files'}
        </button>
      </div>

      {engine && phase === 'done' && (
        <p className="engine-note">
          Ran on {engineLabel(engine)} in this browser.
          {engine === 'wasm' ? ' WebGPU is used only when the browser exposes a working adapter.' : ''}
        </p>
      )}
    </div>
  );
}
