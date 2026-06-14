# Nuvela backend — multi-stage build for Render.
# NOTE (Phase 0): no Prisma schema exists yet. Phase 1 adds `RUN npx prisma generate`
# in the build stage and copies the generated client into the runtime stage.

# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
