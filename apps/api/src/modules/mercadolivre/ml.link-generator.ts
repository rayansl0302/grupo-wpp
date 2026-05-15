import { chromium, Browser, BrowserContext } from 'playwright';

const PROXY = process.env.PROXY_USERNAME
  ? {
      server: `http://${process.env.PROXY_HOSTNAME || 'geo.iproyal.com'}:${process.env.PROXY_PORT || '12321'}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : undefined;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Decodifica o storageState do ML salvo como base64 em ML_STORAGE_STATE */
function getStorageState(): any | null {
  const b64 = process.env.ML_STORAGE_STATE;
  if (!b64 || b64.length < 100) return null;
  try {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch (err) {
    console.error('[LINK-GEN] Erro ao decodificar ML_STORAGE_STATE:', err);
    return null;
  }
}

// Browser e context cacheados (reusa entre requisicoes)
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let lastUsed = 0;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

async function getContext(): Promise<BrowserContext | null> {
  const storageState = getStorageState();
  if (!storageState) {
    return null;
  }

  // Reusa se ainda esta vivo e nao deu timeout de idle
  if (context && browser && Date.now() - lastUsed < IDLE_TIMEOUT_MS) {
    try {
      context.pages(); // valida que esta vivo
      lastUsed = Date.now();
      return context;
    } catch {
      // contexto morreu, recria
    }
  }

  // Fecha anterior se existir
  if (browser) await browser.close().catch(() => {});

  console.log('[LINK-GEN] Iniciando Chromium com sessao autenticada do ML');
  browser = await chromium.launch({
    headless: true,
    proxy: PROXY,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  context = await browser.newContext({
    storageState,
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  lastUsed = Date.now();
  return context;
}

/**
 * Gera link de afiliado bonito (tipo /sec/XXX ou /social/{user}?ref=XXX)
 * usando o gerador do painel autenticado.
 *
 * Retorna null se nao tem sessao salva (ML_STORAGE_STATE) - fallback para matt_word manual.
 */
export async function generateAffiliateLink(productUrl: string): Promise<string | null> {
  const ctx = await getContext();
  if (!ctx) return null;

  const page = await ctx.newPage();
  const t0 = Date.now();

  try {
    console.log(`[LINK-GEN] Gerando link para: ${productUrl.slice(0, 80)}...`);

    // Tenta varias URLs do gerador (ML muda direto)
    const urls = [
      'https://www.mercadolivre.com.br/afiliados/criador/links',
      'https://www.mercadolivre.com.br/afiliados/linkbuilder',
      'https://www.mercadolivre.com.br/afiliados/recomendados',
      'https://www.mercadolivre.com.br/afiliados/criador/recomendados',
    ];

    let loaded = false;
    for (const url of urls) {
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        console.log(`[LINK-GEN] ${url} -> ${resp?.status()}`);
        if (resp && resp.status() < 400) {
          // Confirma que carregou conteudo do gerador (nao redirect para login)
          await page.waitForTimeout(2000);
          const title = await page.title();
          const hasTextarea = await page.locator('textarea').count() > 0;
          console.log(`[LINK-GEN] title="${title}" hasTextarea=${hasTextarea}`);
          if (hasTextarea && !title.toLowerCase().includes('login')) {
            loaded = true;
            break;
          }
        }
      } catch (err: any) {
        console.log(`[LINK-GEN] falhou ${url}: ${err?.message}`);
      }
    }

    if (!loaded) {
      console.warn('[LINK-GEN] Nenhuma URL do gerador funcionou. Sessao expirou?');
      return null;
    }

    // Foca, limpa e digita a URL (type dispara eventos do React)
    const textarea = page.locator('textarea').first();
    await textarea.click();
    await textarea.press('Control+A');
    await textarea.press('Delete');
    await textarea.type(productUrl, { delay: 10 });

    // Dispara eventos extra pra forcar o React a reconhecer
    await textarea.evaluate((el: any, value: string) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, productUrl);

    // Aguarda botao ficar enabled
    const generateBtn = page.locator('button:has-text("Gerar"), button:has-text("Generate")').first();
    await generateBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // Aguarda ate 15s o botao ficar enabled
    let tries = 0;
    while (tries < 30) {
      const disabled = await generateBtn.isDisabled().catch(() => true);
      if (!disabled) break;
      await page.waitForTimeout(500);
      tries++;
    }

    await generateBtn.click({ timeout: 10_000 });
    console.log(`[LINK-GEN] botao Gerar clicado em ${Date.now() - t0}ms`);

    await page.waitForTimeout(4000);

    // Tenta capturar o link gerado de varias formas
    const link = await page.evaluate(() => {
      // Estrategia 1: input/textarea com URL gerada
      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      for (const el of inputs) {
        const val = (el as HTMLInputElement).value || '';
        if (/mercadolivre\.com.*\/(sec|social)/.test(val)) return val;
        if (/meli\.la/.test(val)) return val;
      }

      // Estrategia 2: links na pagina apos gerar
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (/mercadolivre\.com.*\/sec\//.test(href)) return href;
        if (/meli\.la/.test(href)) return href;
      }

      // Estrategia 3: qualquer texto da pagina que pareca um link
      const text = document.body.innerText;
      const match = text.match(/https?:\/\/[^\s]*(?:mercadolivre\.com[^\s]*\/(?:sec|social)[^\s]*|meli\.la\/[^\s]*)/);
      return match ? match[0] : null;
    });

    if (link) {
      console.log(`[LINK-GEN] Link gerado em ${Date.now() - t0}ms: ${link.slice(0, 80)}`);
      return link;
    }

    // Debug: salva print da pagina pra ajustar seletores depois
    console.warn('[LINK-GEN] Nao achou link na pagina. Verifique seletores.');
    const html = await page.content();
    console.log(`[LINK-GEN] HTML length: ${html.length}, body inicio: ${html.slice(0, 500)}`);
    return null;
  } catch (err: any) {
    console.error('[LINK-GEN] Erro:', err?.message);
    return null;
  } finally {
    await page.close().catch(() => {});
    lastUsed = Date.now();
  }
}

/** Limpa o browser cacheado (chamar em SIGTERM ou reset) */
export async function closeLinkGenerator(): Promise<void> {
  await browser?.close().catch(() => {});
  browser = null;
  context = null;
}
