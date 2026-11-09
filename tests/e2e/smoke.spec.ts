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
  await page.getByLabel('Text or URL').fill('PNG export verification');
  await page.getByRole('combobox', { name: /PNG size/ }).selectOption('512');
  const pngEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const bytes = await readFile((await (await pngEvent).path())!);
  const result = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      await (await fetch('data:image/png;base64,' + base64)).blob(),
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return {
      data: Array.from(
        context.getImageData(0, 0, canvas.width, canvas.height).data,
      ),
      width: canvas.width,
      height: canvas.height,
    };
  }, bytes.toString('base64'));
  expect(
    jsQR(new Uint8ClampedArray(result.data), result.width, result.height)?.data,
  ).toBe('PNG export verification');
  await page.getByRole('switch', { name: 'Transparent background' }).check();
  const transparentEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const transparent = await readFile((await (await transparentEvent).path())!);
  const alpha = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      await (await fetch('data:image/png;base64,' + base64)).blob(),
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return context.getImageData(0, 0, 1, 1).data[3];
  }, transparent.toString('base64'));
  expect(alpha).toBe(0);
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
    predicate: (worker) => /\/png(?:-|\.ts)/.test(worker.url()),
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

test('rehydrates preferences while discarding sensitive content and resets the saved design', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Text or URL').fill('private-text-draft');
  await page
    .getByRole('group', { name: 'Body', exact: true })
    .getByRole('radio', { name: 'rounded' })
    .check();
  await page.getByLabel('Body color', { exact: true }).fill('#153b65');
  await page.getByRole('radio', { name: 'svg', exact: true }).check();
  await page.getByRole('radio', { name: 'Wi-Fi', exact: true }).check();
  await page
    .getByLabel('Network name', { exact: true })
    .fill('private-network');
  await page.getByLabel('Password', { exact: true }).fill('private-password');
  const stored = await page.evaluate(() =>
    localStorage.getItem('qr-enesoglu-com:v1'),
  );
  expect(stored).not.toContain('private-');
  await page.reload();
  await expect(
    page.getByRole('radio', { name: 'Wi-Fi', exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel('Network name', { exact: true })).toHaveValue(
    '',
  );
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Body color', { exact: true })).toHaveValue(
    '#153b65',
  );
  await expect(
    page.getByRole('radio', { name: 'svg', exact: true }),
  ).toBeChecked();
  await page.getByRole('radio', { name: 'Text', exact: true }).check();
  await expect(page.getByLabel('Text or URL')).toHaveValue(
    'https://example.com',
  );
  await page.getByRole('button', { name: 'Reset design' }).click();
  await page.reload();
  await expect(page.getByLabel('Body color', { exact: true })).toHaveValue(
    '#000000',
  );
  await expect(
    page
      .getByRole('group', { name: 'Body', exact: true })
      .getByRole('radio', { name: 'square' }),
  ).toBeChecked();
  await expect(
    page.getByRole('radio', { name: 'svg', exact: true }),
  ).toBeChecked();
});

test('encodes and scans each content kind in the editor', async ({ page }) => {
  await page.goto('/');
  const examples = [
    {
      kind: 'Wi-Fi',
      fields: {
        'Network name': 'Example network',
        Password: 'example-password',
      },
    },
    {
      kind: 'Contact',
      fields: {
        'First name': 'Example',
        'Last name': 'Person',
        'Phone number': '+12025550123',
      },
    },
    {
      kind: 'Email',
      fields: {
        'Recipient email': 'example@example.org',
        Subject: 'Example subject',
        Message: 'Example message',
      },
    },
    { kind: 'Phone', fields: { 'Phone number': '+12025550123' } },
    {
      kind: 'SMS',
      fields: { 'Phone number': '+12025550123', Message: 'Example message' },
    },
    { kind: 'Text', fields: { 'Text or URL': 'https://example.org' } },
  ];
  for (const example of examples) {
    await page.getByRole('radio', { name: example.kind, exact: true }).check();
    for (const [label, value] of Object.entries(example.fields))
      await page.getByLabel(label, { exact: true }).fill(value!);
    await expect(page.getByText('Scannable', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Download PNG' }),
    ).toBeEnabled();
  }
});
