# Build context is the repository root (the indexer reuses the dashboard's Hashi readers):
#   docker build -f hashi-indexer/Dockerfile .
FROM node:22-alpine

# Links the published package to the repository on GitHub
LABEL org.opencontainers.image.source="https://github.com/MoonletLabs/sui-bridge"
LABEL org.opencontainers.image.description="Hashi indexer: stores Hashi state and history in Postgres"

ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production \
    HASHI_INDEXER_VERSION=${VERSION}
WORKDIR /app/hashi-indexer

COPY hashi-indexer/package.json hashi-indexer/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Shared readers, at the paths the `src/*` alias in tsconfig.json expects
COPY src/config/hashi.ts /app/src/config/hashi.ts
COPY src/utils/hashi-chain.ts src/utils/sui-graphql.ts /app/src/utils/

COPY hashi-indexer/ ./

USER node
CMD ["node_modules/.bin/tsx", "src/main.ts"]
