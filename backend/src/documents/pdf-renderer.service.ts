import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { type Browser, launch } from 'puppeteer';

/** Font CDNs allowed when rendering untrusted (model-authored) HTML. */
const ALLOWED_FONT_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

/**
 * Wraps a single long-lived headless browser instance. The browser launches
 * lazily on first render so server boot is not blocked by Chromium startup.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly log = new Logger(PdfRendererService.name);
  private browserPromise?: Promise<Browser>;

  async renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      // Wait for web fonts (Heebo) to finish loading so they're embedded in
      // the PDF instead of falling back to a serif.
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
      return Buffer.from(pdf);
    } catch (err) {
      throw new InternalServerErrorException(
        `PDF render failed: ${(err as Error).message}`,
      );
    } finally {
      await page.close();
    }
  }

  /**
   * Renders HTML that was authored by the model (untrusted) — used by the
   * designer agent. Unlike renderHtmlToPdf (which renders our own controlled
   * templates), this hardens the page against the risks of rendering arbitrary
   * markup under a shared --no-sandbox Chromium:
   *   - JavaScript is disabled (no script-based exfiltration/abuse).
   *   - Every subresource request is blocked except inline `data:` URIs and the
   *     Google Fonts hosts — so no `file://` reads, no SSRF, no arbitrary
   *     network egress. Web fonts (for readable Hebrew) still work.
   */
  async renderUntrustedHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (req.isNavigationRequest() || url.startsWith('data:')) {
          void req.continue();
          return;
        }
        try {
          const host = new URL(url).hostname;
          if (ALLOWED_FONT_HOSTS.has(host)) {
            void req.continue();
            return;
          }
        } catch {
          // Unparseable URL — fall through to abort.
        }
        void req.abort();
      });
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } catch (err) {
      throw new InternalServerErrorException(
        `PDF render failed: ${(err as Error).message}`,
      );
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch (err) {
      this.log.warn(`Browser close failed: ${(err as Error).message}`);
    }
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      // In production (Docker) we use the system Chromium installed in the
      // image (PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium). Locally, the
      // env var is unset and Puppeteer falls back to its bundled binary.
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      this.log.log(
        `Launching headless browser for PDF rendering${executablePath ? ` (executable=${executablePath})` : ''}`,
      );
      this.browserPromise = launch({
        headless: true,
        executablePath: executablePath || undefined,
        // --no-sandbox is safe here because we only ever render our own HTML
        // (templates we control) — never untrusted user input as HTML.
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }
}
