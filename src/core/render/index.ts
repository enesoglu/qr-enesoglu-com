import type {
  BodyShape,
  CornerDotShape,
  CornerFrameShape,
  QrDesign,
} from '../types';
import { createMatrix } from './matrix';
import {
  bodyModule,
  bodyPath,
  cornerDotPath,
  cornerFramePath,
  logoBox,
} from './shapes';
import { color, escapeAttribute, svgFill } from './fill';
export { QrDataTooLongError } from './matrix';

export function renderSvg(
  data: string,
  design: QrDesign,
  opts?: { idPrefix?: string; sizePx?: number },
): string {
  if (
    !Number.isInteger(design.margin) ||
    design.margin < 0 ||
    design.margin > 10
  )
    throw new Error('The quiet zone must be an integer from 0 to 10.');
  const pixels = opts?.sizePx ?? 1024;
  if (!Number.isInteger(pixels) || pixels <= 0)
    throw new Error('Image size must be a positive integer.');
  const prefix = opts?.idPrefix ?? 'qr';
  if (!/^[a-zA-Z_][\w.-]*$/.test(prefix))
    throw new Error('ID prefix must be a valid SVG identifier.');
  const matrix = createMatrix(data, design.errorCorrection);
  const { size } = matrix;
  const margin = design.margin;
  const extent = size + margin * 2;
  const paint = svgFill(design.body.fill, prefix, margin, size);
  const box = design.logo ? logoBox(size, margin, design.logo) : undefined;
  const cleared =
    box && design.logo?.clearModules
      ? { box, padding: design.logo.padding }
      : undefined;
  const background = design.background.transparent
    ? ''
    : `<rect width="${extent}" height="${extent}" fill="${color(design.background.color)}"/>`;
  const body = `<path data-qr-body="true" fill="${paint.fill}"${design.body.shape === 'square' ? ' shape-rendering="crispEdges"' : ''} d="${bodyPath(matrix, design.body.shape, margin, cleared)}"/>`;
  const frameFill =
    design.cornerFrame.color === null
      ? paint.fill
      : color(design.cornerFrame.color);
  const dotFill =
    design.cornerDot.color === null
      ? paint.fill
      : color(design.cornerDot.color);
  const corners = [
    [margin, margin],
    [margin + size - 7, margin],
    [margin, margin + size - 7],
  ]
    .map(
      ([x, y]) =>
        `<path fill="${frameFill}" fill-rule="evenodd" d="${cornerFramePath(design.cornerFrame.shape, x, y)}"/><path fill="${dotFill}" d="${cornerDotPath(design.cornerDot.shape, x + 2, y + 2)}"/>`,
    )
    .join('');
  let logo = '';
  if (box && design.logo) {
    if (
      !/^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;charset=[\w-]+)?(?:;base64)?,/i.test(
        design.logo.src,
      )
    )
      throw new Error('Logo must be an embedded image data URL.');
    logo = `<image href="${escapeAttribute(design.logo.src)}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  // Small, non-content metadata lets the browser scan wrapper explain design risks.
  const colors = [
    ...(design.body.fill.type === 'solid'
      ? [design.body.fill.color]
      : design.body.fill.stops.map((stop) => stop.color)),
    frameFill,
    dotFill,
  ]
    .filter((value) => value.startsWith('#'))
    .map(color);
  const metadata = `data-qr-colors="${colors.join(',')}" data-qr-background="${color(design.background.color)}" data-qr-transparent="${design.background.transparent}" data-qr-margin="${margin}" data-qr-ecc="${design.errorCorrection}" data-qr-logo-size="${box ? box.width / size : 0}" data-qr-logo-height="${box ? box.height / size : 0}" data-qr-logo-padding="${design.logo?.clearModules ? design.logo.padding / size : 0}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${extent} ${extent}" ${metadata}>${paint.defs}${background}${body}${corners}${logo}</svg>`;
}

type PreviewOptions = { sizePx?: number; color?: string; idPrefix?: string };
export function renderShapePreview(
  kind: 'body',
  shape: BodyShape,
  opts?: PreviewOptions,
): string;
export function renderShapePreview(
  kind: 'cornerFrame',
  shape: CornerFrameShape,
  opts?: PreviewOptions,
): string;
export function renderShapePreview(
  kind: 'cornerDot',
  shape: CornerDotShape,
  opts?: PreviewOptions,
): string;
export function renderShapePreview(
  kind: 'body' | 'cornerFrame' | 'cornerDot',
  shape: BodyShape | CornerFrameShape | CornerDotShape,
  opts?: PreviewOptions,
): string {
  const size = opts?.sizePx ?? 48;
  if (!Number.isInteger(size) || size <= 0)
    throw new Error('Image size must be a positive integer.');
  let path: string;
  if (kind === 'body') {
    path = '';
    for (let y = 2; y < 7; y++)
      for (let x = 2; x < 7; x++) {
        path += bodyModule(shape as BodyShape, x, y, [
          y > 2,
          x < 6,
          y < 6,
          x > 2,
        ]);
      }
  } else if (kind === 'cornerFrame')
    path = cornerFramePath(shape as CornerFrameShape, 1, 1);
  else path = cornerDotPath(shape as CornerDotShape, 3, 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 9 9"${opts?.idPrefix ? ` id="${escapeAttribute(opts.idPrefix)}"` : ''}><path fill="${color(opts?.color ?? '#000000')}" fill-rule="${kind === 'cornerFrame' ? 'evenodd' : 'nonzero'}" d="${path}"/></svg>`;
}
