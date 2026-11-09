/** Rasterize locally; object URLs never leave the browser. */
export async function svgToPngBlob(svg: string, sizePx: number): Promise<Blob> {
  if (!Number.isInteger(sizePx) || sizePx <= 0)
    throw new Error('Image size must be a positive integer.');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load the SVG image.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, sizePx, sizePx);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('PNG export failed.')),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The same module is the worker entry so browser rasterization stays in this file.
if (
  typeof document === 'undefined' &&
  typeof self !== 'undefined' &&
  'importScripts' in self
) {
  self.onmessage = async (
    event: MessageEvent<{ bitmap: ImageBitmap; sizePx: number }>,
  ) => {
    const { bitmap, sizePx } = event.data;
    try {
      const canvas = new OffscreenCanvas(sizePx, sizePx);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Worker canvas unavailable.');
      context.imageSmoothingEnabled = false;
      context.drawImage(bitmap, 0, 0, sizePx, sizePx);
      self.postMessage({
        blob: await canvas.convertToBlob({ type: 'image/png' }),
      });
    } catch (error) {
      self.postMessage({
        error:
          error instanceof Error
            ? error.message
            : 'Worker rasterization failed.',
      });
    } finally {
      bitmap.close();
    }
  };
}

/** One worker per batch; SVG image loading stays on the main thread for compatibility. */
export function createBatchRasterizer(signal: AbortSignal): {
  rasterize: typeof svgToPngBlob;
  dispose: () => void;
} {
  let worker: Worker | null = null;
  let rejectPending: ((error: Error) => void) | null = null;
  function dispose() {
    worker?.terminate();
    worker = null;
    rejectPending?.(new Error('Rasterization stopped.'));
    rejectPending = null;
    signal.removeEventListener('abort', dispose);
  }
  try {
    if (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap !== 'undefined'
    )
      worker = new Worker(new URL('./png.ts', import.meta.url), {
        type: 'module',
      });
  } catch {
    /* Fall back when workers are unavailable or blocked. */
  }
  signal.addEventListener('abort', dispose, { once: true });
  return {
    dispose,
    rasterize: async (svg, sizePx) => {
      if (signal.aborted) throw new Error('Rasterization stopped.');
      if (!worker) return svgToPngBlob(svg, sizePx);
      const url = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml' }),
      );
      let bitmap: ImageBitmap | undefined;
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(new Error('Unable to load the SVG image.'));
          image.src = url;
        });
        bitmap = await createImageBitmap(image);
        if (signal.aborted) throw new Error('Rasterization stopped.');
        const current = worker;
        if (!current) return svgToPngBlob(svg, sizePx);
        const transferable = bitmap;
        return await new Promise<Blob>((resolve, reject) => {
          rejectPending = reject;
          current.onmessage = (
            event: MessageEvent<{ blob?: Blob; error?: string }>,
          ) => {
            rejectPending = null;
            if (event.data.blob) resolve(event.data.blob);
            else
              reject(
                new Error(event.data.error ?? 'Worker rasterization failed.'),
              );
          };
          current.onerror = () => {
            rejectPending = null;
            reject(new Error('Worker rasterization failed.'));
          };
          current.postMessage({ bitmap: transferable, sizePx }, [transferable]);
        });
      } catch (error) {
        dispose();
        if (signal.aborted) throw error;
        return svgToPngBlob(svg, sizePx);
      } finally {
        URL.revokeObjectURL(url);
        bitmap?.close();
      }
    },
  };
}
