# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# VITE_API_URL viene passato a build-time come ARG
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Stage 2: Serve con Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Copia la build di Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Configurazione Nginx: SPA fallback (tutte le route → index.html)
RUN printf 'server {\n\
    listen 4173;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
