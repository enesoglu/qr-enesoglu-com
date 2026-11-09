import QRCode from 'qrcode';
import type { ErrorCorrectionLevel } from '../types';

export interface QrMatrix {
  size: number;
  isDark(row: number, col: number): boolean;
}

export class QrDataTooLongError extends Error {
  constructor(level: ErrorCorrectionLevel = 'M', options?: ErrorOptions) {
    super(
      `The content is too long for a QR code at error correction level ${level}.`,
      options,
    );
    this.name = 'QrDataTooLongError';
  }
}

export function createMatrix(
  data: string,
  level: ErrorCorrectionLevel,
): QrMatrix {
  if (!data) throw new Error('Enter some content to generate a QR code.');
  try {
    const { modules } = QRCode.create(data, { errorCorrectionLevel: level });
    return {
      size: modules.size,
      isDark: (row, col) =>
        row >= 0 &&
        col >= 0 &&
        row < modules.size &&
        col < modules.size &&
        !!modules.get(row, col),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /amount of data is too big|cannot contain this amount of data/i.test(
        error.message,
      )
    ) {
      throw new QrDataTooLongError(level, { cause: error });
    }
    throw error;
  }
}

export function isFinder(size: number, row: number, col: number): boolean {
  return (
    (row < 7 && (col < 7 || col >= size - 7)) || (row >= size - 7 && col < 7)
  );
}
