import { getBrowser, closeBrowser } from '../../../lib/browser.js';
import { validateZuploSecret, setCorsHeaders } from '../../../lib/auth.js';
import { applyStealth } from '../../../lib/stealth.js';
import { Renderer, renderTemplate } from '../../../lib/renderer.js';
import fs from 'fs';
import path from 'path';

// Feature 8: Simple In-Memory Cache
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5;

export default async function handler(req, res) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('X-Request-ID', requestId);
  if (!validateZuploSecret(req, res)) return;

  const { 
    url, 
    template,
    data = {},
    html,
    width = 1280, 
    height = 800, 
    format = 'A4', 
    landscape = false,
    printBackground = true,
    stealth = true,
    clean = false,
    freezeAnimations = true,
    css,
    debug = false,
    headers = {},
    noCache = false
  } = req.body;

  const cacheKey = JSON.stringify({ url, template, data, html, width, height, format, landscape, clean, css });
  if (!noCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Render-Time', '0ms');
      if (debug) return res.status(200).json(cached.data);
      
      const buffer = Buffer.from(cached.data.pdf_base64, 'base64');
      res.setHeader('Content-Type', 'application/pdf');
      return res.end(buffer, 'binary');
    }
  }

  if (!url && !template && !html) {
    return res.status(400).json({ success: false, error: 'validation_error', message: 'url, template, or html is required' });
  }

  let lastError = null;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page = null;

    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      
      const renderer = new Renderer(page, { clean, freezeAnimations, css, wait: 'smart' });

      if (template) {
        const templatePath = path.join(process.cwd(), 'templates', `${template}.html`);
        if (fs.existsSync(templatePath)) {
          const rawTemplate = fs.readFileSync(templatePath, 'utf8');
          await page.setContent(renderTemplate(rawTemplate, data), { waitUntil: 'networkidle0' });
        } else {
          throw new Error(`Template ${template} not found`);
        }
      } else if (html) {
        await page.setContent(html, { waitUntil: 'networkidle0' });
      } else {
        if (stealth) await applyStealth(page);
        if (headers && Object.keys(headers).length > 0) await page.setExtraHTTPHeaders(headers);
        await page.setViewport({ width: Number(width), height: Number(height) });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
      }

      const debugInfo = await renderer.process();

      const pdf = await page.pdf({
        format: format,
        landscape: !!landscape,
        printBackground: !!printBackground,
      });

      await page.close();

      const renderTime = Date.now() - startTime;
      res.setHeader('X-Render-Time', `${renderTime}ms`);
      res.setHeader('X-Cache', 'MISS');

      const responseData = {
        success: true,
        pdf_base64: pdf.toString('base64'),
        url: url || 'template',
        render_time: renderTime,
        request_id: requestId,
        timestamp: new Date().toISOString()
      };

      if (debug) responseData.debug = debugInfo;
      cache.set(cacheKey, { timestamp: Date.now(), data: responseData });

      if (req.headers['accept']?.includes('application/pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        return res.end(pdf, 'binary');
      }

      return res.status(200).json(responseData);

    } catch (error) {
      lastError = error;
      if (page) await page.close().catch(() => {});
      if (error.message.includes('Target closed')) await closeBrowser(true);
      if (attempt < maxRetries) continue;
    }
  }

  return res.status(500).json({ success: false, error: 'render_failed', message: lastError.message, request_id: requestId });
}
