import { mlService } from '../mercadolivre/ml.service';
import { searchShopeeNormalized } from '../shopee/shopee.adapter';
import type { MLNormalizedProduct, MLSearchParams } from '../mercadolivre/ml.types';

export type Provider = 'ml' | 'shopee';

/**
 * Dispatcher central: dado um provider, chama o crawler/api correto.
 * Retorna sempre no formato unificado MLNormalizedProduct.
 */
export async function searchByProvider(
  provider: Provider,
  params: MLSearchParams,
): Promise<MLNormalizedProduct[]> {
  switch (provider) {
    case 'shopee':
      return searchShopeeNormalized(params);
    case 'ml':
    default:
      return mlService.searchProducts(params);
  }
}

/**
 * Retorna list de providers ativos baseado nas credenciais configuradas.
 */
export function getEnabledProviders(): Provider[] {
  const enabled: Provider[] = ['ml']; // ML sempre ativo (tem fallback mock)
  if (process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET) {
    enabled.push('shopee');
  }
  return enabled;
}
