import type {
  BodyShape,
  CornerDotShape,
  CornerFrameShape,
  LogoOptions,
} from '../types';
import type { QrMatrix } from './matrix';
import { isFinder } from './matrix';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function logoBox(size: number, margin: number, logo: LogoOptions): Box {
  if (
    !Number.isFinite(logo.size) ||
    !Number.isFinite(logo.aspectRatio) ||
    logo.aspectRatio <= 0 ||
    !Number.isFinite(logo.padding) ||
    logo.padding < 0 ||
    logo.padding > 4
  ) {
    throw new Error(
      'Logo size, aspect ratio and padding must be valid finite numbers.',
    );
  }
  const width = size * Math.max(0.1, Math.min(0.3, logo.size));
  const height = width / logo.aspectRatio;
  return {
    x: margin + (size - width) / 2,
    y: margin + (size - height) / 2,
    width,
    height,
  };
}

export function insideLogo(
  x: number,
  y: number,
  box: Box,
  padding: number,
): boolean {
  return (
    x >= box.x - padding &&
    x <= box.x + box.width + padding &&
    y >= box.y - padding &&
    y <= box.y + box.height + padding
  );
}

export function rectangle(x: number, y: number, w: number, h = w): string {
  return `M${x} ${y}h${w}v${h}h${-w}z`;
}

// Corners are clockwise from top-left; a zero radius preserves connected edges.
function roundedBox(
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number[],
): string {
  const [tl, tr, br, bl] = radii;
  const arc = (r: number, dx: number, dy: number) =>
    r ? `a${r} ${r} 0 0 1 ${dx} ${dy}` : '';
  return `M${x + tl} ${y}H${x + w - tr}${arc(tr, tr, tr)}V${y + h - br}${arc(br, -br, br)}H${x + bl}${arc(bl, -bl, -bl)}V${y + tl}${arc(tl, tl, -tl)}z`;
}

function circle(x: number, y: number, diameter: number): string {
  const r = diameter / 2;
  return `M${x} ${y + r}a${r} ${r} 0 1 0 ${diameter} 0a${r} ${r} 0 1 0 ${-diameter} 0z`;
}

function diamond(x: number, y: number, size: number): string {
  const r = size / 2;
  return `M${x + r} ${y}l${r} ${r}l${-r} ${r}l${-r} ${-r}z`;
}

export function bodyModule(
  shape: BodyShape,
  x: number,
  y: number,
  neighbors = [false, false, false, false],
): string {
  switch (shape) {
    case 'square':
      return rectangle(x, y, 1);
    case 'rounded':
      return roundedBox(
        x + 0.04,
        y + 0.04,
        0.92,
        0.92,
        [0.22, 0.22, 0.22, 0.22],
      );
    case 'dot':
      return circle(x + 0.01, y + 0.01, 0.98);
    case 'diamond':
      return diamond(x - 0.15, y - 0.15, 1.3);
    case 'fluid': {
      const [top, right, bottom, left] = neighbors;
      return roundedBox(x, y, 1, 1, [
        !top && !left ? 0.45 : 0,
        !top && !right ? 0.45 : 0,
        !bottom && !right ? 0.45 : 0,
        !bottom && !left ? 0.45 : 0,
      ]);
    }
  }
}

export function bodyPath(
  matrix: QrMatrix,
  shape: BodyShape,
  margin: number,
  cleared?: { box: Box; padding: number },
): string {
  const visible = (row: number, col: number) =>
    row >= 0 &&
    col >= 0 &&
    row < matrix.size &&
    col < matrix.size &&
    !isFinder(matrix.size, row, col) &&
    matrix.isDark(row, col) &&
    (!cleared ||
      !insideLogo(
        col + margin + 0.5,
        row + margin + 0.5,
        cleared.box,
        cleared.padding,
      ));
  const paths: string[] = [];
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!visible(row, col)) continue;
      if (shape === 'square') {
        const start = col;
        while (visible(row, col + 1)) col++;
        paths.push(rectangle(start + margin, row + margin, col - start + 1, 1));
      } else {
        paths.push(
          bodyModule(shape, col + margin, row + margin, [
            visible(row - 1, col),
            visible(row, col + 1),
            visible(row + 1, col),
            visible(row, col - 1),
          ]),
        );
      }
    }
  }
  return paths.join('');
}

export function cornerFramePath(
  shape: CornerFrameShape,
  x: number,
  y: number,
): string {
  if (shape === 'circle') return circle(x, y, 7) + circle(x + 1, y + 1, 5);
  if (shape === 'rounded')
    return (
      roundedBox(x, y, 7, 7, [1.5, 1.5, 1.5, 1.5]) +
      roundedBox(x + 1, y + 1, 5, 5, [0.5, 0.5, 0.5, 0.5])
    );
  return rectangle(x, y, 7) + rectangle(x + 1, y + 1, 5);
}

export function cornerDotPath(
  shape: CornerDotShape,
  x: number,
  y: number,
): string {
  switch (shape) {
    case 'square':
      return rectangle(x, y, 3);
    case 'rounded':
      return roundedBox(x, y, 3, 3, [0.65, 0.65, 0.65, 0.65]);
    case 'circle':
      return circle(x, y, 3);
    case 'diamond':
      return diamond(x - 0.3, y - 0.3, 3.6);
  }
}
