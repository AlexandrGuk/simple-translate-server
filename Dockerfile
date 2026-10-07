FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY translator.js ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000
EXPOSE 5000
USER node
CMD ["node", "translator.js"]
