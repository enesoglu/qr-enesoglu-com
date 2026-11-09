import jsQR from 'jsqr';
import type { ErrorCorrectionLevel, ImageDataLike, ScanResult } from '../types';
import { analyzeScanDesign } from './scan-analysis';
export { contrastRatio } from './scan-analysis';

export function decodeImageData(img: ImageDataLike): string | null {
  return (
    jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
      ?.data ?? null
  );
}

/** Inspect SVGs produced by renderSvg. All rasterization stays in this browser. */
export async function checkScannability(
  svg: string,
  expected: string,
): Promise<ScanResult> {
  const root = new DOMParser().parseFromString(
    svg,
    'image/svg+xml',
  ).documentElement;
  if (root.localName !== 'svg' || root.querySelector('parsererror'))
    throw new Error('Unable to read the SVG image.');
  const colors = root.getAttribute('data-qr-colors')?.split(',') ?? [];
  const ecc = root.getAttribute('data-qr-ecc');
  const hasMetadata =
    colors.length > 0 && ecc !== null && ['L', 'M', 'Q', 'H'].includes(ecc);
  const diagnostics = hasMetadata
    ? analyzeScanDesign({
        colors,
        background: root.getAttribute('data-qr-background') ?? '#ffffff',
        transparent: root.getAttribute('data-qr-transparent') === 'true',
        margin: Number(root.getAttribute('data-qr-margin')),
        errorCorrection: ecc as ErrorCorrectionLevel,
        logoWidth: Number(root.getAttribute('data-qr-logo-size')),
        logoHeight: Number(root.getAttribute('data-qr-logo-height')),
        logoPadding: Number(root.getAttribute('data-qr-logo-padding')),
      })
    : {
        contrastRatio: 0,
        warnings: [
          'Design metadata is unavailable; contrast, logo size and quiet zone could not be checked.',
        ],
      };
  const size = 400;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  let decoded: string | null;
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load the SVG image.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    decoded = decodeImageData(context.getImageData(0, 0, size, size));
  } finally {
    URL.revokeObjectURL(url);
  }
  if (decoded === null)
    diagnostics.warnings.push(
      'The code could not be decoded at preview size. Try simpler shapes, stronger contrast or a smaller logo.',
    );
  else if (decoded !== expected)
    diagnostics.warnings.push(
      'The decoded content does not match the expected content.',
    );
  return {
    decodable: decoded !== null,
    matches: decoded === expected,
    ...diagnostics,
  };
}
