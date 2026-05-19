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

function getStorageState(): any | null {
  const b64 = process.env.ML_STORAGE_STATE;
  if (!b64 || b64.length < 100) return null;
  try {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
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
  validUntil: string | null;
  budget: string | null;
}

/**
 * Crawler da pagina autenticada de cupons do programa de afiliados.
 * URL: https://www.mercadolivre.com.br/afiliados/coupons#hub
 *
 * Requer ML_STORAGE_STATE configurado (cookies do painel).
 */
export async function crawlCoupons(limit = 30): Promise<RawCoupon[]> {
  const storageState = getStorageState();
  if (!storageState) {
    console.warn('[COUPONS] ML_STORAGE_STATE nao configurado - nao consegue acessar painel autenticado');
    return [];
  }

  const proxy = makeProxy();
  console.log(`[COUPONS] Iniciando crawler autenticado ${proxy ? '(com proxy BR)' : ''}`);

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
      storageState,
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // Bloqueia recursos pesados (mas mantém scripts/xhr pra react funcionar)
    await context.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font'].includes(type)) return route.abort();
      return route.continue();
    });

    const page = await context.newPage();
    const url = 'https://www.mercadolivre.com.br/afiliados/coupons';

    console.log(`[COUPONS] GET ${url}`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    console.log(`[COUPONS] Status inicial: ${resp?.status()}`);

    // Aguarda redirect/renderizacao
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle').catch(() => {});

    const finalUrl = page.url();
    const title = await page.title();
    console.log(`[COUPONS] URL final: ${finalUrl}`);
    console.log(`[COUPONS] Title: "${title}"`);

    if (finalUrl.includes('/login') || title.toLowerCase().includes('login')) {
      console.warn('[COUPONS] Sessao ML expirou - renovar ML_STORAGE_STATE');
      return [];
    }

    const coupons = await page.evaluate(() => {
      const items: any[] = [];

      // Pega TODOS os elementos que parecem cards de cupom
      // O painel ML usa Andes UI, então tem classes específicas
      const cards = document.querySelectorAll(
        '[class*="coupon-card"], [class*="couponCard"], [class*="card-coupon"], ' +
        'article, [class*="andes-card"][role], .available-coupons-list > div, ' +
        '[class*="coupon"][class*="item"]'
      );

      console.log(`[CARDS-FOUND] ${cards.length}`);

      cards.forEach((el, idx) => {
        try {
          const text = el.textContent || '';

          // Procura padrão "R$ X OFF" ou "X% OFF" no texto do card
          const discountMatch = text.match(/R\$\s*([\d.,]+)\s*OFF/i) || text.match(/(\d+)%\s*OFF/i);
          if (!discountMatch) return;

          const discount = discountMatch[0].trim();

          // Loja / "Em produtos de XXX"
          const storeMatch = text.match(/Em produtos de\s+([^\n]+?)(?:\s*Ver produtos|\s*$)/i);
          const store = storeMatch?.[1]?.trim() || null;

          // Validade
          const validMatch = text.match(/Vence em\s+(\d+\s+de\s+\w+)/i);
          const validUntil = validMatch?.[1] || null;

          // Orcamento
          const budgetMatch = text.match(/Or[çc]amento[^:]*:?\s*R\$\s*([\d.,]+)/i);
          const budget = budgetMatch?.[1] || null;

          // Link pra ver produtos (geralmente onde levaria o cupom)
          const link = (el.querySelector('a[href*="MLB"], a[href*="meli.la"]') as HTMLAnchorElement | null)?.href || '';

          // Codigo (se ja foi gerado, pode aparecer)
          const codeMatch = text.match(/CUPOM[A-Z0-9]+|[A-Z]{3,}\d+/);
          const code = codeMatch?.[0] || null;

          // Titulo composto: "R$ 30 OFF em produtos de Darklab"
          const title = store ? `${discount} em produtos de ${store}` : discount;
          const description = validUntil ? `Vence em ${validUntil}` : null;

          // ID unico (combina store + discount + validade)
          const externalId = `aff-${(store || 'generic').toLowerCase().replace(/\s+/g, '-')}-${discount.replace(/\s+/g, '')}-${validUntil || idx}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '');

          items.push({
            externalId,
            title,
            description,
            code,
            discount,
            thumbnail: null,
            url: link,
            store,
            validUntil,
            budget,
          });
        } catch {}
      });

      return items;
    });

    console.log(`[COUPONS] Extraidos: ${coupons.length} cupons`);

    // Dedup por externalId
    const seen = new Set<string>();
    const unique: RawCoupon[] = [];
    for (const c of coupons) {
      if (seen.has(c.externalId)) continue;
      seen.add(c.externalId);
      unique.push(c);
    }

    console.log(`[COUPONS] Apos dedup: ${unique.length} cupons unicos`);

    if (unique.length === 0) {
      // Debug: log HTML pra ajustar seletores
      const html = await page.content();
      console.log(`[COUPONS] DEBUG HTML length: ${html.length}`);
      const sampleText = await page.evaluate(() =>
        document.body.innerText.slice(0, 500),
      );
      console.log(`[COUPONS] DEBUG sample text: ${sampleText.replace(/\n/g, ' | ')}`);
    }

    return unique.slice(0, limit);
  } catch (err: any) {
    console.error(`[COUPONS] Erro: ${err?.message}`);
    return [];
  } finally {
    await context?.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
