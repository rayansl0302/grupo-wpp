import axios from 'axios';
import * as cheerio from 'cheerio';
import type { MLNormalizedProduct, MLSearchParams } from './ml.types';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not A(Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Scraper da pagina publica de busca do ML.
 * Tenta extrair via JSON-LD primeiro (mais confiavel) e depois cai pra HTML parsing.
 */
export async function scrapeSearch(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  const query = encodeURIComponent(params.query || '').replace(/%20/g, '-');
  const url = `https://lista.mercadolivre.com.br/${query}`;

  console.log(`[ML-SCRAPER] GET ${url}`);

  const res = await axios.get<string>(url, {
    timeout: 20_000,
    headers: BROWSER_HEADERS,
    maxRedirects: 5,
    validateStatus: (s) => s < 500,
  });

  console.log(`[ML-SCRAPER] HTTP ${res.status}, HTML ${res.data.length} bytes`);

  if (res.status >= 400) {
    console.error(`[ML-SCRAPER] Resposta com erro. Inicio do body: ${res.data.slice(0, 200)}`);
    return [];
  }

  const $ = cheerio.load(res.data);

  // ─── Tentativa 1: JSON-LD embutido ──────────────────────────────────────────
  const products: MLNormalizedProduct[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
          for (const entry of item.itemListElement) {
            const it = entry.item || entry;
            if (it.name && it.url) {
              const price = parseFloat(it.offers?.price || it.offers?.lowPrice || 0);
              if (price > 0) {
                products.push({
                  mlId: extractMlId(it.url),
                  title: it.name,
                  salePrice: price,
                  originalPrice: null,
                  discount: null,
                  thumbnail: it.image || '',
                  permalink: it.url.split('?')[0],
                  freeShipping: false,
                  seller: it.brand?.name || null,
                  soldCount: null,
                  rating: it.aggregateRating?.ratingValue ? parseFloat(it.aggregateRating.ratingValue) : null,
                  category: null,
                });
              }
            }
          }
        }
      }
    } catch {
      // ignora JSON malformado
    }
  });

  if (products.length > 0) {
    console.log(`[ML-SCRAPER] Extraidos ${products.length} via JSON-LD`);
    return products.slice(0, params.limit ?? 20);
  }

  // ─── Tentativa 2: HTML moderno (poly-card) ──────────────────────────────────
  $('.poly-card, .ui-search-result__wrapper, li.ui-search-layout__item').each((_, el) => {
    try {
      const $el = $(el);
      const titleEl = $el.find('a.poly-component__title-wrapper, a.poly-component__title, h2.ui-search-item__title, h3.poly-component__title').first();
      const title = titleEl.text().trim() || titleEl.find('h2, h3').text().trim();
      const link = titleEl.attr('href') || $el.find('a[href*="/MLB"]').first().attr('href') || '';

      const img = $el.find('img').first();
      const thumbnail = img.attr('data-src') || img.attr('src') || '';

      const priceText = $el.find('.poly-price__current .andes-money-amount__fraction, .ui-search-price__second-line .andes-money-amount__fraction').first().text().trim();
      const cents = $el.find('.poly-price__current .andes-money-amount__cents, .ui-search-price__second-line .andes-money-amount__cents').first().text().trim();
      const originalText = $el.find('.poly-price__del .andes-money-amount__fraction, s.andes-money-amount__fraction').first().text().trim();

      const salePrice = parsePrice(priceText, cents);
      const originalPrice = originalText ? parsePrice(originalText) : null;
      const discount = originalPrice && originalPrice > salePrice
        ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
        : null;

      const freeShipping = $el.find('.poly-component__shipping, .ui-search-item__shipping').text().toLowerCase().includes('gr');

      if (title && link && salePrice > 0) {
        products.push({
          mlId: extractMlId(link),
          title,
          salePrice,
          originalPrice,
          discount,
          thumbnail,
          permalink: link.split('#')[0].split('?')[0],
          freeShipping,
          seller: null,
          soldCount: null,
          rating: null,
          category: null,
        });
      }
    } catch {
      // ignora
    }
  });

  console.log(`[ML-SCRAPER] Extraidos ${products.length} via HTML parsing`);

  if (products.length === 0) {
    // Debug: mostra trechos da pagina pra entender estrutura
    const titles = $('h2, h3').slice(0, 3).map((_, el) => $(el).text().trim()).get();
    console.log(`[ML-SCRAPER] DEBUG - primeiros titulos h2/h3: ${JSON.stringify(titles)}`);
    const links = $('a[href*="MLB"]').slice(0, 3).map((_, el) => $(el).attr('href')).get();
    console.log(`[ML-SCRAPER] DEBUG - primeiros links MLB: ${JSON.stringify(links)}`);
  }

  return products.slice(0, params.limit ?? 20);
}

function extractMlId(url: string): string {
  const match = url.match(/MLB-?(\d+)/);
  return match ? `MLB${match[1]}` : `mlb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePrice(integer: string, cents = '00'): number {
  const intPart = integer.replace(/\D/g, '');
  const centPart = cents.replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  return parseFloat(`${intPart}.${centPart}`) || 0;
}
