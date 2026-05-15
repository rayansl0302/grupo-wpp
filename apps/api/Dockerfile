# Node 20 + Chromium instalado manualmente (evita Node 22 que quebra Baileys ESM)
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y \
    openssl ca-certificates \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libxshmfence1 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ─── Stage: builder ──────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm install
# Instala o Chromium do Playwright (vai pra /ms-playwright)
RUN npx playwright install chromium
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage: runner ───────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Copia o Chromium baixado pelo Playwright no builder
COPY --from=builder /ms-playwright /ms-playwright

RUN mkdir -p sessions logs data

EXPOSE 3333

CMD ["node", "dist/server.js"]
