# =============================================================================
# STAGE 1 — deps: installa solo le dipendenze Node.js di produzione
# =============================================================================
FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# =============================================================================
# STAGE 2 — builder: compila TypeScript
# =============================================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

# =============================================================================
# STAGE 3 — runtime: immagine finale con XeLaTeX + Pandoc
#
# Base: debian:bookworm-slim (stabile, riproducibile, ~120 MB base)
# TeX Live: texlive-xetex + pacchetti necessari per SaaS produzione
# Pandoc: binario ufficiale da GitHub releases (versione pinned)
#
# FIX: aggiunto pacchetto `lmodern` — richiesto da pandoc/xelatex come
# dipendenza implicita per il template LaTeX di default.
# Senza lmodern, xelatex esce con: "File `lmodern.sty' not found"
# =============================================================================
FROM debian:bookworm-slim AS runtime

# --- variabili build-time ---
ARG PANDOC_VERSION=3.6.4
ARG TARGETARCH=amd64
ARG PANDOC_SHA256_AMD64=68e5516a5464b12354146e9e23bc41a4c05f302f4ba5def9bdc49f1e2db0d1e0
ARG PANDOC_SHA256_ARM64=33c8e3456a2bd2a0b58b88583ba7f0f126c6b7a4cfc1c04206cd538e4bbd4b04

# --- variabili ambiente runtime ---
ENV NODE_ENV=production \
    PANDOC_PATH=/usr/local/bin/pandoc \
    TEXMFVAR=/tmp/texmf-var \
    TEXMFCONFIG=/tmp/texmf-config \
    DEBIAN_FRONTEND=noninteractive \
    TZ=Europe/Rome

# ---------------------------------------------------------------------------
# 1. Dipendenze sistema + TeX Live XeLaTeX-only
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Runtime Node
    ca-certificates \
    # TeX Live — motore XeLaTeX e pacchetti core
    texlive-xetex \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    # FIX CRITICO: lmodern è richiesto dal template LaTeX di default di pandoc.
    # Senza questo pacchetto, xelatex fallisce con:
    # "File `lmodern.sty' not found" → exit code 43
    lmodern \
    # Lingue europee (polyglossia + babel fallback)
    texlive-lang-european \
    texlive-lang-italian \
    # Lingue CJK (giapponese, cinese, coreano)
    texlive-lang-cjk \
    texlive-lang-japanese \
    # Arabo + bidi
    texlive-lang-arabic \
    # Font di sistema (fontspec li carica via nome)
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-dejavu \
    # Utilità
    wget \
    && \
    # ---------------------------------------------------------------------------
    # 2. Pandoc binario ufficiale (pinned)
    # ---------------------------------------------------------------------------
    wget -q "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-${TARGETARCH}.deb" \
         -O /tmp/pandoc.deb && \
    case "${TARGETARCH}" in \
      amd64) expected_sha="${PANDOC_SHA256_AMD64}" ;; \
      arm64) expected_sha="${PANDOC_SHA256_ARM64}" ;; \
      *) echo "Architettura non supportata per checksum Pandoc: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    echo "${expected_sha}  /tmp/pandoc.deb" | sha256sum -c - && \
    dpkg -i /tmp/pandoc.deb && \
    rm /tmp/pandoc.deb && \
    # ---------------------------------------------------------------------------
    # 3. Pulizia apt
    # ---------------------------------------------------------------------------
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ---------------------------------------------------------------------------
# 4. Utente non-root per sicurezza SaaS
# ---------------------------------------------------------------------------
RUN groupadd --gid 1001 appgroup && \
    useradd  --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

# ---------------------------------------------------------------------------
# 5. Node.js (copia binario da stage deps/builder)
# ---------------------------------------------------------------------------
COPY --from=deps    /usr/local/bin/node   /usr/local/bin/node
COPY --from=deps    /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# ---------------------------------------------------------------------------
# 6. Applicazione
# ---------------------------------------------------------------------------
WORKDIR /app

COPY --from=deps     /app/node_modules ./node_modules
COPY --from=builder  /app/dist         ./dist
COPY --from=builder  /app/package.json ./package.json

# Cartelle storage (montate come volumi in produzione)
RUN mkdir -p /app/storage/pdf /app/storage/uploads && \
    chown -R appuser:appgroup /app

USER appuser

# ---------------------------------------------------------------------------
# 7. Healthcheck
# ---------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "\
        const h = require('http'); \
        h.get('http://localhost:' + (process.env.PORT || 3000) + '/health', \
            r => process.exit(r.statusCode === 200 ? 0 : 1) \
        ).on('error', () => process.exit(1)) \
    "

EXPOSE 3000

CMD ["node", "dist/main.js"]