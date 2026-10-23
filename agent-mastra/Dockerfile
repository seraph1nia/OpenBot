FROM node:24.18.1-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates util-linux \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/agent-mastra
COPY agent-mastra/package.json agent-mastra/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json
COPY agent-mastra/src ./src
COPY agent-mastra/tsconfig.json ./tsconfig.json
COPY agent-mastra/entrypoint.sh /usr/local/bin/mastra-entrypoint
RUN chmod 755 /usr/local/bin/mastra-entrypoint \
  && mkdir -p /var/lib/mastra && chown node:node /var/lib/mastra \
  && chmod 700 /var/lib/mastra
ENV PORT=4213 MASTRA_APP_DATA_DIR=/var/lib/mastra MASTRA_TELEMETRY_DISABLED=true DO_NOT_TRACK=1 NODE_ENV=production BOT_PROVIDER=openai-codex
# The pinned deployer supports this setting. Resolve every runtime dependency
# from npm ci's locked tree, rather than its generated second npm install.
RUN MASTRA_BUILD_SKIP_INSTALL=true npx mastra build --dir src/mastra
USER node
EXPOSE 4213
ENTRYPOINT ["mastra-entrypoint"]
CMD ["node", ".mastra/output/index.mjs"]
