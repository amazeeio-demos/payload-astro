# Site statique Astro — service `web`, écoute sur le port 3000.
#
# L'image embarque la chaîne de build Astro sans lancer le build : à ce moment-là
# le CMS n'existe pas encore. C'est la tâche post-rollout de `.lagoon.yml` qui
# construira le site, une fois le service `cms` joignable, et déposera le
# résultat dans /app/dist — un volume persistant.
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

# Serveur de fichiers statiques. Le répertoire est vide dans l'image : Lagoon y
# monte le volume persistant, que la tâche post-rollout remplit.
RUN mkdir -p /app/dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "--filter", "web", "serve"]
