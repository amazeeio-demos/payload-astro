# Payload CMS (Next.js) — service `cms`, écoute sur le port 3000.
ARG LAGOON_VERSION=26.7.0

FROM uselagoon/node-24-builder:${LAGOON_VERSION} AS builder

WORKDIR /app

# pnpm n'est pas dans les images Lagoon : corepack l'installe à la version
# épinglée par le champ `packageManager` du package.json racine.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cms/package.json apps/cms/
COPY apps/web/package.json apps/web/
COPY packages/mongo-dev/package.json packages/mongo-dev/
COPY packages/payload-loader/package.json packages/payload-loader/

RUN pnpm install --frozen-lockfile --filter cms...

COPY . .

# `next build` a besoin d'une URI Mongo syntaxiquement valide pour charger la
# config Payload, mais ne se connecte pas : la vraie URI vient de Lagoon au
# démarrage du conteneur.
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
