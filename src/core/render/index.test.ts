import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN } from '../defaults';
import type {
  BodyShape,
  CornerDotShape,
  CornerFrameShape,
  Fill,
  QrDesign,
} from '../types';
import jsQR from 'jsqr';
import { QrDataTooLongError, renderShapePreview, renderSvg } from './index';
import { createMatrix, isFinder } from './matrix';
import { bodyPath, insideLogo, logoBox } from './shapes';

function decode(svg: string): string | null {
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: 600 },
    background: '#ffffff',
  }).render();
  return (
    jsQR(new Uint8ClampedArray(image.pixels), image.width, image.height, {
      inversionAttempts: 'attemptBoth',
    })?.data ?? null
  );
}

const bodies: BodyShape[] = ['square', 'rounded', 'dot', 'diamond', 'fluid'];
const frames: CornerFrameShape[] = ['square', 'rounded', 'circle'];
const dots: CornerDotShape[] = ['square', 'rounded', 'circle', 'diamond'];
const fills: Fill[] = [
  { type: 'solid', color: '#102030' },
  {
    type: 'linear',
    rotation: 35,
    stops: [
      { offset: 0, color: '#000000' },
      { offset: 1, color: '#304060' },
    ],
  },
  {
    type: 'radial',
    stops: [
      { offset: 0, color: '#304060' },
      { offset: 1, color: '#000000' },
    ],
  },
];
const logo = {
  src:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="white"/><circle cx="20" cy="20" r="12" fill="#304060"/></svg>',
    ),
  size: 0.25,
  aspectRatio: 1,
  padding: 0,
  clearModules: true,
};

describe('designed SVG rendering', () => {
  // Cover every body/dot and body/frame pair with representative finder designs.
  const cases = bodies.flatMap((body) => [
    ...dots.map((dot) => ({
      body,
      frame: (dot === 'circle' || dot === 'diamond'
        ? 'circle'
        : 'rounded') as CornerFrameShape,
      dot,
    })),
    ...frames.map((frame) => ({
      body,
      frame,
      dot: (frame === 'circle' ? 'circle' : 'rounded') as CornerDotShape,
    })),
  ]);
  for (const { body, frame, dot } of cases) {
    for (const [index, fill] of fills.entries()) {
      it(`decodes ${body}/${frame}/${dot}/${fill.type} with and without a logo`, () => {
        for (const hasLogo of [false, true]) {
          const design: QrDesign = {
            ...DEFAULT_DESIGN,
            errorCorrection: 'H',
            body: { shape: body, fill },
            cornerFrame: { shape: frame, color: null },
            cornerDot: { shape: dot, color: null },
            background: { color: '#ffffff', transparent: index % 2 === 1 },
            logo: hasLogo ? logo : null,
          };
          expect(
            decode(renderSvg('https://example.com/qr?hello=world', design)),
          ).toBe('https://example.com/qr?hello=world');
        }
      });
    }
  }
  it.each(['Türkçe: ığüşöç İĞÜŞÖÇ 👋🌍', 'x'.repeat(1200)])(
    'round-trips UTF-8 and near-capacity H content',
    (text) => {
      expect(
        decode(
          renderSvg(text, {
            ...DEFAULT_DESIGN,
            margin: text.length > 1000 ? 9 : 4,
            errorCorrection: 'H',
          }),
        ),
      ).toBe(text);
    },
  );
  it('reports capacity failures with the selected ECC level', () => {
    expect(() => createMatrix('x'.repeat(10000), 'H')).toThrow(
      QrDataTooLongError,
    );
    expect(() => createMatrix('x'.repeat(10000), 'H')).toThrow('level H');
    expect(() => createMatrix('', 'M')).toThrow('Enter some content');
  });
  it('supports separate corner colors', () => {
    expect(
      decode(
        renderSvg('corner colors', {
          ...DEFAULT_DESIGN,
          cornerFrame: { shape: 'rounded', color: '#123456' },
          cornerDot: { shape: 'circle', color: '#654321' },
        }),
      ),
    ).toBe('corner colors');
  });
  it('emits a single body path, default dimensions and deterministic scoped gradients', () => {
    const design = {
      ...DEFAULT_DESIGN,
      body: { shape: 'square' as const, fill: fills[1] },
    };
    const svg = renderSvg('test', design, { idPrefix: 'first' });
    expect(svg).toBe(renderSvg('test', design, { idPrefix: 'first' }));
    expect(svg.match(/data-qr-body=/g)).toHaveLength(1);
    expect(svg).toContain('width="1024" height="1024"');
    expect(svg).toContain('id="first-fill"');
    expect(svg).toContain('url(#first-fill)');
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    expect(renderSvg('test', design, { idPrefix: 'second' })).not.toContain(
      'first-fill',
    );
  });
  it('preserves transparent pixels and module-unit margins', () => {
    const svg = renderSvg(
      'test',
      {
        ...DEFAULT_DESIGN,
        margin: 0,
        background: { color: '#ffffff', transparent: true },
      },
      { sizePx: 256 },
    );
    const image = new Resvg(svg).render();
    expect(svg).toContain('viewBox="0 0 21 21"');
    expect(svg).not.toContain('<rect');
    expect(image.width).toBe(256);
    expect([...image.pixels].filter((_, index) => index % 4 === 3)).toContain(
      0,
    );
  });
  it('merges consecutive square modules into horizontal runs', () => {
    const path = bodyPath(
      {
        size: 21,
        isDark: (row, col) => row === 10 && [8, 9, 10, 12].includes(col),
      },
      'square',
      4,
    );
    expect(path).toBe('M12 14h3v1h-3zM16 14h1v1h-1z');
  });
  it('isolates exactly the three finder regions', () => {
    expect(isFinder(21, 6, 6)).toBe(true);
    expect(isFinder(21, 0, 14)).toBe(true);
    expect(isFinder(21, 14, 0)).toBe(true);
    expect(isFinder(21, 7, 0)).toBe(false);
    expect(isFinder(21, 14, 14)).toBe(false);
    const matrix = createMatrix('matrix', 'M');
    expect(matrix.isDark(-1, 0)).toBe(false);
    expect(matrix.isDark(matrix.size, 0)).toBe(false);
  });
  it('clamps logo width and uses module centres for padded clearing', () => {
    const box = logoBox(100, 4, { ...logo, size: 1, aspectRatio: 2 });
    expect(box).toEqual({ x: 39, y: 46.5, width: 30, height: 15 });
    expect(logoBox(100, 4, { ...logo, size: 0 }).width).toBe(10);
    expect(insideLogo(38.5, 46, box, 0)).toBe(false);
    expect(insideLogo(38.5, 46, box, 1)).toBe(true);
    const matrix = {
      size: 21,
      isDark: (row: number, col: number) => row === 10 && col >= 8 && col <= 12,
    };
    expect(
      bodyPath(matrix, 'square', 0, {
        box: { x: 9, y: 10, width: 2, height: 1 },
        padding: 0,
      }),
    ).toBe('M8 10h1v1h-1zM11 10h2v1h-2z');
    const svg = renderSvg('logo', {
      ...DEFAULT_DESIGN,
      logo: { ...logo, padding: 4, aspectRatio: 0.1 },
    });
    expect(svg.match(/fill-rule="evenodd"/g)).toHaveLength(3);
    expect(svg).toContain('<image href="data:image/svg+xml,');
    expect(svg).not.toContain('<circle');
    expect(svg).toContain('data-qr-ecc="M"');
  });
  it('fluid modules keep shared edges straight and round exposed corners', () => {
    const matrix = {
      size: 21,
      isDark: (row: number, col: number) =>
        row === 10 && (col === 9 || col === 10),
    };
    const path = bodyPath(matrix, 'fluid', 0);
    expect(path.match(/a0.45/g)).toHaveLength(4);
  });
  it('reuses drawing code for all thumbnails', () => {
    for (const body of bodies)
      expect(renderShapePreview('body', body)).toContain('viewBox="0 0 9 9"');
    for (const frame of frames)
      expect(renderShapePreview('cornerFrame', frame)).toContain(
        'fill-rule="evenodd"',
      );
    for (const dot of dots)
      expect(renderShapePreview('cornerDot', dot, { sizePx: 32 })).toContain(
        'width="32"',
      );
  });
  it('rejects invalid dimensions, colors, identifiers and remote logos', () => {
    expect(() =>
      renderSvg('test', DEFAULT_DESIGN, { idPrefix: '" onload="bad' }),
    ).toThrow('identifier');
    expect(() => renderSvg('test', DEFAULT_DESIGN, { sizePx: -1 })).toThrow(
      'positive integer',
    );
    expect(() => renderSvg('test', { ...DEFAULT_DESIGN, margin: 1.5 })).toThrow(
      'quiet zone',
    );
    expect(() =>
      renderSvg('test', {
        ...DEFAULT_DESIGN,
        body: {
          shape: 'square',
          fill: { type: 'solid', color: '" onload="alert(1)' },
        },
      }),
    ).toThrow('Colors must');
    expect(() =>
      renderSvg('test', {
        ...DEFAULT_DESIGN,
        logo: { ...logo, src: 'https://example.com/logo.png' },
      }),
    ).toThrow('embedded');
  });
});
