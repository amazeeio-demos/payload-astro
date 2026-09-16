# Payload CMS (Next.js) — service `cms`, listens on port 3000.
ARG LAGOON_VERSION=26.7.0

FROM uselagoon/node-24-builder:${LAGOON_VERSION} AS builder

WORKDIR /app

# pnpm is not in the Lagoon images: corepack installs the version pinned by the
# root package.json `packageManager` field. Its cache is kept under /app so the
# runtime stage inherits it and never downloads at container start.
ENV COREPACK_HOME=/app/.corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/graphql/package.json packages/graphql/
COPY packages/payload-loader/package.json packages/payload-loader/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile --filter cms...

COPY . .

# `next build` needs a syntactically valid Postgres URI to load the Payload
# config, but never connects: the real URI comes from Lagoon when the container
# starts.
ENV DATABASE_URI=postgres://payload:payload@127.0.0.1:5432/build
ENV PAYLOAD_SECRET=build-time-placeholder
RUN pnpm --filter cms build

# Lagoon runs the container as an arbitrary uid in group 0: without this the
# tree is root-only and anything writing next to the code (Next's cache, the
# seed) fails with EACCES.
RUN fix-permissions /app


FROM uselagoon/node-24:${LAGOON_VERSION}

WORKDIR /app

ENV COREPACK_HOME=/app/.corepack
RUN corepack enable

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "cms", "start"]
