# Static Astro site — service `web`, listens on port 3000.
#
# The image carries the Astro build toolchain without running the build: at that
# point the CMS does not exist yet. The post-rollout task in `.lagoon.yml` builds
# the site once the `cms` service is reachable and drops the output into
# /app/dist — a persistent volume.
ARG LAGOON_VERSION=26.7.0

FROM uselagoon/node-24-builder:${LAGOON_VERSION} AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/mongo-dev/package.json packages/mongo-dev/
COPY packages/payload-loader/package.json packages/payload-loader/

RUN pnpm install --frozen-lockfile --filter web...

COPY . .


FROM uselagoon/node-24:${LAGOON_VERSION}

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

# Static file server. The directory is empty in the image: Lagoon mounts the
# persistent volume over it, and the post-rollout task fills it.
RUN mkdir -p /app/dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "--filter", "web", "serve"]
