import QRCode from 'qrcode';
import type { QrDesign } from '../types';

export class QrDataTooLongError extends Error {
  constructor(options?: ErrorOptions) {
    super(
      'The content is too long for a QR code at this error correction level.',
      options,
    );
    this.name = 'QrDataTooLongError';
  }
}

function color(value: string): string {
  if (!/^#[\da-f]{6}$/i.test(value))
    throw new Error('Colors must use #rrggbb notation.');
  return value;
}

export function renderSvg(
  data: string,
  design: QrDesign,
  opts?: { idPrefix?: string; sizePx?: number },
): string {
  if (!data) throw new Error('Enter some content to generate a QR code.');
  if (
    !Number.isInteger(design.margin) ||
    design.margin < 0 ||
    design.margin > 10
  ) {
    throw new Error('The quiet zone must be an integer from 0 to 10.');
  }
  if (
    opts?.sizePx !== undefined &&
    (!Number.isInteger(opts.sizePx) || opts.sizePx <= 0)
  ) {
    throw new Error('Image size must be a positive integer.');
  }
  let code: ReturnType<typeof QRCode.create>;
  try {
    code = QRCode.create(data, {
      errorCorrectionLevel: design.errorCorrection,
    });
  } catch (error) {
    // qrcode reports capacity overflow as a plain Error; preserve unrelated failures.
    if (
      error instanceof Error &&
      /amount of data is too big|cannot contain this amount of data/i.test(
        error.message,
      )
    ) {
      throw new QrDataTooLongError({ cause: error });
    }
    throw error;
  }
  const { size } = code.modules;
  const extent = size + design.margin * 2;
  const pixels = opts?.sizePx ?? extent;
  const bodyColor = color(
    design.body.fill.type === 'solid'
      ? design.body.fill.color
      : design.body.fill.stops[0].color,
  );
  const frameColor = color(design.cornerFrame.color ?? bodyColor);
  const dotColor = color(design.cornerDot.color ?? bodyColor);
  const paths = new Map<string, string[]>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!code.modules.get(row, col)) continue;
      let fill = bodyColor;
      for (const [x, y] of [
        [0, 0],
        [size - 7, 0],
        [0, size - 7],
      ]) {
        const dx = col - x;
        const dy = row - y;
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
          fill =
            dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4 ? dotColor : frameColor;
          break;
        }
      }
      const commands = paths.get(fill) ?? [];
      commands.push(`M${col + design.margin} ${row + design.margin}h1v1h-1z`);
      paths.set(fill, commands);
    }
  }
  const background = design.background.transparent
    ? ''
    : `<path fill="${color(design.background.color)}" d="M0 0h${extent}v${extent}H0z"/>`;
  const modules = [...paths]
    .map(
      ([fill, commands]) => `<path fill="${fill}" d="${commands.join('')}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges">${background}${modules}</svg>`;
}
