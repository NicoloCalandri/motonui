# motonui (nextgen): one image, one process, one origin.
# The API (Hono) serves the built web app (Vite) from the same port, so that
# the browser talks to /api on the origin of the page.
#
#   docker build -t motonui \
#     --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... \
#     --build-arg VITE_MAPBOX_TOKEN=... nextgen/
#   docker run -p 3001:3001 --env-file nextgen/apps/api/.env motonui
#
# The VITE_* values are public by nature (they end up in the JavaScript sent
# to every visitor): never pass a secret as a build argument.

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MAPBOX_TOKEN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
RUN npm run build -w @motonui/api && npm run build -w @motonui/web


FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3001 \
    WEB_DIST=/app/apps/web/dist
WORKDIR /app

# Runtime dependencies of the API only: the web app is static files.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --omit=dev --workspace @motonui/api && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]
