import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  APP_SECRET: z.string().min(16),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  ML_APP_ID: z.string().optional(),
  ML_CLIENT_SECRET: z.string().optional(),
  ML_REDIRECT_URI: z.string().default('http://localhost:3333/auth/ml/callback'),
  ML_AFFILIATE_ID: z.string().optional(),
  ML_AFFILIATE_SITE_ID: z.string().default('MLB'),

  URL_SHORTENER: z.enum(['bitly', 'tinyurl', 'none']).default('tinyurl'),
  BITLY_TOKEN: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  DELAY_MIN_MS: z.coerce.number().default(8000),
  DELAY_MAX_MS: z.coerce.number().default(25000),
  DAILY_POST_LIMIT: z.coerce.number().default(50),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
