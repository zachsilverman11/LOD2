/**
 * Puppeteer-based PDF generation from HTML
 * Produces premium-quality PDFs with full CSS support
 *
 * Supports both local development (regular puppeteer) and
 * serverless environments like Vercel (@sparticuz/chromium)
 */

import type { Browser } from "puppeteer-core";

export interface PuppeteerPDFOptions {
  /** HTML content to render */
  html: string;
  /** Page format - defaults to 'letter' */
  format?: "letter" | "a4";
  /** Print background colors and images */
  printBackground?: boolean;
  /** Page margins */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * Detect if we're running in a serverless environment
 */
function isServerless(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );
}

/**
 * Get a browser instance configured for the current environment
 */
async function getBrowser(): Promise<Browser> {
  if (isServerless()) {
    // Serverless environment - use @sparticuz/chromium
    const chromium = await import("@sparticuz/chromium");
    const puppeteer = await import("puppeteer-core");

    return puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });
  } else {
    // Local development - use regular puppeteer
    const puppeteer = await import("puppeteer");
    return puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
}

/**
 * Generate a PDF buffer from HTML using Puppeteer
 */
export async function generatePDFFromHTML(
  options: PuppeteerPDFOptions
): Promise<Buffer> {
  const {
    html,
    format = "letter",
    printBackground = true,
    margin = {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    },
  } = options;

  // Get browser for current environment
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    // Set content
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      printBackground,
      margin,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Save HTML to a temp file for browser preview during development
 */
export async function saveHTMLForPreview(
  html: string,
  filename: string = "report-preview.html"
): Promise<string> {
  const { writeFileSync } = await import("fs");
  const { join } = await import("path");

  const outputPath = join(process.cwd(), "test-pdfs", filename);
  writeFileSync(outputPath, html, "utf-8");

  return outputPath;
}
