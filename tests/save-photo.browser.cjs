// Run: node tests/save-photo.browser.cjs <cdp|webkit> [artifact directory]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pw = require('playwright');
const engine = process.argv[2] || 'cdp';
const output = path.resolve(process.argv[3] || 'test-results/save-photo');
const baseURL = process.env.CAMERA_TEST_URL || 'http://127.0.0.1:5176';
fs.mkdirSync(output, { recursive: true });

async function download(page, extension) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save Photo', exact: true }).click();
  const file = await pending;
  assert.match(file.suggestedFilename(), new RegExp(String.raw`^my-polaroid-\d{4}-\d{2}-\d{2}-\d{6}\.${extension}$`));
  const bytes = fs.readFileSync(await file.path());
  assert(bytes.length > 1000, 'Export contains actual artwork');
  if (extension === 'jpg') assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
  if (extension === 'png') assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  if (extension === 'heic') assert(bytes.subarray(4, 32).includes(Buffer.from('ftyp')));
  if (extension === 'svg') assert(bytes.toString().includes('<svg'));
  await file.saveAs(path.join(output, `${engine}-${extension}.${extension}`));
}

async function layout(page, platform) {
  for (const [width, height] of [[1280, 900], [390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    const save = page.getByRole('button', { name: 'Save Photo', exact: true });
    await page.keyboard.press('Tab');
    await save.focus();
    const metrics = await page.evaluate(() => {
      const button = document.querySelector('.save-plate');
      const hint = document.querySelector('#photo-save-guidance');
      const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = color => rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
      const css = getComputedStyle(button);
      let parent = hint, background;
      do { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; } while (parent && background === 'rgba(0, 0, 0, 0)');
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        buttonHeight: button.getBoundingClientRect().height,
        buttonContrast: contrast(css.color, css.backgroundColor),
        hintContrast: contrast(getComputedStyle(hint).color, background),
        clipped: hint.scrollWidth > hint.clientWidth,
        focused: document.activeElement === button,
        focusStyle: css.outlineStyle,
      };
    });
    assert(!metrics.overflow && !metrics.clipped, `Wrapping/overflow at ${width}: ${JSON.stringify(metrics)}`);
    assert(metrics.buttonHeight >= 44 && metrics.focused && metrics.focusStyle !== 'none', JSON.stringify(metrics));
    assert(metrics.buttonContrast >= 4.5 && metrics.hintContrast >= 4.5, JSON.stringify(metrics));
    await page.screenshot({ path: path.join(output, `${engine}-${platform}-${width}.png`), fullPage: true });
    console.log(JSON.stringify({ engine, platform, width, ...metrics }));
  }
}

(async () => {
  const launched = engine === 'cdp'
    ? await pw.chromium.launch({ channel: 'chrome', headless: true, args: ['--remote-debugging-port=9335'] })
    : await pw.webkit.launch({ headless: true, executablePath: process.env.WEBKIT_EXECUTABLE_PATH });
  const browser = engine === 'cdp' ? await pw.chromium.connectOverCDP('http://127.0.0.1:9335') : launched;
  try {
    for (const platform of ['Win32', 'Linux armv8l', 'iPhone', 'MacIntel', 'iPad']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: platform === 'iPhone' ? 'reduce' : 'no-preference' });
      // Only the OS sharing boundary is simulated; rendering and downloads run normally.
      await context.addInitScript(platform => {
        Object.defineProperty(navigator, 'platform', { value: platform });
        window.shareCalls = [];
        window.shareMode = 'success';
        Object.defineProperties(navigator, {
          canShare: { configurable: true, value: ({ files }) => files?.every(file => ['image/jpeg', 'image/png'].includes(file.type)) },
          share: { configurable: true, value: async ({ files }) => {
            const file = files[0];
            window.shareCalls.push({ name: file.name, type: file.type, size: file.size, active: navigator.userActivation.isActive });
            window.lastShared = file;
            if (window.shareMode === 'cancel') throw new DOMException('Canceled', 'AbortError');
            if (window.shareMode === 'fail') throw new DOMException('Blocked', 'NotAllowedError');
          } },
        });
      }, platform);
      const page = await context.newPage(), errors = [], downloads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('download', file => downloads.push(file.suggestedFilename()));
      const save = page.getByRole('button', { name: 'Save Photo', exact: true });
      // The camera prints an uploaded photo, so saving needs no camera device.
      const printUpload = async () => {
        await page.locator('input[type="file"]').setInputFiles(path.resolve('public/sample-coast.png'));
        await page.waitForFunction(() => { const button = document.querySelector('.shake-reveal'); return button && !button.disabled; });
        assert.equal(await save.count(), 0, 'Save waits for the reveal');
        await page.getByRole('button', { name: 'Reveal the Snap', exact: true }).click();
        await save.waitFor({ timeout: 15000 });
        await page.waitForFunction(() => !document.querySelector('.save-plate').disabled);
      };
      // A finished save resets to the live camera, ready for the next shot.
      const expectReset = async () => {
        await page.locator('.instant-print').waitFor({ state: 'detached' });
        assert.equal(await save.count(), 0);
      };
      await page.goto(baseURL);
      await printUpload();
      assert.equal(await save.textContent(), '', 'The save plate shows only its icon');
      if (platform === 'Win32' || platform === 'iPhone') await layout(page, platform);
      if (platform === 'Win32' || platform === 'Linux armv8l') {
        await download(page, 'jpg');
        await expectReset();
        assert.equal(await page.evaluate(() => window.shareCalls.length), 0);
      } else {
        await page.evaluate(() => { window.shareMode = 'cancel'; });
        await save.click();
        await page.getByText('Sharing canceled.', { exact: false }).waitFor();
        assert.equal(downloads.length, 0);
        await page.evaluate(() => { window.shareMode = 'fail'; });
        await save.click();
        await page.getByText('Sharing is unavailable.', { exact: false }).waitFor();
        assert.equal(downloads.length, 0);
        await download(page, 'jpg');
        await expectReset();
        await page.evaluate(() => { window.shareMode = 'success'; });
        await printUpload();
        await save.press('Enter');
        await expectReset();
        const shared = await page.evaluate(async () => {
          const file = window.lastShared, image = new Image(), url = URL.createObjectURL(file);
          image.src = url; await image.decode(); URL.revokeObjectURL(url);
          return { ...window.shareCalls.at(-1), width: image.width, height: image.height };
        });
        assert.match(shared.name, /^my-polaroid-\d{4}-\d{2}-\d{2}-\d{6}\.jpg$/);
        assert.equal(shared.type, 'image/jpeg');
        assert(shared.active && shared.size > 1000);
        assert.deepEqual([shared.width, shared.height], [1560, 1897]);
      }
      assert.deepEqual(errors, [], 'No browser exceptions');
      console.log(`${engine}: ${platform} save flow passed`);
      await context.close();
    }
  } finally {
    await browser.close();
    if (browser !== launched) await launched.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
