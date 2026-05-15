import axios from 'axios';
import * as cheerio from 'cheerio';
import type { MLNormalizedProduct, MLSearchParams } from './ml.types';

/**
 * Scraper da pagina publica de busca do Mercado Livre.
 * Usado como fallback quando a API oficial bloqueia (403).
 */
export async function scrapeSearch(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
  const query = encodeURIComponent(params.query || '');
  let url = `https://lista.mercadolivre.com.br/${query}`;
  const filters: string[] = [];
  if (params.minDiscount) filters.push(`_DiscountRange_${params.minDiscount}-100`);
  if (params.freeShipping) filters.push(`_NoIndex_True_FreeShipping_yes`);
  if (params.maxPrice) filters.push(`_PriceRange_0-${params.maxPrice}`);
  if (filters.length > 0) url += filters.join('');

  console.log(`[ML-SCRAPER] Buscando: ${url}`);

  const res = await axios.get<string>(url, {
    timeout: 15_000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
  });

  const $ = cheerio.load(res.data);
  const products: MLNormalizedProduct[] = [];

  // Cards de produto na listagem
  $('li.ui-search-layout__item, .ui-search-result__wrapper').each((_, el) => {
    try {
      const $el = $(el);
      const title = $el.find('.poly-component__title, h2.ui-search-item__title').first().text().trim();
      const link = $el.find('a.poly-component__title, a.ui-search-link').first().attr('href') || '';
      const img = $el.find('img.poly-component__picture, img.ui-search-result-image__element').first();
      const thumbnail = img.attr('data-src') || img.attr('src') || '';

      // Preco atual (em centavos no atributo OU em texto)
      const priceText = $el.find('.poly-price__current .andes-money-amount__fraction, .ui-search-price__second-line .andes-money-amount__fraction').first().text().trim();
      const cents = $el.find('.poly-price__current .andes-money-amount__cents, .ui-search-price__second-line .andes-money-amount__cents').first().text().trim();

      const originalText = $el.find('.poly-price__del .andes-money-amount__fraction, .ui-search-price__original-value .andes-money-amount__fraction').first().text().trim();

      const salePrice = parsePrice(priceText, cents);
      const originalPrice = originalText ? parsePrice(originalText) : null;

      const discount = originalPrice && originalPrice > salePrice
        ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
        : null;

      const freeShipping = $el.text().toLowerCase().includes('frete gr');

      // Extrai mlId do link (ex: /MLB-123456789-...)
      const mlIdMatch = link.match(/MLB-?(\d+)/);
      const mlId = mlIdMatch ? `MLB${mlIdMatch[1]}` : `mlb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (title && link && salePrice > 0) {
        products.push({
          mlId,
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
    } catch (err) {
      // ignora produto malformado
    }
  });

  console.log(`[ML-SCRAPER] Extraidos ${products.length} produtos`);
  return products.slice(0, params.limit ?? 20);
}

function parsePrice(integer: string, cents = '00'): number {
  const intPart = integer.replace(/\D/g, '');
  const centPart = cents.replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  return parseFloat(`${intPart}.${centPart}`) || 0;
}
