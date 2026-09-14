import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('acoustic-intro-seen', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'cm', exact: true }).click();
  await page.getByRole('button', { name: 'Mode', exact: true }).click();
  for (const [label, value] of [['Length', '500'], ['Width', '400'], ['Height', '300']]) {
    await page.getByRole('spinbutton', { name: label, exact: true }).fill(value);
    await page.getByRole('spinbutton', { name: label, exact: true }).press('Enter');
  }
});

test('mode chart, coincident selection, room updates and settings stay in sync', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const rays = await page.getByRole('button', { name: 'Rays', exact: true }).boundingBox();
  const mode = await page.getByRole('button', { name: 'Mode', exact: true }).boundingBox();
  expect(mode!.x).toBeCloseTo(rays!.x, 0);
  expect(mode!.y).toBeGreaterThan(rays!.y);
  await expect(page.getByTestId('mode-frequency')).toHaveText('34.30 Hz');
  await expect(page.getByTestId('schroeder-frequency')).toHaveText('118.32 Hz');
  await expect(page.getByRole('heading', { name: 'Room3D' })).toBeVisible();
  await expect(page.getByText('A blank room. Your next idea.')).toBeHidden();
  await page.getByLabel('Select room mode').selectOption('0-1-0');
  await expect(page.getByTestId('mode-frequency')).toHaveText('42.88 Hz');
  const spectrum = page.getByRole('slider', { name: 'Room mode spectrum' });
  await spectrum.focus();
  await spectrum.press('ArrowRight');
  await expect(page.getByLabel('Select room mode')).toHaveValue('1-1-0');
  const chart = await spectrum.boundingBox();
  const frequencyX = (24 + Math.log(57.1666667 / 20) / Math.log(160 / 20) * 952) / 1000;
  await spectrum.click({ position: { x: chart!.width * frequencyX, y: chart!.height / 2 } });
  await expect(page.getByLabel('Select room mode')).toHaveValue('0-0-1');
  await page.getByLabel('Show nodal planes').check();
  await page.getByLabel('Animate pressure').check();
  await page.getByLabel('RT60', { exact: true }).fill('0.84');
  await page.getByLabel('RT60', { exact: true }).press('Enter');
  await expect(page.getByTestId('schroeder-frequency')).toHaveText('236.64 Hz');
  await page.getByRole('button', { name: 'Tangential', exact: true }).click();
  await page.getByRole('button', { name: 'Oblique', exact: true }).click();
  await expect(page.getByLabel('Select room mode').locator('option')).not.toContainText([/Tangential|Oblique/]);
  await page.getByRole('button', { name: 'Axial', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('No modes in this range');
  await expect(page.getByTestId('selected-mode-line')).toHaveCount(0);
  await page.getByRole('button', { name: 'Axial', exact: true }).click();
  await page.getByLabel('Select room mode').selectOption('1-0-0');
  await page.getByLabel('Length', { exact: true }).fill('600');
  await page.getByLabel('Length', { exact: true }).press('Enter');
  await expect(page.getByTestId('mode-frequency')).toHaveText('28.58 Hz');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('mode-frequency')).toHaveText('34.30 Hz');
  // Equal dimensions must keep different patterns at the same frequency.
  await page.getByLabel('Width', { exact: true }).fill('500');
  await page.getByLabel('Width', { exact: true }).press('Enter');
  await page.getByLabel('Height', { exact: true }).fill('500');
  await page.getByLabel('Height', { exact: true }).press('Enter');
  await page.getByLabel('Select room mode').selectOption('0-0-1');
  await page.getByRole('button', { name: 'Next mode →', exact: true }).click();
  await expect(page.getByLabel('Select room mode')).toHaveValue('0-1-0');
  await expect(page.getByTestId('mode-frequency')).toHaveText('34.30 Hz');
  await page.getByRole('button', { name: 'Rays', exact: true }).click();
  await page.getByRole('button', { name: 'Mode', exact: true }).click();
  await expect(page.getByLabel('Select room mode')).toHaveValue('0-1-0');
  await expect(page.getByLabel('Show nodal planes')).toBeChecked();
  expect(errors).toEqual([]);
});

test('mode view renders in both themes and fits mobile', async ({ page }) => {
  await page.getByLabel('Select room mode').selectOption('1-1-1');
  await page.screenshot({ path: '/tmp/acoustic-modes-dark.png' });
  await page.getByRole('button', { name: 'Toggle light and dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: '/tmp/acoustic-modes-light.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Mode', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Room modes', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/acoustic-modes-mobile.png' });
});
