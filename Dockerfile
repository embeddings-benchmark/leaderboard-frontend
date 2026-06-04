# Hugging Face Spaces / GHCR Dockerfile for the SvelteKit leaderboard.
#
# Copies the local source tree, builds the static bundle (with
# PUBLIC_API_URL baked in), and serves it on :7860 behind
# nginx-unprivileged so it runs without root inside the Space.
#
# Build args (`--build-arg`) override the backend URL and base path:
#   --build-arg PUBLIC_API_URL=http://host.docker.internal:8000
#   --build-arg BASE_PATH=/leaderboardv2
# Defaults match the production HF Space.

# ---------- Stage 1: build the static bundle ----------
FROM node:24-alpine AS build

# Backend URL the prerendered bundle will call.
ARG PUBLIC_API_URL=https://mteb-leaderboard-backend.hf.space
ARG BASE_PATH=
ENV PUBLIC_API_URL=${PUBLIC_API_URL} \
    BASE_PATH=${BASE_PATH} \
    CI=1

WORKDIR /src

# Install deps first so a source-only change doesn't bust the npm
# install layer. Copy package.json + package-lock.json in isolation,
# then `npm ci` (falling back to `npm install` when the lockfile is
# missing — matches local dev).
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Now the rest of the source. `.dockerignore` keeps node_modules /
# build / .svelte-kit / .git out of the context so this stays a thin
# copy even on a large working tree.
COPY . .

RUN npm run build

# ---------- Stage 2: serve the prerendered output on :7860 ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# adapter-static emits 404.html as the SPA fallback (used by GitHub
# Pages). Mirror that here so client-only deep links resolve on refresh.
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
        # Adapter-static emits `404.html` as the SPA fallback shell
        # (configured in svelte.config.js via `fallback: '404.html'`).
        # Falling through to `/index.html` instead would serve the
        # prerendered HOME page for every unknown URL — the address
        # bar would still read `/benchmark/<name>/` but the rendered
        # content is the home, which looks like a redirect.
        try_files $uri $uri/ /404.html =404;
    }
}
NGINX

COPY --from=build /src/build /usr/share/nginx/html

EXPOSE 7860
CMD ["nginx", "-g", "daemon off;"]
