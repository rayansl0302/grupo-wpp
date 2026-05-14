FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── Stage: builder ──────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage: runner ───────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN mkdir -p sessions logs data

EXPOSE 3333

# Schema ja esta sincronizado no Supabase - so inicia o servidor
CMD ["node", "dist/server.js"]
