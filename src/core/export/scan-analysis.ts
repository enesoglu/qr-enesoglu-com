import type { ErrorCorrectionLevel } from '../types';

export function relativeLuminance(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex))
    throw new Error('Colors must use #rrggbb notation.');
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export interface ScanDesign {
  colors: string[];
  background: string;
  transparent: boolean;
  margin: number;
  errorCorrection: ErrorCorrectionLevel;
  logoWidth: number;
  logoHeight: number;
  logoPadding: number;
}

/** Pure diagnostics; dimensions are fractions of the encoded matrix width. */
export function analyzeScanDesign(design: ScanDesign): {
  contrastRatio: number;
  warnings: string[];
} {
  const background = design.transparent ? '#ffffff' : design.background;
  const ratio = Math.min(
    ...design.colors.map((value) => contrastRatio(value, background)),
  );
  const warnings: string[] = [];
  if (ratio < 3)
    warnings.push(
      'Low contrast: use at least a 3:1 contrast ratio for reliable scanning.',
    );
  if (
    design.colors.some(
      (value) => relativeLuminance(value) > relativeLuminance(background),
    )
  )
    warnings.push(
      'The foreground is lighter than the background; many scanners expect a dark code on a light surface.',
    );
  if (design.transparent)
    warnings.push('The transparent code needs a light surface behind it.');
  if (design.margin < 2)
    warnings.push(
      'The quiet zone is below 2 modules; increase the margin around the code.',
    );
  const recommended = { L: 0.1, M: 0.15, Q: 0.2, H: 0.25 }[
    design.errorCorrection
  ];
  if (
    Math.max(design.logoWidth, design.logoHeight) + 2 * design.logoPadding >
    recommended
  )
    warnings.push(
      `The logo or its cleared area is larger than recommended for error correction level ${design.errorCorrection}. Reduce the logo or use stronger error correction.`,
    );
  return { contrastRatio: ratio, warnings };
}
