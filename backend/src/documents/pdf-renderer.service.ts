import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { type Browser, launch } from 'puppeteer';

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
      this.log.log('Launching headless browser for PDF rendering');
      this.browserPromise = launch({
        headless: true,
        // --no-sandbox is safe here because we only ever render our own HTML
        // (templates we control) — never untrusted user input as HTML.
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }
}
