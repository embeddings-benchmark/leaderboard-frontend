# Hugging Face Spaces Dockerfile for the SvelteKit leaderboard.
#
# Clones embeddings-benchmark/leaderboardv2 @ integration, builds the
# static bundle (with PUBLIC_API_URL baked in), and serves it on :7860
# behind nginx-unprivileged so it runs without root inside the Space.
#
# Everything is hardcoded — Spaces does not pass build args, and there
# is no docker-compose layer. Edit this file and rebuild to change repo,
# branch, or the backend URL.

# ---------- Stage 1: build the static bundle from a fresh clone ----------
FROM node:22-alpine AS build

# Backend URL the prerendered bundle will call. The HF Space hardcodes
# the production hub URL via these defaults; pass `--build-arg
# PUBLIC_API_URL=http://host.docker.internal:8000` to point a local
# image at a backend running on the host machine.
ARG PUBLIC_API_URL=https://mteb-leaderboard-backend.hf.space
ARG BASE_PATH=
ENV PUBLIC_API_URL=${PUBLIC_API_URL} \
    BASE_PATH=${BASE_PATH} \
    CI=1

RUN apk add --no-cache git
WORKDIR /src
RUN git clone --depth=1 --branch integration \
        https://github.com/embeddings-benchmark/leaderboardv2.git .

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
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
