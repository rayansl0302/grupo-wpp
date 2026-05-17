import { chromium, Browser, BrowserContext } from 'playwright';
import { log } from '../logs/app-logger';

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
    proxy: makeProxy(),
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

    // Acessa o gerador (aceita redirects automaticamente)
    try {
      await page.goto('https://www.mercadolivre.com.br/afiliados/linkbuilder', {
        waitUntil: 'load',
        timeout: 30_000,
      });
    } catch (err: any) {
      // Se interrompido por redirect, tenta de novo
      console.log(`[LINK-GEN] navegacao interrompida (${err?.message?.slice(0, 80)}), aguardando settle...`);
      await page.waitForTimeout(3000);
    }

    // Aguarda a pagina final carregar (ela pode redirecionar)
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const title = await page.title();
    const hasTextarea = await page.locator('textarea').count() > 0;
    console.log(`[LINK-GEN] url=${currentUrl}`);
    console.log(`[LINK-GEN] title="${title}" hasTextarea=${hasTextarea}`);

    if (!hasTextarea || title.toLowerCase().includes('login')) {
      console.warn('[LINK-GEN] Pagina nao tem textarea ou caiu no login. Sessao expirou?');
      log.error('linkgen', 'Sessao ML expirou - renovar ML_STORAGE_STATE', {
        currentUrl,
        title,
        hasTextarea,
        productUrl: productUrl.slice(0, 100),
      });
      return null;
    }

    // Foca a textarea
    const textarea = page.locator('textarea').first();
    await textarea.click();

    // Usa o NATIVE setter do React (Andes UI exige isso pra detectar input)
    await page.evaluate((url: string) => {
      const ta = document.querySelector('textarea');
      if (!ta) return;
      const proto = Object.getPrototypeOf(ta);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(ta, url);
      } else {
        ta.value = url;
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      ta.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      ta.blur();
      ta.focus();
    }, productUrl);

    await page.waitForTimeout(1500);

    // Localiza o botao Gerar
    const generateBtn = page.locator('button.links-form__button, button:has-text("Gerar")').first();
    await generateBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // Aguarda ate 30s o botao ficar enabled (ML valida a URL antes)
    let tries = 0;
    let enabled = false;
    while (tries < 60) {
      const isDisabled = await generateBtn.evaluate((el: HTMLButtonElement) => {
        return el.disabled || el.getAttribute('data-andes-state') === 'disabled' || el.classList.contains('andes-button--disabled');
      }).catch(() => true);
      if (!isDisabled) {
        enabled = true;
        break;
      }
      await page.waitForTimeout(500);
      tries++;
    }

    if (!enabled) {
      console.warn(`[LINK-GEN] botao Gerar nunca habilitou apos ${tries * 500}ms`);
      log.warn('linkgen', `Botao Gerar nunca habilitou apos ${tries * 500}ms`, {
        productUrl: productUrl.slice(0, 100),
        title: await page.title(),
      });
      return null;
    }

    console.log(`[LINK-GEN] botao Gerar habilitou em ${Date.now() - t0}ms`);
    await generateBtn.click({ timeout: 5_000 });
    console.log('[LINK-GEN] botao clicado, aguardando link aparecer...');

    await page.waitForTimeout(5000);

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
      log.info('linkgen', `Link oficial gerado em ${Date.now() - t0}ms`, {
        link: link.slice(0, 120),
      });
      return link;
    }

    // Debug: salva print da pagina pra ajustar seletores depois
    console.warn('[LINK-GEN] Nao achou link na pagina. Verifique seletores.');
    const html = await page.content();
    console.log(`[LINK-GEN] HTML length: ${html.length}, body inicio: ${html.slice(0, 500)}`);
    log.error('linkgen', 'Nao encontrou link gerado na pagina apos clicar Gerar', {
      htmlLength: html.length,
      bodyStart: html.slice(0, 300),
      productUrl: productUrl.slice(0, 100),
    });
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
