FROM node:22-alpine AS builder

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json
COPY apps/user_entry/package.json apps/user_entry/package.json
COPY apps/administration/package.json apps/administration/package.json
COPY apps/scheduling/package.json apps/scheduling/package.json
COPY apps/competencies/package.json apps/competencies/package.json
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /repo

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace backend --workspace @uniweaver/shared

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/dist ./dist
COPY backend ./backend
COPY packages/shared ./packages/shared

EXPOSE 3000

CMD ["npx", "tsx", "backend/src/index.ts"]