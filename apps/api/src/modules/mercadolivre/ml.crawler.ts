import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { MLNormalizedProduct, MLSearchParams } from './ml.types';

const PROXY = process.env.PROXY_USERNAME
  ? {
      server: `http://${process.env.PROXY_HOSTNAME || 'geo.iproyal.com'}:${process.env.PROXY_PORT || '12321'}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : undefined;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Browser lazy (so inicia quando precisar)
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser) {
    try {
      // Verifica se ainda esta conectado
      browser.contexts();
      return browser;
    } catch {
      browser = null;
    }
  }

  console.log(`[CRAWLER] Iniciando Chromium ${PROXY ? '(com proxy BR)' : '(sem proxy)'}`);
  browser = await chromium.launch({
    headless: true,
    proxy: PROXY,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  return browser;
}

async function newPage(): Promise<{ page: Page; context: BrowserContext }> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  // Stealth manual: remove flags de automation
  await context.addInitScript(() => {
    // navigator.webdriver = false
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // navigator.languages
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en'] });
    // navigator.plugins length > 0
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    // Chrome runtime
    (window as any).chrome = { runtime: {} };
  });

  // Bloqueia imagens/fontes pra economizar banda do proxy
  await context.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,mp4,webm}', (route) => route.abort());

  const page = await context.newPage();
  return { page, context };
}

export async function crawlSearch(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  const query = (params.query || '').trim();
  if (!query) return [];

  const slug = encodeURIComponent(query).replace(/%20/g, '-');
  return crawlUrl(`https://lista.mercadolivre.com.br/${slug}`, params);
}

export async function crawlOffers(params: MLSearchParams = {}): Promise<MLNormalizedProduct[]> {
  return crawlUrl('https://www.mercadolivre.com.br/ofertas', params);
}

async function crawlUrl(url: string, params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  let context: BrowserContext | null = null;
  const t0 = Date.now();

  try {
    const result = await newPage();
    context = result.context;
    const { page } = result;

    console.log(`[CRAWLER] GET ${url}`);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    console.log(`[CRAWLER] Status: ${response?.status()} em ${Date.now() - t0}ms`);

    await page
      .waitForSelector('.poly-card, .ui-search-result__wrapper, .promotion-item', { timeout: 15_000 })
      .catch(() => console.log('[CRAWLER] Selector nao encontrado, tentando extrair mesmo assim'));

    const html = await page.content();
    console.log(`[CRAWLER] HTML: ${html.length} bytes`);

    const products: any[] = await page.evaluate(() => {
      const items: any[] = [];

      // Estrategia 1: JSON-LD
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
        try {
          const json = JSON.parse(el.textContent || '{}');
          const list = Array.isArray(json) ? json : [json];
          for (const obj of list) {
            if (obj['@type'] === 'ItemList' && Array.isArray(obj.itemListElement)) {
              for (const entry of obj.itemListElement) {
                const it = entry.item || entry;
                const price = parseFloat(it.offers?.price || it.offers?.lowPrice || 0);
                if (it.name && it.url && price > 0) {
                  items.push({
                    mlId: (it.url.match(/MLB-?(\d+)/)?.[1] || '') as string,
                    title: it.name as string,
                    salePrice: price,
                    originalPrice: null,
                    discount: null,
                    thumbnail: (it.image || '') as string,
                    permalink: it.url.split('?')[0] as string,
                    freeShipping: false,
                  });
                }
              }
            }
          }
        } catch {}
      });

      if (items.length > 0) return items;

      // Estrategia 2: cards HTML
      const cards = document.querySelectorAll(
        '.poly-card, .ui-search-result__wrapper, li.ui-search-layout__item, .promotion-item',
      );
      cards.forEach((el) => {
        try {
          const titleEl = el.querySelector(
            'a.poly-component__title-wrapper, a.poly-component__title, h2.ui-search-item__title, h3.poly-component__title, .promotion-item__title',
          ) as HTMLElement | null;
          const title = titleEl?.textContent?.trim() || '';
          const link = (titleEl as HTMLAnchorElement | null)?.href
            || (el.querySelector('a[href*="MLB"]') as HTMLAnchorElement | null)?.href
            || '';
          const img = el.querySelector('img');
          const thumbnail = (img?.getAttribute('data-src') || img?.getAttribute('src') || '') as string;

          const priceInt = el.querySelector(
            '.poly-price__current .andes-money-amount__fraction, .ui-search-price__second-line .andes-money-amount__fraction, .andes-money-amount__fraction',
          )?.textContent || '';
          const priceCents = el.querySelector(
            '.poly-price__current .andes-money-amount__cents, .ui-search-price__second-line .andes-money-amount__cents',
          )?.textContent || '00';
          const originalInt = el.querySelector(
            '.poly-price__del .andes-money-amount__fraction, s.andes-money-amount__fraction',
          )?.textContent || '';

          const salePrice = parseFloat(
            `${priceInt.replace(/\D/g, '')}.${priceCents.replace(/\D/g, '').padEnd(2, '0').slice(0, 2)}`,
          );
          const originalPrice = originalInt ? parseFloat(originalInt.replace(/\D/g, '')) : null;
          const discount = originalPrice && originalPrice > salePrice
            ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
            : null;
          const freeShipping = (el.textContent || '').toLowerCase().includes('frete gr');
          const mlIdMatch = link.match(/MLB-?(\d+)/);

          if (title && link && salePrice > 0) {
            items.push({
              mlId: mlIdMatch ? `MLB${mlIdMatch[1]}` : `mlb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title,
              salePrice,
              originalPrice,
              discount,
              thumbnail,
              permalink: link.split('#')[0].split('?')[0],
              freeShipping,
            });
          }
        } catch {}
      });

      return items;
    });

    console.log(`[CRAWLER] Extraidos: ${products.length} produtos`);

    const filtered = products
      .map((p) => ({
        mlId: p.mlId,
        title: p.title,
        salePrice: p.salePrice,
        originalPrice: p.originalPrice,
        discount: p.discount,
        thumbnail: p.thumbnail,
        permalink: p.permalink,
        freeShipping: p.freeShipping,
        seller: null,
        soldCount: null,
        rating: null,
        category: null,
      }) as MLNormalizedProduct)
      .filter((p) => {
        if (params.minDiscount && p.discount !== null && p.discount < params.minDiscount) return false;
        if (params.freeShipping && !p.freeShipping) return false;
        if (params.maxPrice && p.salePrice > params.maxPrice) return false;
        if (params.minPrice && p.salePrice < params.minPrice) return false;
        return true;
      })
      .slice(0, params.limit ?? 20);

    console.log(`[CRAWLER] Apos filtros: ${filtered.length} produtos`);
    return filtered;
  } catch (err: any) {
    console.error(`[CRAWLER] Erro: ${err?.message}`);
    return [];
  } finally {
    await context?.close().catch(() => {});
  }
}

process.on('SIGINT', async () => {
  await browser?.close().catch(() => {});
  process.exit(0);
});
