# Astro site — service `web`, listens on port 3000.
#
# The image carries the Astro build toolchain without running the build: at that
# point the CMS does not exist yet. The post-rollout task in `.lagoon.yml` builds
# the site once the `cms` service is reachable and drops the output into
# /app/dist — a persistent volume.
#
# TODO (deployment): the site is no longer purely static. Public pages are still
# files under dist/client, but /preview/* needs the node server in
# dist/server/entry.mjs, which is what `pnpm --filter web start` runs. Serving
# both from a `node-persistent` service works, but the split has not been tested
# on a cluster — see the HANDOFF, deployment is out of scope for this pass.
ARG LAGOON_VERSION=26.7.0

FROM uselagoon/node-24-builder:${LAGOON_VERSION} AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/graphql/package.json packages/graphql/
COPY packages/payload-loader/package.json packages/payload-loader/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile --filter web...

COPY . .


FROM uselagoon/node-24:${LAGOON_VERSION}

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

# The directory is empty in the image: Lagoon mounts the persistent volume over
# it, and the post-rollout task fills it.
RUN mkdir -p /app/dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
