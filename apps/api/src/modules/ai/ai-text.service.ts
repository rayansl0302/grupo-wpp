import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { Product } from '@prisma/client';

class AITextService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async generateMessage(product: Product, affiliateUrl: string): Promise<string> {
    const client = this.getClient();

    const prompt = `
Você é um especialista em marketing de afiliados para WhatsApp.
Crie uma mensagem de divulgação para o produto abaixo.

Regras:
- Use emojis chamativos mas sem exagero (5-8 emojis no total)
- Tom entusiasmado mas natural, como um amigo compartilhando uma dica
- Máximo 12 linhas
- Termine com uma CTA forte
- Inclua o link exatamente como fornecido, sem modificar
- Não invente informações — use apenas os dados fornecidos

Produto: ${product.title}
Preço: R$ ${product.salePrice.toFixed(2)}
${product.originalPrice ? `Preço original: R$ ${product.originalPrice.toFixed(2)}` : ''}
${product.discount ? `Desconto: ${product.discount}%` : ''}
${product.freeShipping ? 'Frete: Grátis' : ''}
${product.rating ? `Avaliação: ${product.rating}/5` : ''}
Link: ${affiliateUrl}

Gere apenas o texto da mensagem, sem explicações adicionais.
`.trim();

    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.8,
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('IA não retornou conteúdo');

    logger.debug({ productId: product.id }, 'Texto gerado por IA');
    return text;
  }
}

export const aiTextService = new AITextService();
