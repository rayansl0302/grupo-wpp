import axios from 'axios';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export async function shortenUrl(originalUrl: string): Promise<string> {
  if (env.URL_SHORTENER === 'none') return originalUrl;

  try {
    if (env.URL_SHORTENER === 'bitly' && env.BITLY_TOKEN) {
      return await shortenWithBitly(originalUrl);
    }
    return await shortenWithTinyUrl(originalUrl);
  } catch (err) {
    logger.warn({ err, url: originalUrl }, 'Falha ao encurtar URL, usando original');
    return originalUrl;
  }
}

async function shortenWithTinyUrl(url: string): Promise<string> {
  const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, {
    timeout: 5000,
  });
  return res.data as string;
}

async function shortenWithBitly(url: string): Promise<string> {
  const res = await axios.post(
    'https://api-ssl.bitly.com/v4/shorten',
    { long_url: url, domain: 'bit.ly' },
    {
      headers: { Authorization: `Bearer ${env.BITLY_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 5000,
    },
  );
  return (res.data as { link: string }).link;
}

/**
 * Monta a URL de afiliado do Mercado Livre.
 * O ML usa o parâmetro ?matt_tool=affiliate&matt_word=<affiliate_id>
 */
export function buildAffiliateUrl(permalink: string, affiliateId: string): string {
  const url = new URL(permalink);
  url.searchParams.set('matt_tool', 'affiliate');
  url.searchParams.set('matt_word', affiliateId);
  url.searchParams.set('matt_source', 'wpp_bot');
  return url.toString();
}
