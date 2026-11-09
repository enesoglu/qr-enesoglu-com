import { NotImplementedError } from '../errors';
import type { ImageDataLike, ScanResult } from '../types';

export function decodeImageData(_img: ImageDataLike): string | null {
  throw new NotImplementedError('Image decoding');
}

export function contrastRatio(_a: string, _b: string): number {
  throw new NotImplementedError('Contrast calculation');
}

export async function checkScannability(
  _svg: string,
  _expected: string,
): Promise<ScanResult> {
  throw new NotImplementedError('Scannability check');
}
