import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const baseURL = process.env.SCREENSHOT_URL ?? 'http://127.0.0.1:4173';
const output = new URL('../docs/images/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme,
      reducedMotion: 'reduce',
      locale: 'en-US',
      timezoneId: 'UTC',
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      await page.goto(baseURL);
      await page.getByLabel('Text or URL').fill('https://qr.enesoglu.com');
      await page
        .getByRole('group', { name: 'Body', exact: true })
        .getByRole('radio', { name: 'rounded', exact: true })
        .press('Space');
      await page
        .getByRole('group', { name: 'Corner frame', exact: true })
        .getByRole('radio', { name: 'rounded', exact: true })
        .press('Space');
      await page.getByLabel('Body color', { exact: true }).fill('#115e59');
      await expect(page.getByText('Scannable', { exact: true })).toBeVisible();
      const preview = page.getByRole('img', { name: 'QR code preview' });
      await expect
        .poll(async () =>
          decodeURIComponent((await preview.getAttribute('src')) ?? ''),
        )
        .toContain('#115e59');
      await preview.evaluate((image) => image.decode());
      await page.evaluate(async () => {
        await document.fonts.ready;
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: fileURLToPath(new URL(`editor-${colorScheme}.png`, output)),
        animations: 'disabled',
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
