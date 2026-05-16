import { waitForStability } from './smart-wait.js';

/**
 * Advanced Rendering Engine for RenderKit API
 * Handles: Auto-Clean, Animation Freezing, Smart Stabilization, etc.
 */

const CLEANUP_SELECTORS = [
  // Cookie Banners & Consent Managers
  '#onetrust-consent-sdk',
  '#didomi-host',
  '.didomi-popup',
  '.cookie-notice',
  '#cookie-notice',
  '.cookie-banner',
  '#cookie-banner',
  '[id*="cookie-banner"]',
  '[class*="cookie-banner"]',
  '[id*="consent"]',
  '[class*="consent"]',
  '.cc-window',
  '.cc-banner',
  '#cmp-container',
  '.truste_overlay',
  '.truste_container',
  '#CybotCookiebotDialog',
  '.gdpr-consent',
  
  // Newsletter Popups
  '[id*="newsletter"]',
  '[class*="newsletter"]',
  '.mc-modal',
  '.mc-banner',
  '#mailchimp-popup',
  '.popup-overlay',
  
  // Chat Widgets
  '#hubspot-messages-iframe-container',
  '.intercom-lightweight-app',
  '#intercom-container',
  '.drift-frame-controller',
  '#smile-ui-container',
  '#zendesk-widget',
  
  // Ads & Sticky Overlays
  '.ad-unit',
  '[id*="google_ads"]',
  'iframe[id*="google_ads"]',
  '.sticky-footer',
  '.floating-ad',
  '.at-share-dock',
  
  // General Overlays/Modals
  '.modal-backdrop',
  '.modal-open',
  '.sp-fancybox-overlay',
  '.fancybox-overlay',
  '.blocker'
];

export class Renderer {
  constructor(page, options = {}) {
    this.page = page;
    this.options = options;
    this.debugInfo = {
      startTime: Date.now(),
      timings: {},
      actions: []
    };
  }

  async process() {
    this.mark('start_processing');

    // 0. Emulate Color Scheme
    if (this.options.colorScheme) {
      await this.page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: this.options.colorScheme }
      ]);
    }

    // 1. Freeze Animations
    if (this.options.freezeAnimations !== false) {
      await this.freezeAnimations();
    }

    // 2. Auto Clean Mode
    if (this.options.clean) {
      await this.autoClean();
    }

    // 3. Custom CSS Injection
    if (this.options.css) {
      await this.injectCustomCSS();
    }

    // 4. Smart Stabilization
    if (this.options.wait === 'smart') {
      await this.smartWait();
    }

    this.mark('end_processing');
    return this.debugInfo;
  }

  mark(label) {
    this.debugInfo.timings[label] = Date.now() - this.debugInfo.startTime;
    this.debugInfo.actions.push(label);
  }

  async freezeAnimations() {
    this.mark('freeze_animations_start');
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0s !important;
          animation-delay: -1s !important;
          transition-delay: -1s !important;
          caret-color: transparent !important;
        }
        video {
          display: none !important;
        }
      `
    });
    // Also try to pause video elements via JS
    await this.page.evaluate(() => {
      document.querySelectorAll('video').forEach(v => v.pause());
    });
    this.mark('freeze_animations_end');
  }

  async autoClean() {
    this.mark('auto_clean_start');
    const selectors = CLEANUP_SELECTORS.join(', ');
    
    await this.page.evaluate((selectors) => {
      // 1. Remove by predefined selectors
      const elements = document.querySelectorAll(selectors);
      elements.forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.style.opacity = '0';
      });

      // 2. Heuristic: Remove fixed elements with high z-index that cover too much area
      const all = document.querySelectorAll('*');
      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;
      
      all.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          const viewportArea = vWidth * vHeight;
          
          // If element covers more than 40% of viewport or is a known popup pattern
          if (area > viewportArea * 0.4 || parseInt(style.zIndex) > 500) {
            el.style.display = 'none';
          }
        }
      });

      // 3. Unblock scrolling on body/html
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      document.documentElement.style.overflow = 'auto';
    }, selectors);
    
    this.mark('auto_clean_end');
  }

  async injectCustomCSS() {
    this.mark('custom_css_start');
    await this.page.addStyleTag({ content: this.options.css });
    this.mark('custom_css_end');
  }

  async smartWait() {
    this.mark('smart_wait_start');
    
    // 1. Wait for Fonts
    try {
      await this.page.evaluateHandle('document.fonts.ready');
    } catch (e) {
      this.debugInfo.actions.push('font_wait_failed');
    }

    // 2. Auto-scroll to trigger lazy loading
    if (this.options.fullPage) {
      await this.autoScroll();
    }

    // 3. Wait for stability
    await waitForStability(this.page, 5000);

    this.mark('smart_wait_end');
  }

  async autoScroll() {
    this.mark('auto_scroll_start');
    await this.page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 200; // Faster scroll
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 10000) {
            clearInterval(timer);
            window.scrollTo(0, 0); // Scroll back to top
            resolve();
          }
        }, 80);
      });
    });
    this.mark('auto_scroll_end');
  }
}

/**
 * Renders an HTML template with dynamic data.
 */
export function renderTemplate(template, data = {}) {
  let html = template;
  
  // Variable replacement: {{variable}}
  Object.keys(data).forEach(key => {
    const value = data[key];
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value);
  });

  return html;
}
