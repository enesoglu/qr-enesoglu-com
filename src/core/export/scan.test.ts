import { Resvg } from '@resvg/resvg-js';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DESIGN } from '../defaults';
import { renderSvg } from '../render';
import { svgToPngBlob } from './png';
import { checkScannability, contrastRatio, decodeImageData } from './scan';
import { analyzeScanDesign, type ScanDesign } from './scan-analysis';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string) => { window: { DOMParser: unknown } };
};

const base: ScanDesign = {
  colors: ['#000000'],
  background: '#ffffff',
  transparent: false,
  margin: 4,
  errorCorrection: 'M',
  logoWidth: 0,
  logoHeight: 0,
  logoPadding: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function browserHarness(svg: string, failure?: 'load' | 'context' | 'blob') {
  const bitmap = new Resvg(svg, {
    fitTo: { mode: 'width', value: 400 },
    background: '#ffffff',
  }).render();
  const context = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: () => ({
      data: new Uint8ClampedArray(bitmap.pixels),
      width: bitmap.width,
      height: bitmap.height,
    }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (failure === 'context' ? null : context),
    toBlob: (callback: (blob: Blob | null) => void) =>
      callback(
        failure === 'blob' ? null : new Blob(['png'], { type: 'image/png' }),
      ),
  };
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:local-test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() =>
          failure === 'load' ? this.onerror?.() : this.onload?.(),
        );
      }
    },
  );
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('DOMParser', new JSDOM('').window.DOMParser);
  return { canvas, context, create, revoke };
}

describe('pure scanning and contrast', () => {
  it('uses WCAG relative luminance', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#000000')).toBe(21);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.478, 3);
    expect(() => contrastRatio('white', '#000000')).toThrow('Colors must');
  });
  it('checks the worst gradient stop and warns about inverted colors', () => {
    const result = analyzeScanDesign({
      ...base,
      colors: ['#000000', '#cccccc'],
    });
    expect(result.contrastRatio).toBeCloseTo(1.606, 3);
    expect(result.warnings.join(' ')).toContain('3:1');
    expect(
      analyzeScanDesign({
        ...base,
        colors: ['#ffffff'],
        background: '#000000',
      }).warnings.join(' '),
    ).toContain('lighter');
  });
  it('treats transparency as white, checks the quiet zone and ECC logo recommendation', () => {
    const result = analyzeScanDesign({
      ...base,
      transparent: true,
      background: '#000000',
      margin: 1,
      logoWidth: 0.25,
      logoHeight: 0.25,
    });
    expect(result.contrastRatio).toBe(21);
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.join(' ')).toContain('light surface');
    expect(result.warnings.join(' ')).toContain('below 2');
    expect(result.warnings.join(' ')).toContain('level M');
    expect(
      analyzeScanDesign({
        ...base,
        errorCorrection: 'H',
        logoWidth: 0.25,
        logoHeight: 0.25,
      }).warnings,
    ).toEqual([]);
    expect(
      analyzeScanDesign({
        ...base,
        errorCorrection: 'H',
        logoWidth: 0.1,
        logoHeight: 0.4,
      }).warnings.join(' '),
    ).toContain('logo');
    expect(
      analyzeScanDesign({
        ...base,
        errorCorrection: 'H',
        logoWidth: 0.25,
        logoHeight: 0.25,
        logoPadding: 0.02,
      }).warnings.join(' '),
    ).toContain('cleared area');
  });
  it.each([false, true])(
    'decodes dark and inverted pixels: inverted=%s',
    (inverted) => {
      const svg = renderSvg('scan me', {
        ...DEFAULT_DESIGN,
        body: {
          shape: 'square',
          fill: { type: 'solid', color: inverted ? '#ffffff' : '#000000' },
        },
        background: {
          color: inverted ? '#000000' : '#ffffff',
          transparent: false,
        },
      });
      const bitmap = new Resvg(svg).render();
      expect(
        decodeImageData({
          data: new Uint8ClampedArray(bitmap.pixels),
          width: bitmap.width,
          height: bitmap.height,
        }),
      ).toBe('scan me');
    },
  );
  it('returns null when no code is present', () => {
    expect(
      decodeImageData({
        data: new Uint8ClampedArray(40 * 40 * 4).fill(255),
        width: 40,
        height: 40,
      }),
    ).toBeNull();
  });
});

describe('browser export wrappers', () => {
  const svg = renderSvg('browser test', DEFAULT_DESIGN);
  it('exports exactly the requested dimensions and keeps the canvas transparent', async () => {
    const harness = browserHarness(svg);
    const blob = await svgToPngBlob(svg, 512);
    expect(blob.type).toBe('image/png');
    expect(harness.canvas.width).toBe(512);
    expect(harness.canvas.height).toBe(512);
    expect(harness.context.imageSmoothingEnabled).toBe(false);
    expect(harness.context.fillRect).not.toHaveBeenCalled();
    expect(harness.context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      512,
      512,
    );
    expect(harness.revoke).toHaveBeenCalledWith('blob:local-test');
  });
  it.each(['load', 'context', 'blob'] as const)(
    'revokes the PNG object URL on %s failure',
    async (failure) => {
      const harness = browserHarness(svg, failure);
      await expect(svgToPngBlob(svg, 200)).rejects.toThrow();
      expect(harness.revoke).toHaveBeenCalledExactlyOnceWith('blob:local-test');
    },
  );
  it('rejects invalid PNG dimensions before allocating a URL', async () => {
    const harness = browserHarness(svg);
    await expect(svgToPngBlob(svg, 0)).rejects.toThrow('positive integer');
    expect(harness.create).not.toHaveBeenCalled();
  });
  it('rasterizes at 400px, decodes and compares expected content', async () => {
    const harness = browserHarness(svg);
    expect(await checkScannability(svg, 'browser test')).toEqual({
      decodable: true,
      matches: true,
      contrastRatio: 21,
      warnings: [],
    });
    expect(harness.canvas.width).toBe(400);
    expect(harness.context.fillStyle).toBe('#ffffff');
    expect(harness.revoke).toHaveBeenCalledExactlyOnceWith('blob:local-test');
  });
  it('reports mismatched content and undecodable images', async () => {
    browserHarness(svg);
    expect(
      (await checkScannability(svg, 'different')).warnings.join(' '),
    ).toContain('does not match');
    const blank =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"/>';
    browserHarness(blank);
    const result = await checkScannability(blank, 'test');
    expect(result.decodable).toBe(false);
    expect(result.matches).toBe(false);
    expect(result.warnings.join(' ')).toContain('could not be decoded');
    expect(result.warnings.join(' ')).toContain('metadata is unavailable');
  });
  it('carries renderer gradient and transparency diagnostics into scan results', async () => {
    const styled = renderSvg('browser test', {
      ...DEFAULT_DESIGN,
      margin: 1,
      body: {
        shape: 'square',
        fill: {
          type: 'linear',
          rotation: 0,
          stops: [
            { offset: 0, color: '#000000' },
            { offset: 1, color: '#cccccc' },
          ],
        },
      },
      background: { color: '#123456', transparent: true },
    });
    browserHarness(styled);
    const result = await checkScannability(styled, 'browser test');
    expect(result.contrastRatio).toBeCloseTo(1.606, 3);
    expect(result.warnings.join(' ')).toContain('light surface');
    expect(result.warnings.join(' ')).toContain('below 2');
  });
  it.each(['load', 'context'] as const)(
    'revokes scan URLs on %s failure',
    async (failure) => {
      const harness = browserHarness(svg, failure);
      await expect(checkScannability(svg, 'browser test')).rejects.toThrow();
      expect(harness.revoke).toHaveBeenCalledExactlyOnceWith('blob:local-test');
    },
  );
});
