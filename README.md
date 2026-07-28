# astro-payload-lagoon

POC : blog de documentation développeurs, contenu géré dans **Payload CMS**,
site rendu statiquement par **Astro / Starlight**, déployé sur **Lagoon**
(amazee.io).

Le contenu transite en **GraphQL**. Le développement local ne demande ni Docker
ni MongoDB installé.

```
apps/cms                  Payload 3 sur Next.js — admin, API, GraphQL
apps/web                  Astro 7 + Starlight — site statique
packages/payload-loader    Loader Content Layer + sidebar, tous deux en GraphQL
packages/mongo-dev         MongoDB local (replica set mono-nœud, sans Docker)
lagoon/                    Dockerfiles de déploiement
docker-compose.yml         Manifeste de services Lagoon (pas pour le local)
.lagoon.yml                Routes et tâches post-rollout
```

## Démarrer

```bash
cp .env.example .env
pnpm install          # télécharge un binaire mongod au premier lancement
pnpm dev              # MongoDB + Payload (:3000) + Astro (:4321)
```

Dans un autre terminal, une seule fois :

```bash
pnpm seed             # administrateur, 2 catégories, 6 pages en/fr
```

- Administration : <http://localhost:3000/admin>
- Site : <http://localhost:4321>

Les identifiants de l'administrateur viennent de `SEED_ADMIN_EMAIL` et
`SEED_ADMIN_PASSWORD` dans `.env`.

Le site est statique : après une modification dans l'admin, relancez
`astro dev` ou `pnpm build:web` pour la voir apparaître.

> Astro 7 détecte les environnements d'agent de code (Claude Code, Cursor…) et y
> démarre `astro dev` en arrière-plan, détaché. Sous `concurrently` le panneau
> `web` rend alors la main aussitôt, et un serveur orphelin garde le port 4321.
> `pnpm --filter web exec astro dev stop` le libère. Dans un terminal normal,
> le comportement est celui attendu.

`pnpm build` et `pnpm typecheck` interrogent le CMS : ils demandent que
`pnpm dev` tourne (ou au moins MongoDB et Payload).

## Comment le contenu arrive dans Astro

Le corps des pages est du rich text Lexical. Un champ **virtuel** `markdown` le
convertit à la lecture (`apps/cms/src/fields/markdown.ts`) et l'expose en
GraphQL — rien n'est stocké en double.

Côté Astro, `payloadDocsLoader` interroge ce champ et confie le Markdown à
`renderMarkdown()`, le pipeline d'Astro. Starlight récupère donc des ancres de
titres, une table des matières et une coloration syntaxique Expressive Code sans
qu'on ait à les recréer.

Deux détails non documentés côté Starlight, tous deux commentés dans
`packages/payload-loader/src/loader.ts` :

- il faut passer par `parseData()`, sinon le défaut `draft: false` du schéma
  n'est pas appliqué et Starlight écarte toutes les entrées en production ;
- Starlight suppose un loader basé sur des fichiers et déréférence
  `entry.filePath!` — on fournit un chemin synthétique.

L'éditeur Lexical n'a pas de bloc de code natif. On active `CodeBlock`, le bloc
fourni par Payload, avec une liste de langages restreinte à des identifiants que
Shiki reconnaît (`bash` et non `shell`, cf. `apps/cms/src/payload.config.ts`).

## i18n

Les locales sont déclarées deux fois et doivent rester alignées :
`localization` dans `apps/cms/src/payload.config.ts`, et `LOCALES` dans
`apps/web/src/site.ts`.

L'anglais est servi à la racine, le français sous `/fr/`. Une page non traduite
retombe sur l'anglais au lieu de disparaître — comportement natif de Starlight.

## Déploiement Lagoon

Trois services : `cms` (`node`), `web` (`node-persistent`) et `mongodb`.

Lagoon construit les images **avant** de les déployer : au moment du
`docker build`, le CMS n'est pas joignable et le site statique ne peut donc pas
être généré. Il l'est après le rollout, par les tâches `post-rollout` de
`.lagoon.yml`, quand le service `cms` répond sur son nom interne. Le résultat est
déposé dans `/app/dist`, un volume persistant — d'où `node-persistent` plutôt
que `nginx` : Lagoon n'a pas de type `nginx-persistent`.

Avant le premier déploiement :

1. Remplacer `docs.example.com` par les vrais domaines dans `.lagoon.yml`.
2. Définir les variables d'environnement du projet (elles ne vont pas dans le
   dépôt) :

   ```bash
   lagoon add variable -p <projet> -e main -N PAYLOAD_SECRET  -V "<secret>" -S runtime
   lagoon add variable -p <projet> -e main -N SEED_ADMIN_EMAIL -V "..."      -S runtime
   ```

3. Vérifier les variables injectées par le service MongoDB :

   ```bash
   lagoon get environment-variables -p <projet> -e main
   ```

   Toute l'incertitude sur leurs noms est isolée dans
   `apps/cms/src/lib/mongoUri.ts` : si le cluster en utilise d'autres, seul ce
   fichier change.

Sur un environnement de production vierge, le seed est volontairement ignoré :
il n'y a donc aucun contenu publié, et le loader fait échouer le build plutôt
que de publier un site vide. Pour ce tout premier déploiement, soit vous
publiez une page depuis l'admin puis relancez le déploiement, soit vous posez
`PAYLOAD_ALLOW_EMPTY=true` le temps du premier build.

Publier du contenu ne reconstruit pas le site tout seul : relancez un
déploiement, ou branchez un hook `afterChange` de Payload sur l'API Lagoon.

## Points restés hors périmètre

- Persistance des médias Payload en production (volume dédié ou S3).
- Prévisualisation des brouillons depuis Astro.
- Pipeline CI.
