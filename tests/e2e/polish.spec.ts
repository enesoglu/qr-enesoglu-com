import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const mode of ['Single', 'Bulk'] as const) {
    test(`${mode} has no accessibility violations in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.getByRole('radio', { name: mode, exact: true }).check();
      if (mode === 'Bulk') {
        await page.getByRole('textbox').fill('one,first\ntwo,second');
        await expect(
          page.getByRole('img', { name: 'First bulk code preview' }),
        ).toBeVisible();
      } else {
        await page.getByLabel('Text or URL').fill('Accessibility check');
        await expect(
          page.getByText('Scannable', { exact: true }),
        ).toBeVisible();
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }
}

test('keyboard navigation changes mode, closes warnings and reaches the footer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'View source on GitHub' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('radio', { name: 'Single', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('radio', { name: 'Bulk', exact: true }),
  ).toBeChecked();
  await page.getByRole('textbox').waitFor();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('Keyboard bulk code');
  await expect(page.getByText('1 code, 0 errors')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('radio', { name: 'Single', exact: true }),
  ).toBeChecked();
  await page.getByLabel('Quiet zone').fill('0');
  const summary = page.locator('summary');
  await expect(summary).toBeVisible();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('details')).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  const footer = page.locator('footer a');
  for (
    let step = 0;
    step < 20 &&
    !(await footer.evaluate((element) => element === document.activeElement));
    step++
  ) {
    await page.keyboard.press('Tab');
  }
  await expect(footer).toBeFocused();
});

test('full app and previously unopened bulk tools work offline after the first visit', async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_PREVIEW,
    'Service worker is production-only',
  );
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      );
    }
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Text or URL').fill('Generated without a connection');
  await expect(page.getByText('Scannable', { exact: true })).toBeVisible();
  const png = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG' }).click();
  expect(await (await png).failure()).toBeNull();
  await page.getByRole('radio', { name: 'Bulk', exact: true }).check();
  await page
    .getByRole('textbox')
    .fill('data,filename\noffline one,first\noffline two,second');
  await expect(page.getByText('2 codes, 0 errors')).toBeVisible();
  const zip = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate ZIP' }).click();
  const download = await zip;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
});
