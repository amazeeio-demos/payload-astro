# Payload CMS (Next.js) — service `cms`, listens on port 3000.
ARG LAGOON_VERSION=26.7.0

FROM uselagoon/node-24-builder:${LAGOON_VERSION} AS builder

WORKDIR /app

# pnpm is not in the Lagoon images: corepack installs the version pinned by the
# root package.json `packageManager` field.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/mongo-dev/package.json packages/mongo-dev/
COPY packages/payload-loader/package.json packages/payload-loader/

RUN pnpm install --frozen-lockfile --filter cms...

COPY . .

# `next build` needs a syntactically valid Mongo URI to load the Payload config,
# but never connects: the real URI comes from Lagoon when the container starts.
ENV DATABASE_URI=mongodb://127.0.0.1:27017/build
ENV PAYLOAD_SECRET=build-time-placeholder
RUN pnpm --filter cms build


FROM uselagoon/node-24:${LAGOON_VERSION}

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "cms", "start"]
