import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import type { BatchOptions } from '../types';
import { createBatchZip, parseBatchInput } from './index';

function options(overrides: Partial<BatchOptions> = {}): BatchOptions {
  return {
    format: 'svg',
    sizePx: 512,
    render: vi.fn((data) => `<svg>${data}</svg>`),
    rasterize: vi.fn(async (svg) => new Blob([`png:${svg}`])),
    ...overrides,
  };
}

async function entries(blob: Blob): Promise<Record<string, string>> {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, strFromU8(data)]),
  );
}

describe('batch ZIP export', () => {
  it('archives SVGs with portable unique entry names and progress', async () => {
    const onProgress = vi.fn();
    const opts = options({ onProgress });
    const blob = await createBatchZip(
      [
        { data: 'İş', filename: '../CON' },
        { data: 'two', filename: '../CON' },
        { data: 'three', filename: '' },
      ],
      opts,
    );
    expect(blob.type).toBe('application/zip');
    expect(await entries(blob)).toEqual({
      '..CON.svg': '<svg>İş</svg>',
      '..CON-2.svg': '<svg>two</svg>',
      'qr-0003.svg': '<svg>three</svg>',
    });
    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(opts.rasterize).not.toHaveBeenCalled();
  });

  it('rasterizes PNG entries using the requested size', async () => {
    const opts = options({ format: 'png' });
    const blob = await createBatchZip(
      [{ data: 'Hello', filename: 'hello' }],
      opts,
    );
    expect(await entries(blob)).toEqual({
      'hello.png': 'png:<svg>Hello</svg>',
    });
    expect(opts.rasterize).toHaveBeenCalledWith('<svg>Hello</svg>', 512);
  });

  it('skips render failures and reports original physical input lines', async () => {
    const onProgress = vi.fn();
    const rows = parseBatchInput(
      'data,filename\n"multi\nline",first\n\nbad,second\ngood,third',
    ).rows;
    const blob = await createBatchZip(
      rows,
      options({
        onProgress,
        render: (data) => {
          if (data === 'bad') throw new Error('Data is too long');
          return data;
        },
      }),
    );
    expect(await entries(blob)).toEqual({
      'first.svg': 'multi\nline',
      'third.svg': 'good',
      'errors.txt': 'Line 5 (second.svg): Data is too long',
    });
    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('continues after rasterization failures and uses row positions without source lines', async () => {
    const blob = await createBatchZip(
      [
        { data: 'bad', filename: 'bad' },
        { data: 'good', filename: 'good' },
      ],
      options({
        format: 'png',
        rasterize: async (svg) => {
          if (svg.includes('bad')) throw new Error('Rasterization failed');
          return new Blob(['PNG']);
        },
      }),
    );
    expect(await entries(blob)).toEqual({
      'good.png': 'PNG',
      'errors.txt': 'Line 1 (bad.png): Rasterization failed',
    });
  });

  it('returns readable archives for empty batches and batches where every row fails', async () => {
    const onProgress = vi.fn();
    expect(
      await entries(await createBatchZip([], options({ onProgress }))),
    ).toEqual({});
    expect(onProgress.mock.calls).toEqual([[0, 0]]);
    expect(
      await entries(
        await createBatchZip(
          [{ data: 'x', filename: 'x' }],
          options({
            render: () => {
              throw 'failure';
            },
          }),
        ),
      ),
    ).toEqual({ 'errors.txt': 'Line 1 (x.svg): Could not generate QR code' });
  });

  it('rejects a pre-aborted batch without invoking callbacks', async () => {
    const controller = new AbortController();
    controller.abort();
    const opts = options({ signal: controller.signal, onProgress: vi.fn() });
    await expect(
      createBatchZip([{ data: 'one', filename: 'one' }], opts),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(opts.render).not.toHaveBeenCalled();
    expect(opts.onProgress).not.toHaveBeenCalled();
  });

  it('stops rendering when cancelled from progress', async () => {
    const controller = new AbortController();
    const opts = options({
      signal: controller.signal,
      onProgress: (done) => {
        if (done === 1) controller.abort();
      },
    });
    await expect(
      createBatchZip(
        [
          { data: 'one', filename: 'one' },
          { data: 'two', filename: 'two' },
        ],
        opts,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(opts.render).toHaveBeenCalledTimes(1);
  });

  it('rejects promptly when cancelled during a pending rasterization', async () => {
    const controller = new AbortController();
    let finish: ((blob: Blob) => void) | undefined;
    const onProgress = vi.fn();
    const opts = options({
      format: 'png',
      signal: controller.signal,
      onProgress,
      rasterize: () =>
        new Promise<Blob>((resolve) => {
          finish = resolve;
          controller.abort();
        }),
    });
    await expect(
      createBatchZip(
        [
          { data: 'one', filename: 'one' },
          { data: 'two', filename: 'two' },
        ],
        opts,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    finish?.(new Blob(['late']));
    await Promise.resolve();
    expect(opts.render).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls).toEqual([[0, 2]]);
  });

  it('cancels compression after rendering completes', async () => {
    const controller = new AbortController();
    const opts = options({
      signal: controller.signal,
      onProgress: (done) => {
        if (done === 1) queueMicrotask(() => controller.abort());
      },
    });
    await expect(
      createBatchZip([{ data: 'x'.repeat(400000), filename: 'large' }], opts),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('yields to the event loop between synchronous renders', async () => {
    const controller = new AbortController();
    const opts = options({
      signal: controller.signal,
      render: vi.fn(() => {
        setTimeout(() => controller.abort(), 0);
        return '<svg/>';
      }),
    });
    await expect(
      createBatchZip(
        Array.from({ length: 20 }, () => ({ data: 'a', filename: '' })),
        opts,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(opts.render).toHaveBeenCalledTimes(1);
  });
});
