import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

/**
 * Global variable to persist the browser instance across warm Lambda invocations.
 */
let cachedBrowser = null;

/**
 * getBrowser - SaaS-grade browser handler with pooling.
 * Supports local Chrome, Vercel-native Chromium, or Remote Browser Services (WebSocket).
 */
export async function getBrowser() {
  // 1. Check if we have a cached browser and it's still healthy
  if (cachedBrowser && cachedBrowser.isConnected()) {
    console.log('Reusing existing browser instance...');
    return cachedBrowser;
  }

  // 2. Production SaaS approach: Connect to a hosted browser service (Browserless, etc)
  if (process.env.BROWSER_WSE_ENDPOINT) {
    console.log('Connecting to remote browser service...');
    cachedBrowser = await puppeteer.connect({
      browserWSEndpoint: process.env.BROWSER_WSE_ENDPOINT,
    });
    return cachedBrowser;
  }

  const isLocal = process.env.NODE_ENV === 'development' || !!process.env.IS_LOCAL;
  
  // 3. Local Development approach
  if (isLocal) {
    console.log('Launching local Chrome...');
    cachedBrowser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    return cachedBrowser;
  }

  // 4. Fallback: Vercel-native Chromium
  console.log('Launching new Chromium instance (Vercel native)...');
  const executablePath = await chromium.executablePath();

  cachedBrowser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });

  return cachedBrowser;
}

/**
 * closeBrowser - Usually a no-op in the pooling model unless we want to force a restart.
 * @param {boolean} force - If true, closes the cached browser.
 */
export async function closeBrowser(force = false) {
  if (cachedBrowser && force) {
    console.log('Closing browser instance (forced)...');
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}
