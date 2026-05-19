import axios from 'axios';
import crypto from 'crypto';

const SHOPEE_API_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

/**
 * Cliente da Shopee Affiliate Open API.
 * Docs: https://affiliate.shopee.com.br/open_api
 *
 * Autenticacao: HMAC SHA256 com timestamp.
 * Format: SHA256(AppId + Timestamp + Payload + Secret)
 */
class ShopeeClient {
  private readonly appId: string;
  private readonly appSecret: string;
  public readonly enabled: boolean;

  constructor() {
    this.appId = process.env.SHOPEE_APP_ID || '';
    this.appSecret = process.env.SHOPEE_APP_SECRET || '';
    this.enabled = !!(this.appId && this.appSecret);
    if (!this.enabled) {
      console.log('[SHOPEE] SHOPEE_APP_ID/SECRET nao configurados - integracao desativada');
    }
  }

  /**
   * Gera assinatura HMAC SHA256 conforme docs da Shopee:
   *   sign = SHA256(appId + timestamp + payload + appSecret)
   */
  private sign(timestamp: number, payload: string): string {
    const baseString = `${this.appId}${timestamp}${payload}${this.appSecret}`;
    return crypto.createHash('sha256').update(baseString).digest('hex');
  }

  /**
   * Executa query GraphQL na API da Shopee.
   */
  async query<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.enabled) {
      throw new Error('Shopee API nao configurada (SHOPEE_APP_ID + SHOPEE_APP_SECRET)');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query, variables });
    const signature = this.sign(timestamp, payload);

    const authHeader = `SHA256 Credential=${this.appId}, Timestamp=${timestamp}, Signature=${signature}`;

    console.log(`[SHOPEE] POST ${SHOPEE_API_URL} (query: ${query.slice(0, 60).replace(/\s+/g, ' ')})`);

    try {
      const res = await axios.post<{ data: T; errors?: any[] }>(
        SHOPEE_API_URL,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          timeout: 15_000,
        },
      );

      if (res.data.errors && res.data.errors.length > 0) {
        console.error('[SHOPEE] GraphQL errors:', JSON.stringify(res.data.errors).slice(0, 300));
        throw new Error(res.data.errors[0]?.message || 'Erro GraphQL Shopee');
      }

      return res.data.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.error(`[SHOPEE] erro:`, status, JSON.stringify(data).slice(0, 300));
      throw err;
    }
  }
}

export const shopeeClient = new ShopeeClient();
