import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import jsQR from 'jsqr';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('renders a live QR preview with no accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'QR Generator' }),
  ).toBeVisible();
  const preview = page.getByRole('img', { name: 'QR code preview' });
  const initial = await preview.getAttribute('src');
  await page.getByLabel('Text or URL').fill('A browser-only QR code');
  await expect(preview).not.toHaveAttribute('src', initial!);
  await expect(preview).toBeVisible();
  expect(
    await preview.evaluate(
      (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel('Text or URL').fill('');
  await expect(preview).toHaveCount(0);
});

test('exports a decodable PNG and preserves transparent backgrounds', async ({
  page,
}) => {
  await page.goto('/');
  const initial = await page
    .getByRole('img', { name: 'QR code preview' })
    .getAttribute('src');
  await page.getByLabel('Text or URL').fill('PNG export verification');
  await expect(
    page.getByRole('img', { name: 'QR code preview' }),
  ).not.toHaveAttribute('src', initial!);
  const result = await page
    .getByRole('img', { name: 'QR code preview' })
    .evaluate(async (image: HTMLImageElement) => {
      const exporterPath = '/src/core/export/png.ts';
      const { svgToPngBlob } = await import(/* @vite-ignore */ exporterPath);
      const svg = decodeURIComponent(image.src.split(',').slice(1).join(','));
      const png: Blob = await svgToPngBlob(svg, 512);
      const bitmap = await createImageBitmap(png);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(bitmap, 0, 0);
      const data = Array.from(context.getImageData(0, 0, 512, 512).data);
      bitmap.close();
      const transparentSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="10" height="10" fill="#000000"/></svg>';
      const transparent: Blob = await svgToPngBlob(transparentSvg, 20);
      const transparentBitmap = await createImageBitmap(transparent);
      context.clearRect(0, 0, 512, 512);
      context.drawImage(transparentBitmap, 0, 0);
      const alpha = context.getImageData(19, 19, 1, 1).data[3];
      transparentBitmap.close();
      return {
        data,
        width: canvas.width,
        height: canvas.height,
        type: png.type,
        alpha,
      };
    });
  expect(result.type).toBe('image/png');
  expect(result.alpha).toBe(0);
  expect(
    jsQR(new Uint8ClampedArray(result.data), result.width, result.height)?.data,
  ).toBe('PNG export verification');
});

test('downloads styled PNG, SVG and a three-row ZIP', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Text or URL').fill('https://example.org/download');
  await page
    .getByRole('group', { name: 'Body', exact: true })
    .getByRole('radio', { name: 'rounded' })
    .check();
  await page.getByLabel('Body color', { exact: true }).fill('#153b65');
  await expect(page.getByText('Scannable', { exact: true })).toBeVisible();
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  expect((await pngEvent).suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole('radio', { name: 'svg', exact: true }).check();
  const svgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  expect((await svgEvent).suggestedFilename()).toMatch(/\.svg$/);
  await page.getByRole('radio', { name: 'Bulk', exact: true }).check();
  await page
    .getByRole('textbox')
    .fill(
      'data,filename\nhttps://example.org/one,one\nhttps://example.org/two,two\nhttps://example.org/three,three',
    );
  await expect(page.getByText('3 codes, 0 errors')).toBeVisible();
  const zipEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate ZIP' }).click();
  const download = await zipEvent;
  expect(download.suggestedFilename()).toMatch(/^qr-codes-\d+\.zip$/);
  const files = unzipSync(await readFile((await download.path())!));
  expect(Object.keys(files).sort()).toEqual([
    'one.svg',
    'three.svg',
    'two.svg',
  ]);
  expect(new TextDecoder().decode(files['one.svg'])).toContain('#153b65');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('generates 1000 PNGs at 1024 pixels with worker rasterization', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('radio', { name: 'Bulk', exact: true }).check();
  await page
    .getByRole('textbox')
    .fill(
      Array.from(
        { length: 1000 },
        (_, index) => `https://example.org/${index}`,
      ).join('\n'),
    );
  await expect(page.getByText('1000 codes, 0 errors')).toBeVisible();
  const workerEvent = page.waitForEvent('worker', {
    predicate: (worker) => worker.url().includes('/png.ts'),
  });
  const zipEvent = page.waitForEvent('download', { timeout: 110_000 });
  await page.getByRole('button', { name: 'Generate ZIP' }).click();
  await workerEvent;
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeEnabled();
  const download = await zipEvent;
  const files = unzipSync(await readFile((await download.path())!));
  expect(Object.keys(files)).toHaveLength(1000);
  for (const data of Object.values(files)) {
    expect(Array.from(data.slice(0, 8))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    const dimensions = new DataView(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
    expect(dimensions.getUint32(16)).toBe(1024);
    expect(dimensions.getUint32(20)).toBe(1024);
  }
});

test('falls back to main-thread PNG export and cancels bulk jobs', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'OffscreenCanvas', { value: undefined });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Bulk', exact: true }).check();
  await page.getByRole('textbox').fill('first\nsecond\nthird');
  const zipEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate ZIP' }).click();
  const files = unzipSync(await readFile((await (await zipEvent).path())!));
  expect(Object.keys(files)).toHaveLength(3);
  await page
    .getByRole('textbox')
    .fill(
      Array.from({ length: 1000 }, (_, index) => `row ${index}`).join('\n'),
    );
  await page.getByRole('button', { name: 'Generate ZIP' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByText('Generation cancelled.', { exact: true }),
  ).toBeVisible();
});
