import { getBrowser, closeBrowser } from '../../../lib/browser.js';
import { validateZuploSecret, setCorsHeaders } from '../../../lib/auth.js';
import { Renderer } from '../../../lib/renderer.js';

// Feature 8: Simple In-Memory Cache
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour for OG images

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('X-Request-ID', requestId);
  if (!validateZuploSecret(req, res)) return;

  const { 
    title, 
    description = '', 
    theme = 'dark', 
    background_color, 
    logo_url,
    noCache = false,
    debug = false
  } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'validation_error', message: 'title is required' });
  }

  const cacheKey = JSON.stringify({ title, description, theme, background_color, logo_url });
  if (!noCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Render-Time', '0ms');
    if (debug) return res.status(200).json(cached.data);
    const buffer = Buffer.from(cached.data.image_base64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    return res.end(buffer, 'binary');
  }

  const themes = {
    light: { bg: '#ffffff', text: '#000000', accent: '#00FF41' },
    dark: { bg: '#000000', text: '#ffffff', accent: '#00FF41' },
    green: { bg: '#00FF41', text: '#000000', accent: '#000000' }
  };

  const currentTheme = themes[theme] || themes.dark;
  const bgColor = background_color || currentTheme.bg;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&family=Outfit:wght@700&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0; padding: 0; width: 1200px; height: 630px;
          background-color: ${bgColor}; color: ${currentTheme.text};
          font-family: 'Inter', sans-serif; display: flex; flex-direction: column;
          justify-content: center; padding: 0 100px; box-sizing: border-box;
          border: 15px solid ${currentTheme.accent};
        }
        h1 { font-size: 95px; font-weight: 900; margin: 0; line-height: 1.0; text-transform: uppercase; letter-spacing: -2px; }
        p { font-size: 35px; margin-top: 30px; opacity: 0.8; font-family: 'Outfit', sans-serif; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${description ? `<p>${description}</p>` : ''}
    </body>
    </html>
  `;

  let lastError = null;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 630 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const renderer = new Renderer(page, { wait: 'smart' });
      const debugInfo = await renderer.process();

      const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
      await page.close();

      const renderTime = Date.now() - startTime;
      const responseData = {
        success: true,
        image_base64: screenshot,
        width: 1200, height: 630,
        render_time: renderTime,
        request_id: requestId,
        timestamp: new Date().toISOString()
      };

      if (debug) responseData.debug = debugInfo;
      cache.set(cacheKey, { timestamp: Date.now(), data: responseData });

      if (req.headers['accept']?.includes('image/')) {
        res.setHeader('Content-Type', 'image/png');
        return res.end(Buffer.from(screenshot, 'base64'), 'binary');
      }

      return res.status(200).json(responseData);

    } catch (error) {
      lastError = error;
      if (page) await page.close().catch(() => {});
      if (error.message.includes('Target closed')) await closeBrowser(true);
      if (attempt < maxRetries) continue;
    }
  }

  return res.status(500).json({ success: false, error: 'render_failed', message: lastError.message });
}
