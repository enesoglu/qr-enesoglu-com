import { strToU8, zip, type AsyncZippable } from 'fflate';
import type { BatchOptions, BatchRow } from '../types';
import { createFilenameAllocator } from './filenames';

function abortError(): Error {
  const error = new Error('Batch export was cancelled');
  error.name = 'AbortError';
  return error;
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** Reject promptly even when an injected asynchronous callback is still pending. */
function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener('abort', abort, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

function compress(files: AsyncZippable, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    checkAbort(signal);
    let terminate: (() => void) | undefined;
    const abort = () => {
      terminate?.();
      reject(abortError());
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      terminate = zip(files, (error, data) => {
        signal?.removeEventListener('abort', abort);
        if (signal?.aborted) reject(abortError());
        else if (error) reject(error);
        else
          resolve(
            new Blob([new Uint8Array(data).buffer], {
              type: 'application/zip',
            }),
          );
      });
    } catch (error) {
      signal?.removeEventListener('abort', abort);
      reject(error);
    }
  });
}

export async function createBatchZip(
  rows: BatchRow[],
  options: BatchOptions,
): Promise<Blob> {
  const { signal, onProgress } = options;
  checkAbort(signal);
  const files: AsyncZippable = Object.create(null) as AsyncZippable;
  const failures: string[] = [];
  const allocate = createFilenameAllocator(rows.length);
  onProgress?.(0, rows.length);
  for (const [index, row] of rows.entries()) {
    // Yield between renders so the browser can paint progress and deliver cancellation.
    await abortable(
      new Promise<void>((resolve) => setTimeout(resolve, 0)),
      signal,
    );
    checkAbort(signal);
    const filename = `${allocate(row.filename, index)}.${options.format}`;
    try {
      const svg = options.render(row.data);
      checkAbort(signal);
      if (options.format === 'svg') files[filename] = strToU8(svg);
      else {
        const blob = await abortable(
          options.rasterize(svg, options.sizePx),
          signal,
        );
        checkAbort(signal);
        files[filename] = new Uint8Array(
          await abortable(blob.arrayBuffer(), signal),
        );
      }
    } catch (error) {
      checkAbort(signal);
      const message =
        error instanceof Error ? error.message : 'Could not generate QR code';
      failures.push(`Line ${row.line ?? index + 1} (${filename}): ${message}`);
    }
    checkAbort(signal);
    onProgress?.(index + 1, rows.length);
  }
  checkAbort(signal);
  if (failures.length) files['errors.txt'] = strToU8(failures.join('\n'));
  return compress(files, signal);
}
