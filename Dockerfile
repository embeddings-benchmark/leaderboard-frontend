# SvelteKit leaderboard for HF Spaces / GHCR. Builds the static
# bundle and serves it on :7860 via nginx-unprivileged (no root).
# Override the backend URL with `--build-arg PUBLIC_API_URL=…`.
#
# `PUBLIC_API_URL` is load-bearing at *build* time, not just runtime:
# the per-entity detail routes (benchmark/[name], tasks/[name],
# models/[...name]) have `prerender = true` with an `entries()` that
# fetches the catalogue from `${PUBLIC_API_URL}/v1/...`. The build
# emits one HTML file per benchmark / task / model so the share-card
# meta tags from ShareMeta land in the static HTML (otherwise the
# SPA fallback at 404.html serves a blank shell to crawlers). The
# backend Space must be awake and reachable when this stage runs.

# ---------- Stage 1: build the static bundle ----------
FROM node:24-alpine AS build

ARG PUBLIC_API_URL=https://mteb-leaderboard-backend.hf.space
ARG BASE_PATH=
ENV PUBLIC_API_URL=${PUBLIC_API_URL} \
    BASE_PATH=${BASE_PATH} \
    CI=1

WORKDIR /src

# Install deps first so source-only changes don't bust the npm layer.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

RUN npm run build

# ---------- Stage 2: serve the prerendered output on :7860 ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY <<'NGINX' /etc/nginx/conf.d/default.conf
server {
    listen 7860;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Hashed Vite asset bundles are content-addressed — cache forever.
    location /_app/ {
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location / {
        # 404.html is the adapter-static SPA fallback (svelte.config.js
        # `fallback: '404.html'`). Falling back to index.html instead
        # would serve the home page for unknown URLs.
        try_files $uri $uri/ /404.html =404;
    }
}
NGINX

COPY --from=build /src/build /usr/share/nginx/html

EXPOSE 7860
CMD ["nginx", "-g", "daemon off;"]
