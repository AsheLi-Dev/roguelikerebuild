import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`Page error: ${err.message}`);
  });

  page.on('requestfailed', request => {
    errors.push(`Request failed: ${request.url()} - ${request.failure().errorText}`);
  });

  try {
    console.log('Navigating to http://127.0.0.1:4173...');
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    
    // Wait a bit more for any late-loading assets or async errors
    await page.waitForTimeout(5000);
  } catch (err) {
    errors.push(`Navigation error: ${err.message}`);
  }

  if (errors.length > 0) {
    console.error('Found errors:');
    errors.forEach(err => console.error(err));
    process.exit(1);
  } else {
    console.log('No console errors found.');
    process.exit(0);
  }

  await browser.close();
})();
