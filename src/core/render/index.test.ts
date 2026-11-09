import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN } from '../defaults';
import { QrDataTooLongError, renderSvg } from './index';

function decode(svg: string): string | undefined {
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: 512 },
  }).render();
  return jsQR(new Uint8ClampedArray(image.pixels), image.width, image.height)
    ?.data;
}

describe('baseline SVG rendering', () => {
  it('round-trips encoded data through rasterization and decoding', () => {
    expect(decode(renderSvg('https://example.com', DEFAULT_DESIGN))).toBe(
      'https://example.com',
    );
  });
  it('supports separate solid corner colors', () => {
    expect(
      decode(
        renderSvg('Hello, world!', {
          ...DEFAULT_DESIGN,
          cornerFrame: { shape: 'square', color: '#123456' },
          cornerDot: { shape: 'square', color: '#654321' },
        }),
      ),
    ).toBe('Hello, world!');
  });
  it('preserves transparency and the requested quiet zone', () => {
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
    expect(image.width).toBe(256);
    expect([...image.pixels].filter((_, index) => index % 4 === 3)).toContain(
      0,
    );
  });
  it('rejects SVG attribute injection in colors', () => {
    expect(() =>
      renderSvg('test', {
        ...DEFAULT_DESIGN,
        body: {
          shape: 'square',
          fill: { type: 'solid', color: '" onload="alert(1)' },
        },
      }),
    ).toThrow('Colors must');
  });
  it('reports excessive data with a typed error', () => {
    expect(() => renderSvg('x'.repeat(10000), DEFAULT_DESIGN)).toThrow(
      QrDataTooLongError,
    );
  });
});
