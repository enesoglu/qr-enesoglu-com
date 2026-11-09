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
