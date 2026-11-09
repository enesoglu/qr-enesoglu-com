import type { Fill } from '../types';

export function color(value: string): string {
  if (!/^#[\da-f]{6}$/i.test(value))
    throw new Error('Colors must use #rrggbb notation.');
  return value;
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

export function svgFill(
  fill: Fill,
  idPrefix: string,
  margin: number,
  size: number,
): { fill: string; defs: string } {
  if (fill.type === 'solid') return { fill: color(fill.color), defs: '' };
  const id = `${idPrefix}-fill`;
  const center = margin + size / 2;
  const stops = fill.stops
    .map((stop) => {
      if (!Number.isFinite(stop.offset) || stop.offset < 0 || stop.offset > 1)
        throw new Error('Gradient offsets must be between 0 and 1.');
      return `<stop offset="${stop.offset}" stop-color="${color(stop.color)}"/>`;
    })
    .join('');
  let gradient: string;
  if (fill.type === 'linear') {
    if (!Number.isFinite(fill.rotation))
      throw new Error('Gradient rotation must be finite.');
    gradient = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${margin}" y1="${center}" x2="${margin + size}" y2="${center}" gradientTransform="rotate(${fill.rotation} ${center} ${center})">${stops}</linearGradient>`;
  } else {
    gradient = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${center}" cy="${center}" r="${size / 2}">${stops}</radialGradient>`;
  }
  return { fill: `url(#${id})`, defs: `<defs>${gradient}</defs>` };
}
