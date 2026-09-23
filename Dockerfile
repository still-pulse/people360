FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
RUN apk add --no-cache openssl poppler-utils
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Garante que os diretórios de upload existam com dono correto antes de montar o volume
RUN mkdir -p /app/public/uploads/logos /app/public/uploads/avatars /app/public/uploads/cvs \
    && chown -R nextjs:nodejs /app/public/uploads
RUN mkdir -p /app/storage/documentos-candidatos \
    && chown -R nextjs:nodejs /app/storage
# Prisma client já gerado no build; evita EACCES se algo tentar reescrever em runtime
RUN chown -R nextjs:nodejs /app/node_modules/.prisma /app/node_modules/@prisma /app/prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# --skip-generate: client já foi gerado no stage builder; só sincroniza o schema
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
