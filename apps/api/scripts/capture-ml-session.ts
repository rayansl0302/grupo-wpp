/* eslint-disable no-console */
/**
 * Script para capturar a sessao autenticada do Mercado Livre.
 *
 * Como usar (no seu PC):
 *   cd apps/api
 *   npx tsx scripts/capture-ml-session.ts
 *
 * Vai abrir um Chrome. Faca login no ML. Quando estiver no painel
 * de afiliados, volte aqui e pressione ENTER.
 *
 * Vai gerar 2 arquivos:
 *   - ml-session.json (a sessao em si)
 *   - ml-session.base64.txt (pronto pra colar no Railway)
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUT_JSON = path.resolve(process.cwd(), 'ml-session.json');
const OUT_B64 = path.resolve(process.cwd(), 'ml-session.base64.txt');

async function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });
}

async function main() {
  console.log('\n=== Captura de sessao do Mercado Livre ===\n');
  console.log('Abrindo o Chrome...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: null,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });

  const page = await context.newPage();

  console.log('Navegando para o painel de afiliados...');
  await page.goto('https://www.mercadolivre.com.br/afiliados-home', {
    waitUntil: 'domcontentloaded',
  });

  console.log('\n--------------------------------------------------------');
  console.log('  AGORA NO CHROME:');
  console.log('  1) Faca login no Mercado Livre');
  console.log('  2) Confirme 2FA se aparecer');
  console.log('  3) Espere chegar no PAINEL DE AFILIADOS');
  console.log('');
  console.log('  Quando estiver logado no painel, VOLTE AQUI');
  console.log('  e PRESSIONE ENTER para salvar a sessao.');
  console.log('--------------------------------------------------------\n');

  await waitForEnter();

  console.log('\nSalvando sessao...');
  await context.storageState({ path: OUT_JSON });

  const content = fs.readFileSync(OUT_JSON, 'utf-8');
  const base64 = Buffer.from(content).toString('base64');
  fs.writeFileSync(OUT_B64, base64);

  console.log(`\nSessao salva!`);
  console.log(`  JSON:   ${OUT_JSON}`);
  console.log(`  Base64: ${OUT_B64}`);

  console.log('\n=== PROXIMO PASSO ===');
  console.log('1. Abra o arquivo: ml-session.base64.txt');
  console.log('2. Copie TODO o conteudo (e UMA linha gigante)');
  console.log('3. Vai no Railway -> grupo-wpp -> Variables');
  console.log('4. Adiciona uma nova variavel:');
  console.log('     Name:  ML_STORAGE_STATE');
  console.log('     Value: <cole o base64>');
  console.log('5. Salva (Railway vai redeployar automatico)');
  console.log('\nPronto! O bot vai usar essa sessao pra gerar links bonitos.');
  console.log('A sessao geralmente dura 30 dias. Quando expirar, roda esse script de novo.\n');

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
