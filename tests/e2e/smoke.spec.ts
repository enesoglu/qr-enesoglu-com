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
  await page.getByLabel('Text or URL').fill('PNG export verification');
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
