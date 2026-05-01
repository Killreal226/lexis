# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the SPA ----------
FROM node:20-alpine AS builder
WORKDIR /app

ENV CI=1

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

# ---------- Stage 2: serve via nginx ----------
FROM nginx:1.27-alpine AS runner

# envsubst для подстановки BACKEND_URL в шаблон конфига
RUN apk add --no-cache gettext

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# BACKEND_URL подставит штатный 20-envsubst-on-templates.sh nginx-образа.
# NGINX_ENVSUBST_FILTER ограничивает подстановку ровно одной переменной,
# чтобы не зацепить nginx-директивы вроде $host, $remote_addr и т.п.
ENV BACKEND_URL=http://host.docker.internal:8080 \
    NGINX_ENVSUBST_FILTER=^BACKEND_URL$

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
