import axios from 'axios';
import * as cheerio from 'cheerio';
import type { MLNormalizedProduct, MLSearchParams } from './ml.types';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  'Cache-Control': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not A(Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Tenta multiplas estrategias para buscar produtos:
 * 1. ScraperAPI (se configurado) - bypass IP de cloud
 * 2. URL direta com user-agent
 * 3. AllOrigins proxy publico
 */
export async function scrapeSearch(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  const query = (params.query || '').trim();
  if (!query) return [];

  const querySlug = encodeURIComponent(query).replace(/%20/g, '-');
  const targetUrl = `https://lista.mercadolivre.com.br/${querySlug}`;

  // Estrategia 1: ScraperAPI com render JS + premium residential
  if (process.env.SCRAPER_API_KEY) {
    // render=true: executa JS (custa 10 creditos vs 1, mas ML precisa de JS)
    // premium=true: IP residencial (passa Cloudflare)
    // country_code=br: IP brasileiro
    const scraperParams = new URLSearchParams({
      api_key: process.env.SCRAPER_API_KEY,
      url: targetUrl,
      country_code: 'br',
      render: 'true',
      premium: 'true',
    });
    const scraperUrl = `http://api.scraperapi.com?${scraperParams.toString()}`;
    try {
      console.log(`[SCRAPER] Tentativa 1: ScraperAPI (render+premium) para "${query}"`);
      const t0 = Date.now();
      const res = await axios.get<string>(scraperUrl, { timeout: 120_000 });
      console.log(`[SCRAPER] ScraperAPI respondeu em ${Date.now() - t0}ms, ${res.data.length} bytes`);
      const products = parseHtml(res.data, params);
      if (products.length > 0) {
        console.log(`[SCRAPER] ScraperAPI OK: ${products.length} produtos`);
        return products;
      } else {
        console.log(`[SCRAPER] ScraperAPI respondeu mas extraiu 0 produtos. Inicio: ${res.data.slice(0, 400).replace(/\n/g, ' ')}`);
      }
    } catch (err: any) {
      console.error(`[SCRAPER] ScraperAPI falhou: ${err?.message} ${err?.response?.status || ''}`);
    }
  }

  // Estrategia 2: Acesso direto
  try {
    console.log(`[SCRAPER] Tentativa 2: direto para "${query}"`);
    const res = await axios.get<string>(targetUrl, {
      timeout: 15_000,
      headers: BROWSER_HEADERS,
      validateStatus: (s) => s < 500,
    });
    console.log(`[SCRAPER] HTTP ${res.status}, ${res.data.length} bytes`);
    if (res.data.length > 50_000) {
      const products = parseHtml(res.data, params);
      if (products.length > 0) {
        console.log(`[SCRAPER] Direto OK: ${products.length} produtos`);
        return products;
      }
    } else {
      console.log(`[SCRAPER] Pagina pequena (${res.data.length} bytes) - provavel block. Trecho: ${res.data.slice(0, 200).replace(/\n/g, ' ')}`);
    }
  } catch (err: any) {
    console.error(`[SCRAPER] Direto falhou: ${err?.message}`);
  }

  // Estrategia 3: Proxy publico AllOrigins
  try {
    console.log(`[SCRAPER] Tentativa 3: AllOrigins proxy para "${query}"`);
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await axios.get<string>(proxyUrl, { timeout: 30_000 });
    console.log(`[SCRAPER] AllOrigins HTTP ${res.status}, ${res.data.length} bytes`);
    if (res.data.length > 50_000) {
      const products = parseHtml(res.data, params);
      if (products.length > 0) {
        console.log(`[SCRAPER] AllOrigins OK: ${products.length} produtos`);
        return products;
      }
    }
  } catch (err: any) {
    console.error(`[SCRAPER] AllOrigins falhou: ${err?.message}`);
  }

  console.warn('[SCRAPER] Todas as estrategias falharam');
  return [];
}

function parseHtml(html: string, params: MLSearchParams): MLNormalizedProduct[] {
  const $ = cheerio.load(html);
  const products: MLNormalizedProduct[] = [];

  // Extrai do JSON-LD (mais estavel)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
          for (const entry of item.itemListElement) {
            const it = entry.item || entry;
            const price = parseFloat(it.offers?.price || it.offers?.lowPrice || 0);
            if (it.name && it.url && price > 0) {
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
    } catch { /* ignora */ }
  });

  if (products.length > 0) return products.slice(0, params.limit ?? 20);

  // Fallback: parsing HTML moderno
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
    } catch { /* ignora */ }
  });

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
