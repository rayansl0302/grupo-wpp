import axios, { AxiosInstance } from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { scrapeSearch } from './ml.scraper';
import { crawlSearch } from './ml.crawler';
import { prisma } from '../../config/database';
import type { MLNormalizedProduct, MLSearchParams, MLSearchResult } from './ml.types';

// ─── Mock data para desenvolvimento sem credenciais ML ─────────────────────────
const MOCK_PRODUCTS: MLNormalizedProduct[] = [
  {
    mlId: 'MLB1001',
    title: 'Smart TV 50" 4K Samsung Crystal UHD',
    originalPrice: 2799,
    salePrice: 1999,
    discount: 29,
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_samsung-tv.jpg',
    permalink: 'https://www.mercadolivre.com.br/smart-tv-50-samsung',
    freeShipping: true,
    seller: 'SAMSUNG_OFICIAL',
    soldCount: 3420,
    rating: 4.7,
    category: 'Televisores',
  },
  {
    mlId: 'MLB1002',
    title: 'Notebook Lenovo IdeaPad i5 8GB RAM 256GB SSD',
    originalPrice: 3499,
    salePrice: 2599,
    discount: 26,
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_lenovo-notebook.jpg',
    permalink: 'https://www.mercadolivre.com.br/notebook-lenovo-ideapad',
    freeShipping: true,
    seller: 'LENOVO_STORE',
    soldCount: 1850,
    rating: 4.5,
    category: 'Notebooks',
  },
  {
    mlId: 'MLB1003',
    title: 'Fone Bluetooth JBL Tune 770NC com Cancelamento de Ruído',
    originalPrice: 499,
    salePrice: 299,
    discount: 40,
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_jbl-tune.jpg',
    permalink: 'https://www.mercadolivre.com.br/fone-jbl-tune-770nc',
    freeShipping: true,
    seller: 'JBL_OFICIAL',
    soldCount: 7200,
    rating: 4.8,
    category: 'Fones de Ouvido',
  },
  {
    mlId: 'MLB1004',
    title: 'Aspirador de Pó Robô Roomba i3+ Mapeamento Inteligente',
    originalPrice: 2199,
    salePrice: 1499,
    discount: 32,
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_roomba.jpg',
    permalink: 'https://www.mercadolivre.com.br/aspirador-roomba-i3',
    freeShipping: false,
    seller: 'IROBOT_BRASIL',
    soldCount: 890,
    rating: 4.6,
    category: 'Aspiradores',
  },
  {
    mlId: 'MLB1005',
    title: 'iPhone 13 128GB Reembalado Apple — Garantia 1 Ano',
    originalPrice: 4999,
    salePrice: 3499,
    discount: 30,
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_iphone13.jpg',
    permalink: 'https://www.mercadolivre.com.br/iphone-13-128gb',
    freeShipping: true,
    seller: 'APPLE_REVENDEDOR',
    soldCount: 2100,
    rating: 4.9,
    category: 'Celulares',
  },
];

export class MercadoLivreService {
  private readonly http: AxiosInstance;
  private readonly siteId: string;
  private readonly affiliateId: string;
  private readonly useMock: boolean;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.siteId = env.ML_AFFILIATE_SITE_ID;
    this.affiliateId = env.ML_AFFILIATE_ID ?? '';
    this.useMock = !env.ML_APP_ID || !env.ML_CLIENT_SECRET;

    this.http = axios.create({
      baseURL: 'https://api.mercadolibre.com',
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });
  }

  /**
   * Obtem token de acesso. Prioridade:
   * 1. Token de USUARIO salvo no banco (OAuth Authorization Code) - tem acesso ao /search
   * 2. Token de APP via client_credentials - fallback (geralmente bloqueado para search)
   */
  private async getAccessToken(): Promise<string> {
    // Tenta usar token de usuario primeiro
    const userToken = await this.getUserToken().catch(() => null);
    if (userToken) return userToken;

    // Fallback: client_credentials
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    console.log('[ML] Obtendo token via client_credentials (fallback)...');
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.ML_APP_ID!,
      client_secret: env.ML_CLIENT_SECRET!,
    });

    const res = await axios.post<{ access_token: string; expires_in: number }>(
      'https://api.mercadolibre.com/oauth/token',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        timeout: 10_000,
      },
    );

    this.accessToken = res.data.access_token;
    this.tokenExpiresAt = now + (res.data.expires_in - 900) * 1000;
    return this.accessToken;
  }

  /** Obtem token de usuario do banco, renovando se necessario. */
  private async getUserToken(): Promise<string | null> {
    const token = await prisma.mLToken.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!token) return null;

    // Token ainda valido (com 5min de folga)
    if (token.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return token.accessToken;
    }

    // Renova via refresh_token
    console.log('[ML] Renovando token de usuario via refresh_token...');
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.ML_APP_ID!,
        client_secret: env.ML_CLIENT_SECRET!,
        refresh_token: token.refreshToken,
      });
      const res = await axios.post<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>('https://api.mercadolibre.com/oauth/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const expiresAt = new Date(Date.now() + res.data.expires_in * 1000);
      await prisma.mLToken.update({
        where: { id: token.id },
        data: {
          accessToken: res.data.access_token,
          refreshToken: res.data.refresh_token,
          expiresAt,
        },
      });
      console.log(`[ML] Token renovado, valido ate ${expiresAt.toISOString()}`);
      return res.data.access_token;
    } catch (err: any) {
      console.error('[ML] Falha ao renovar token de usuario:', err?.response?.data || err?.message);
      return null;
    }
  }

  async searchProducts(params: MLSearchParams): Promise<MLNormalizedProduct[]> {
    if (this.useMock) {
      console.log('[ML] usando MOCK (sem ML_APP_ID)');
      return this.applyFilters(MOCK_PRODUCTS, params);
    }

    // ESTRATEGIA #1: Crawler com Playwright + proxy residencial BR (mais confiavel em 2026)
    if (process.env.PROXY_USERNAME) {
      try {
        const products = await crawlSearch(params);
        if (products.length > 0) {
          console.log(`[ML] Crawler retornou ${products.length} produtos`);
          return products;
        }
      } catch (err: any) {
        console.error('[ML] Crawler falhou:', err?.message);
      }
    }

    // ESTRATEGIA #2: API oficial (geralmente bloqueada em 2026, mas tentamos)
    try {
      const raw = await this.fetchFromApi(params);
      console.log(`[ML] query="${params.query}" -> ${raw.length} produtos retornados`);
      const normalized = raw.map((item) => this.normalize(item));
      const filtered = normalized.filter((p) => this.passesQualityFilter(p, params));
      console.log(`[ML] apos filtros (minDiscount=${params.minDiscount}, maxPrice=${params.maxPrice}, freeShipping=${params.freeShipping}): ${filtered.length} produtos`);

      if (filtered.length > 0) {
        console.log(`[ML] exemplo: "${filtered[0].title}" - R$ ${filtered[0].salePrice} (discount: ${filtered[0].discount})`);
      } else if (normalized.length > 0) {
        // Mostra por que filtrou tudo
        const sample = normalized[0];
        console.log(`[ML] todos filtrados. Exemplo bruto: "${sample.title}" - R$${sample.salePrice} discount=${sample.discount} freeShipping=${sample.freeShipping} rating=${sample.rating}`);
      }

      return filtered;
    } catch (err: any) {
      console.error('[ML] API oficial falhou:', err?.response?.status, '- tentando scraper publico...');

      // Fallback 1: scraper da pagina publica (sempre funciona)
      try {
        const scraped = await scrapeSearch(params);
        const filtered = scraped.filter((p) => this.passesQualityFilter(p, params));
        console.log(`[ML-SCRAPER] ${scraped.length} brutos -> ${filtered.length} apos filtros`);
        if (filtered.length > 0) return filtered;
      } catch (scrapeErr: any) {
        console.error('[ML-SCRAPER] tambem falhou:', scrapeErr?.message);
      }

      // Fallback 2: mocks
      console.warn('[ML] usando MOCK como ultimo recurso');
      return this.applyFilters(MOCK_PRODUCTS, params);
    }
  }

  private async fetchFromApi(params: MLSearchParams): Promise<MLSearchResult[]> {
    const query: Record<string, string | number> = {
      site_id: this.siteId,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    };

    if (params.query) query.q = params.query;
    if (params.categoryId) query.category = params.categoryId;
    if (params.minPrice) query.price = `${params.minPrice}-*`;
    if (params.maxPrice) query.price = `*-${params.maxPrice}`;
    if (params.minPrice && params.maxPrice)
      query.price = `${params.minPrice}-${params.maxPrice}`;
    if (params.freeShipping) query.shipping_cost = 'free';

    const sortMap: Record<string, string> = {
      price_asc: 'price_asc',
      price_desc: 'price_desc',
      relevance: 'relevance',
      best_sellers: 'sold_quantity_desc',
    };
    query.sort = sortMap[params.sortBy ?? 'relevance'] ?? 'relevance';

    const token = await this.getAccessToken();
    // Adiciona token nos query params TAMBEM (alguns endpoints do ML aceitam assim)
    query.access_token = token;

    console.log(`[ML-API] GET /sites/${this.siteId}/search com query:`, Object.keys(query).join(','));

    try {
      const res = await this.http.get<{ results: MLSearchResult[] }>(`/sites/${this.siteId}/search`, {
        params: query,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tracking-Id': 'wpp-bot/1.0',
        },
      });
      return res.data.results;
    } catch (err: any) {
      console.error('[ML-API] erro:', err?.response?.status, JSON.stringify(err?.response?.data).slice(0, 300));
      throw err;
    }
  }

  private normalize(item: MLSearchResult): MLNormalizedProduct {
    const discount =
      item.original_price && item.original_price > item.price
        ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
        : null;

    return {
      mlId: item.id,
      title: item.title,
      originalPrice: item.original_price,
      salePrice: item.price,
      discount,
      thumbnail: item.thumbnail.replace(/I\.jpg$/, 'O.jpg'), // imagem maior
      permalink: item.permalink,
      freeShipping: item.shipping.free_shipping,
      seller: item.seller.nickname,
      soldCount: item.sold_quantity,
      rating: item.reviews?.rating_average ?? null,
      category: null,
    };
  }

  /** Filtra produtos ruins: preco suspeito, desconto falso, pouco vendido etc. */
  private passesQualityFilter(p: MLNormalizedProduct, params: MLSearchParams): boolean {
    // ML nem sempre retorna original_price - se minDiscount > 0 mas produto nao tem desconto calculavel,
    // so rejeitamos se tiver desconto E for menor. Se discount=null, permite passar.
    if (params.minDiscount && p.discount !== null && p.discount < params.minDiscount) return false;

    if (params.freeShipping && !p.freeShipping) return false;
    if (params.minPrice && p.salePrice < params.minPrice) return false;
    if (params.maxPrice && p.salePrice > params.maxPrice) return false;

    // Produto com avaliacao muito ruim
    if (p.rating !== null && p.rating < 3.5) return false;

    return true;
  }

  private applyFilters(
    products: MLNormalizedProduct[],
    params: MLSearchParams,
  ): MLNormalizedProduct[] {
    return products
      .filter((p) => {
        if (params.minDiscount && (!p.discount || p.discount < params.minDiscount)) return false;
        if (params.freeShipping && !p.freeShipping) return false;
        if (params.maxPrice && p.salePrice > params.maxPrice) return false;
        if (params.minPrice && p.salePrice < params.minPrice) return false;
        if (params.query) {
          const q = params.query.toLowerCase();
          if (!p.title.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .slice(0, params.limit ?? 20);
  }

  buildAffiliateUrl(permalink: string): string {
    if (!permalink || !this.affiliateId) return permalink;

    // Valida que e uma URL real do ML com produto (MLB-XXX ou /p/MLB-XXX)
    if (!/MLB-?\d+/.test(permalink)) {
      console.warn(`[ML] URL invalida (sem MLB-id): ${permalink}`);
      return permalink;
    }

    try {
      const url = new URL(permalink);
      url.searchParams.set('matt_tool', 'affiliate');
      url.searchParams.set('matt_word', this.affiliateId);
      url.searchParams.set('matt_source', 'wpp_bot');
      return url.toString();
    } catch (err) {
      console.warn(`[ML] URL malformada: ${permalink}`);
      return permalink;
    }
  }

  /** Valida se um produto tem URL utilizavel */
  isValidProductUrl(permalink: string): boolean {
    return !!permalink && /MLB-?\d+/.test(permalink) && permalink.startsWith('http');
  }
}

export const mlService = new MercadoLivreService();
