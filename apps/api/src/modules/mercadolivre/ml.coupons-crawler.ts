import { chromium, Browser, BrowserContext } from 'playwright';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function makeProxy() {
  if (!process.env.PROXY_USERNAME || !process.env.PROXY_PASSWORD) return undefined;
  const sessionId = Math.random().toString(36).slice(2, 12);
  const basePwd = process.env.PROXY_PASSWORD.split('_')[0];
  return {
    server: `http://${process.env.PROXY_HOSTNAME || 'geo.iproyal.com'}:${process.env.PROXY_PORT || '12321'}`,
    username: process.env.PROXY_USERNAME,
    password: `${basePwd}_country-br_session-${sessionId}_lifetime-10m`,
  };
}

export interface RawCoupon {
  externalId: string;
  title: string;
  description: string | null;
  code: string | null;
  discount: string | null;
  thumbnail: string | null;
  url: string;
  store: string | null;
}

/**
 * Crawler da pagina de cupons do Mercado Livre.
 * URL: https://www.mercadolivre.com.br/cupons
 */
export async function crawlCoupons(limit = 20): Promise<RawCoupon[]> {
  const proxy = makeProxy();
  console.log(`[COUPONS] Iniciando crawler ${proxy ? '(com proxy BR)' : '(sem proxy)'}`);

  const browser: Browser = await chromium.launch({
    headless: true,
    proxy,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Bloqueia recursos pesados pra economizar banda
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) return route.abort();
      return route.continue();
    });

    const page = await context.newPage();
    const url = 'https://www.mercadolivre.com.br/cupons';

    console.log(`[COUPONS] GET ${url}`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    console.log(`[COUPONS] Status: ${resp?.status()}`);

    await page.waitForTimeout(3000);

    const coupons = await page.evaluate(() => {
      const items: any[] = [];

      // Estrategia 1: cards de cupom (estrutura varia)
      const cards = document.querySelectorAll(
        '.cupons-coupon, .coupons-card, [class*="coupon-card"], [class*="cupom"]',
      );

      cards.forEach((el, idx) => {
        try {
          const title = el.querySelector('h2, h3, .title, [class*="title"]')?.textContent?.trim() || '';
          const description = el.querySelector('p, .description, [class*="description"]')?.textContent?.trim() || '';
          const discount = el.querySelector('[class*="discount"], [class*="off"], .badge')?.textContent?.trim() || '';
          const code = el.querySelector('[class*="code"], [data-code], input[readonly]')?.textContent?.trim() || '';
          const link = (el.querySelector('a[href]') as HTMLAnchorElement | null)?.href || '';
          const img = el.querySelector('img');
          const thumbnail = (img?.getAttribute('data-src') || img?.getAttribute('src') || '') as string;
          const store = el.querySelector('[class*="store"], [class*="brand"], [class*="seller"]')?.textContent?.trim() || '';

          if (title || description) {
            items.push({
              externalId: `coupon-${Date.now()}-${idx}`,
              title: title || description.slice(0, 60),
              description,
              code,
              discount,
              thumbnail,
              url: link,
              store,
            });
          }
        } catch {}
      });

      // Estrategia 2: JSON-LD se nao achou cards
      if (items.length === 0) {
        document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
          try {
            const json = JSON.parse(el.textContent || '{}');
            const list = Array.isArray(json) ? json : [json];
            for (const obj of list) {
              if (obj['@type'] === 'Offer' || obj['@type'] === 'PromotionalOffer') {
                items.push({
                  externalId: obj.identifier || `ld-${Date.now()}-${Math.random()}`,
                  title: obj.name || '',
                  description: obj.description || '',
                  code: obj.couponCode || null,
                  discount: obj.discount || null,
                  thumbnail: obj.image || null,
                  url: obj.url || '',
                  store: obj.seller?.name || null,
                });
              }
            }
          } catch {}
        });
      }

      return items;
    });

    console.log(`[COUPONS] Extraidos: ${coupons.length} cupons`);

    // Dedup por externalId/url
    const seen = new Set<string>();
    const unique: RawCoupon[] = [];
    for (const c of coupons) {
      const key = c.externalId || c.url || c.title;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(c);
    }

    console.log(`[COUPONS] Apos dedup: ${unique.length} cupons unicos`);
    return unique.slice(0, limit);
  } catch (err: any) {
    console.error(`[COUPONS] Erro: ${err?.message}`);
    return [];
  } finally {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
