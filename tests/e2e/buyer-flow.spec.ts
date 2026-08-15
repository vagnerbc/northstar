import { expect, test } from '@playwright/test';

test('a buyer can browse the seeded catalog', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Less noise. Better objects.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mechanical Keyboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'USB-C Hub' })).toBeVisible();
});

test('checkout is durably confirmed through the fake payment adapter', async ({ page }) => {
  await page.goto('/');
  const keyboard = page.getByRole('article').filter({ hasText: 'Mechanical Keyboard' });
  await keyboard.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Cart' }).click();
  await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await page.getByLabel('Recipient name').fill('Demo Buyer');
  await page.getByLabel('Address line 1').fill('100 Event Avenue');
  await page.getByLabel('City').fill('Sao Paulo');
  await page.getByLabel('State').fill('SP');
  await page.getByLabel('Postal code').fill('01001-000');
  await page.getByRole('button', { name: 'Reserve inventory and continue' }).click();
  await expect(page.getByRole('button', { name: 'Authorize test payment' })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole('button', { name: 'Authorize test payment' }).click();
  await expect(page.getByText('Order confirmed', { exact: true })).toBeVisible({ timeout: 45_000 });
  await page.goto('/orders');
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
});
