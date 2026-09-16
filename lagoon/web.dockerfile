# Astro site — service `web`, listens on port 3000.
#
# The image carries the Astro build toolchain without running the build: at that
# point the CMS does not exist yet. The post-rollout task in `.lagoon.yml` builds
# the site once the `cms` service is reachable and drops the output into
# apps/web/dist — a persistent volume, so it survives pod restarts.
#
# The site is not purely static: public pages are files under dist/client, but
# /preview/* needs the node server in dist/server/entry.mjs, and
# lagoon/web-entrypoint.mjs runs it, serving both.
ARG LAGOON_VERSION=26.7.0

FROM uselagoon/node-24-builder:${LAGOON_VERSION} AS builder

WORKDIR /app

# pnpm via corepack, cached under /app so the runtime stage inherits it.
ENV COREPACK_HOME=/app/.corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/graphql/package.json packages/graphql/
COPY packages/payload-loader/package.json packages/payload-loader/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile --filter web...

COPY . .

# Lagoon runs the container as an arbitrary uid in group 0, and the post-rollout
# build writes into node_modules/.vite and apps/web/.astro: group-writable or
# EACCES.
RUN fix-permissions /app


FROM uselagoon/node-24:${LAGOON_VERSION}

WORKDIR /app

ENV COREPACK_HOME=/app/.corepack
RUN corepack enable

COPY --from=builder /app /app

# Empty in the image: Lagoon mounts the persistent volume over it, and the
# post-rollout task fills it.
RUN mkdir -p /app/apps/web/dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

# Listens on 3000 at once and answers 503 until the post-rollout task has built
# the site, then runs Astro's server: Lagoon only runs that task after the pod
# is ready, so waiting before listening would deadlock the first rollout.
CMD ["node", "/app/lagoon/web-entrypoint.mjs"]
