import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'dist/照着拍-Demo.html'), 'utf8');
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox'],
} : {});
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], requests = [];
  const address = 'http://127.0.0.1:5173/standalone-check';
  // Deliver just the HTML document. No server is needed and all subsequent
  // networking is unavailable. Managed cloud Chromium disallows file://.
  await page.route(address, route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
  await context.setOffline(true);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.url().startsWith('http') && r.url() !== address) requests.push(r.url()); });
  await page.goto(address);
  await page.getByRole('button', { name: '用咖啡馆示例试试' }).click();
  await page.getByRole('button', { name: /这里的留白/ }).click();
  await page.getByRole('button', { name: '照这个目标试拍' }).click();
  await page.getByRole('button', { name: '看看示例的第一次试拍' }).click();
  assert.equal(await page.getByRole('heading', { name: '调整取景，让人物在画面里靠右一点。' }).count(), 1);
  assert.ok(await page.locator('.current-photo img').evaluate(img => img.complete && img.naturalWidth > 0));
  await page.getByRole('button', { name: '看看调整后的一张' }).click();
  await page.getByRole('button', { name: '我更喜欢这张', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存这张照片' }).click();
  const file = await download;
  assert.equal(file.suggestedFilename(), '照着拍-第2张.jpg');
  const bytes = await readFile(await file.path());
  assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
  await page.getByRole('button', { name: '新一组照片' }).click();
  await page.getByRole('button', { name: '选一张参考图' }).click();
  await page.getByLabel('选择照片文件').setInputFiles(resolve(root, 'public/images/cafe-editorial.png'));
  await page.getByRole('button', { name: '继续确认人物' }).click();
  await page.getByRole('button', { name: '确认这个人物框' }).click();
  assert.equal(await page.getByRole('button', { name: /人物的位置/ }).count(), 1);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('Standalone verified offline: sample flow, image decode, JPEG export, real upload, no external requests or JavaScript errors.');
} finally {
  await browser.close();
}
