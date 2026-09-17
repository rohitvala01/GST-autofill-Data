import { chromium } from 'playwright';
import Tesseract from 'tesseract.js';

// Global references for persistent browser window & context
let globalBrowser = null;
let globalContext = null;

/**
 * Get or launch persistent Chromium browser window
 */
async function getBrowserContext() {
  if (globalBrowser && globalBrowser.isConnected() && globalContext) {
    return globalContext;
  }

  console.log('[Playwright] Launching persistent Chromium browser window...');
  globalBrowser = await chromium.launch({
    headless: false,
    args: [
      '--start-maximized', 
      '--no-sandbox', 
      '--disable-setuid-sandbox'
    ]
  });

  globalBrowser.on('disconnected', () => {
    console.log('[Playwright] Browser closed by user.');
    globalBrowser = null;
    globalContext = null;
  });

  globalContext = await globalBrowser.newContext({ viewport: null });
  return globalContext;
}

/**
 * Solve GST Captcha image buffer using Tesseract OCR
 */
async function solveCaptchaFromBuffer(buffer) {
  try {
    console.log('[OCR] Processing GST Captcha image with Tesseract...');
    const result = await Tesseract.recognize(buffer, 'eng');
    const text = result?.data?.text || '';
    const digitsOnly = text.replace(/[^0-9]/g, '').trim();
    console.log(`[OCR] Raw text: "${text.trim()}" | Extracted Digits: "${digitsOnly}"`);
    return digitsOnly;
  } catch (err) {
    console.error('[OCR Error]', err);
    return '';
  }
}

/**
 * Launch or focus browser with the React Dashboard open
 */
export async function launchBrowserWithDashboard(clientUrl = 'http://localhost:5174') {
  const context = await getBrowserContext();
  
  const pages = context.pages();
  let dashboardPage = pages.find(p => p.url().includes('localhost'));

  if (!dashboardPage) {
    dashboardPage = await context.newPage();
    await dashboardPage.goto(clientUrl, { waitUntil: 'domcontentloaded' });
  }

  await dashboardPage.bringToFront().catch(() => {});
  return { success: true, message: 'Dashboard opened in automated browser window.' };
}

/**
 * Automate GST Portal login by opening a NEW TAB in the active browser window.
 * @param {Object} params
 * @param {string} params.username
 * @param {string} params.password
 * @param {string} [params.gstin]
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function autoFillGstLogin({ username, password, gstin }) {
  if (!username || !password) {
    throw new Error('Username and password are required for auto-fill');
  }

  const context = await getBrowserContext();
  const page = await context.newPage();

  let latestCaptchaBuffer = null;

  // Intercept GST Captcha Image response directly from network stream
  page.on('response', async (res) => {
    if (res.url().includes('captcha')) {
      try {
        latestCaptchaBuffer = await res.body();
        console.log('[Playwright] Intercepted Captcha Image from GST network stream!');
      } catch (e) {
        // ignore stream read error
      }
    }
  });

  try {
    const targetUrl = 'https://services.gst.gov.in/services/login';
    console.log(`[Playwright] Navigating tab to ${targetUrl}...`);

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('[Playwright] Page loaded. Locating GST form fields...');

    // 1. Wait for VISIBLE username input (#username)
    await page.waitForSelector('#username', { state: 'visible', timeout: 20000 });

    // 2. Fill Username
    console.log('[Playwright] Filling username...');
    const userInput = page.locator('#username');
    await userInput.click();
    await userInput.fill('');
    await userInput.fill(username);
    await userInput.dispatchEvent('input').catch(() => {});
    await userInput.dispatchEvent('change').catch(() => {});

    // 3. Fill Password
    console.log('[Playwright] Locating visible password field (#user_pass)...');
    await page.waitForSelector('#user_pass', { state: 'visible', timeout: 20000 });
    
    const passInput = page.locator('#user_pass');
    await passInput.click();
    await passInput.fill('');
    await passInput.fill(password);
    await passInput.dispatchEvent('input').catch(() => {});
    await passInput.dispatchEvent('change').catch(() => {});

    // 4. Handle CAPTCHA Field & Auto-OCR Solving
    console.log('[Playwright] Locating CAPTCHA field...');
    const captchaLocator = page.locator('#captcha').first();
    await captchaLocator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

    // Wait up to 3 seconds for Angular to fetch and finish the Captcha image response
    for (let i = 0; i < 15; i++) {
      if (latestCaptchaBuffer) break;
      await page.waitForTimeout(200);
    }

    if (await captchaLocator.isVisible().catch(() => false)) {
      await captchaLocator.focus().catch(() => {});
      await captchaLocator.click().catch(() => {});

      // If captcha buffer was intercepted, run OCR and attempt auto-fill
      if (latestCaptchaBuffer) {
        const solvedDigits = await solveCaptchaFromBuffer(latestCaptchaBuffer);
        if (solvedDigits && solvedDigits.length >= 3) {
          console.log(`[Playwright] Auto-filling solved CAPTCHA digits: ${solvedDigits}`);
          await captchaLocator.fill(solvedDigits);
          await captchaLocator.dispatchEvent('input').catch(() => {});
          await captchaLocator.dispatchEvent('change').catch(() => {});
        }
      }
    }

    // 5. Bring new tab to front focus
    await page.bringToFront().catch(() => {});

    console.log(`[Playwright] Credentials & CAPTCHA processing completed for ${username}!`);

    return {
      success: true,
      message: `Credentials for "${username}" filled! Please enter/verify the CAPTCHA and click Login.`
    };
  } catch (error) {
    console.error('[Playwright Error]', error);
    return {
      success: false,
      message: `Failed to autofill: ${error.message}`
    };
  }
}
