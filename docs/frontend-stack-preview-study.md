# Choix de la stack frontend pour la preview Payload — Astro vs TanStack Start vs app dédiée

*État au 21 août 2026. Suite de l'étude « live preview et écosystème AI ». Hypothèses retenues : Payload 3.88, PostgreSQL en local, abandon de Starlight, sites de contenu avec îlots applicatifs (formulaires…), équipe React solide, composants de rendu en React acceptés même sous Astro. Lagoon traité après une POC locale.*

## Réponse courte

**Oui, Astro permet de servir une même page en SSG pour le public et à la demande pour la preview — mais pas sous la même URL ni dans le même fichier de route.** `export const prerender` est un littéral par fichier, le middleware ne s'exécute pas à l'exécution sur une page prérendue (elle est servie comme fichier statique avant d'atteindre Astro), et `Astro.rewrite()` ne fonctionne que sur les routes à la demande. Le modèle qui marche est celui de deux fichiers de route minces qui partagent un même composant : `src/pages/[...slug].astro` (prérendu, `getStaticPaths()` depuis GraphQL) et `src/pages/preview/[...slug].astro` (`prerender = false`, secret + brouillon + live preview). Les deux tournent dans un seul process `@astrojs/node` qui sert `dist/client/` puis bascule sur le rendu à la demande.

**TanStack Start fait la même chose, avec un confort supérieur côté React et un coût structurel plus élevé pour un site de contenu** : hydratation complète de chaque page publique, prérendu des slugs CMS à construire soi-même (crawl de liens ou liste `pages` calculée dans `vite.config.ts`), statut « Release Candidate » jamais formellement clos, Nitro 3 encore bêta pour le déploiement Node.

**L'app de preview dédiée n'apporte rien que les deux autres n'offrent déjà**, dès lors que le rendu vit dans un package `ui` partagé : dans les deux frameworks, la route de preview *est* une coquille de quelques dizaines de lignes autour des composants du site. Elle ne se justifie que si deux frontends distincts doivent être prévisualisés depuis un même CMS.

**Recommandation : Astro en mode hybride, composants de rendu React dans `packages/ui`, route `/preview` rendue à la demande avec un îlot `useLivePreview`.** C'est la voie qui respecte à la fois « pas d'app de preview à maintenir », « sites de contenu d'abord » et « React solide ». Et parce que `packages/ui` est React, une bascule ultérieure vers TanStack Start pour un projet plus applicatif réutilise le rendu tel quel.

---

## 1. Le socle commun aux trois options

Quel que soit le framework, quatre décisions sont identiques et conditionnent le reste. Les trancher d'abord rend le choix du framework presque secondaire.

**Un package `packages/ui` en React** qui contient tout ce qui rend du contenu Payload : la page, les blocs, le rich text, les médias. Le site public et la preview l'importent. Sans ce package, aucune option n'offre une preview fidèle.

**Un contrat typé depuis GraphQL.** `@graphql-codegen/cli` avec `typescript` + `typescript-operations` (et `typed-document-node` si on veut des requêtes typées) génère depuis `http://localhost:3000/api/graphql`. Ces types sont l'interface de `packages/ui` ; le loader Astro ou les server functions TanStack ne sont que des clients. Le `payload-types.ts` généré par Payload décrit la forme REST/Local API, légèrement différente de GraphQL (pagination, relations) ; il reste utile côté CMS, pas côté frontend.

**Le format du rich text.** Trois voies, et c'est le point le plus structurant de toute l'étude :

| Voie | Ce que le frontend reçoit | Dépendances frontend | Blocs custom (formulaires…) | Fidélité preview |
|---|---|---|---|---|
| Markdown (champ virtuel actuel) | chaîne Markdown | un parseur (`react-markdown`, Shiki) | perdus ou encodés en fences/MDX | moyenne |
| HTML calculé côté CMS (`lexicalHTMLField` / `convertLexicalToHTML`) | chaîne HTML | aucune | impossibles à hydrater en îlots | moyenne |
| **JSON Lexical + sérialiseur maison dans `packages/ui`** | JSON (scalaire GraphQL) | aucune dépendance Payload | chaque bloc = un composant React, hydratable | totale |

Le composant officiel `RichText` de `@payloadcms/richtext-lexical/react` fonctionne hors Next (pas de `'use client'`, pas d'import Next), mais le paquet déclare `payload` et `@payloadcms/next` en peer dependencies et embarque `@payloadcms/ui` et tout `@lexical/*` : l'installer dans le frontend y fait entrer l'essentiel de Payload. Un sérialiseur maison (paragraphes, titres, listes, liens, upload, `block` → composant) tient en 150 à 250 lignes, typé sur le JSON, et c'est ce que la plupart des frontends découplés finissent par écrire. Recommandation : JSON Lexical + sérialiseur maison, en gardant le champ `markdown` pour les consommateurs qui n'ont besoin que de texte (recherche, LLM, export).

**L'authentification de la preview.** `admin.livePreview.url` renvoie `${PREVIEW_URL}/preview/${locale}/${slug}?secret=${PREVIEW_SECRET}`. La route de preview vérifie le secret, puis lit le brouillon côté serveur avec une clé API d'un utilisateur de service (`auth.useAPIKey`, accès `read` autorisant les brouillons), `draft: true`, locale. L'îlot client appelle ensuite `useLivePreview` ; le `POST` de fusion du SDK vers Payload utilise le cookie admin de l'éditeur, donc `cors`/`csrf` doivent lister l'origine de preview et, en local, `localhost:3000` ↔ `localhost:4321` passe sans réglage de cookie (même site). En production, soit un domaine parent commun (`auth.cookies.domain`), soit `sameSite: 'None'`.

---

## 2. Option A — Astro hybride

### Architecture

```
apps/web (Astro 7, @astrojs/node standalone, @astrojs/react)
  src/pages/[...slug].astro          prérendu ; getStaticPaths() ← GraphQL published
  src/pages/preview/[...slug].astro  prerender = false ; secret → GraphQL draft:true
  src/components/PreviewIsland.tsx   client:only="react" ; useLivePreview → <Page/>
packages/ui (React)                  <Page/>, blocs, RichText (sérialiseur JSON)
packages/graphql                     codegen : types + documents
```

La page publique rend `<Page {...data} />` **sans directive client** : React est exécuté au build, le HTML est statique, zéro JavaScript sauf les îlots explicitement hydratés (un formulaire en `client:visible`). La page de preview rend le même `<Page/>` à l'intérieur d'un îlot `client:only="react"` qui reçoit `initialData` et `serverURL`, appelle `useLivePreview({ initialData, serverURL, depth })` et re-rend à chaque frappe. `@payloadcms/live-preview-react` n'a comme peer dependencies que `react`/`react-dom` (16.8 → 19) et aucune dépendance transitive : il est sans risque dans le frontend.

### Faits vérifiés qui comptent

- `output: 'static'` + adapter : le prérendu reste le défaut, seules les routes marquées `prerender = false` passent à la demande. Priorité de routage : `/preview/[...slug]` gagne sur `/[...slug]` (segment statique en tête). `prerenderConflictBehavior` signale les doublons.
- `@astrojs/node` standalone sert `dist/client/` en premier puis l'app SSR : un seul process pour le site et la preview, sans nginx. Le site public peut aussi être copié sur un CDN, la preview seule restant sur le service Node.
- Route caching (`Astro.cache`, stable en 7.0) ne s'applique qu'aux routes à la demande : laisser la preview sans cache.
- Les *live collections* (stables depuis Astro 6) permettraient d'écrire un `loadEntry` qui interroge Payload à la requête ; elles cohabitent avec le loader de build. Pour une seule route de preview, un `fetch` GraphQL direct dans la page est plus simple ; les live collections deviennent intéressantes si plusieurs pages à la demande partagent la logique.
- Dev : `refreshContent` via le hook `astro:server:setup` peut recharger la collection sur un webhook `afterChange` de Payload (dev uniquement). En production, publication = rebuild ; c'est déjà l'état du projet.
- Astro 7 : Sätteri remplace remark par défaut pour les `.md` ; sans objet si le rich text est rendu depuis le JSON. `compressHTML: 'jsx'` par défaut, Node ≥ 22.12, Vite 8.

### Pour

Zéro JS sur les pages publiques, `<Image>`, i18n par préfixe, sitemap, tout est natif et stable. Une route de preview = un fichier de 30 lignes + un îlot de 20 lignes ; aucune app à maintenir. L'écosystème React reste disponible pour les îlots applicatifs. Migration possible vers TanStack Start sans toucher `packages/ui`.

### Contre

Deux modèles mentaux (fichiers `.astro` + React). Le contenu de la page entière doit transiter par les props de l'îlot de preview (sérialisable, c'est le cas d'un document Payload). Pas de RPC typé équivalent aux server functions ; les Actions Astro ou un `fetch` serveur classique suffisent pour la preview. Passer des données à la demande entre middleware et page prérendue est impossible : si un jour on veut un « mode édition » en surimpression d'une page publique, il faudra un server island ou une vraie route à la demande.

### Effort POC local

Un à deux jours : adapter node, `packages/ui` avec `<Page/>` et sérialiseur Lexical minimal, codegen, route de preview, config `livePreview` + utilisateur API + secret, `cors`/`csrf`. Le loader GraphQL existant est réutilisé pour `getStaticPaths()`.

---

## 3. Option B — TanStack Start

### Architecture

```
apps/web (TanStack Start 1.168, Vite 8, React 19)
  src/routes/$locale/$slug.tsx          loader → server fn getPage (published)
  src/routes/preview/$locale/$slug.tsx  loader → server fn getDraft (secret, API key) ; ssr: true
  composant <Page/> partagé, useLivePreview dans la route preview
vite.config.ts : tanstackStart({ prerender: { enabled: true, crawlLinks: true,
                 filter: p => !p.path.startsWith('/preview'), pages: await slugsFromGraphQL() } })
```

### Faits vérifiés qui comptent

- Versions : `@tanstack/react-start` 1.168.48, `@tanstack/react-router` 1.170.31 (19 août 2026). La doc porte toujours le bandeau *Release Candidate* (API déclarée stable, « v1 » jamais annoncée officiellement ; les articles « 1.0 en mars 2026 » sont tiers). Releases hebdomadaires.
- Prérendu : configuré dans le plugin Vite (`enabled`, `crawlLinks`, `filter`, `pages`), **pas par route**. Les routes à paramètres (`$slug`) ne sont pas découvertes automatiquement : soit elles sont atteintes par le crawl des liens, soit on fournit `pages` — un tableau statique, mais `vite.config.ts` peut être `async` et interroger GraphQL. Le HTML prérendu est écrit dans `dist/client` (ou `.output/public` avec Nitro) et peut être servi par nginx/CDN. Mélange prérendu + SSR dans un même déploiement : oui, c'est le cas nominal.
- Déploiement Node : soit Nitro (`node .output/server/index.mjs`, Nitro 3 encore bêta, « en développement actif »), soit le bundle Vite pur exposant un handler `fetch` servi par `srvx` ou un serveur maison.
- Server functions (`createServerFn`) + `getRequestHeader`/`getCookie` + `createMiddleware` : l'authentification de la route de preview et l'appel GraphQL avec clé API y sont naturels et typés. Le loader est isomorphe : les secrets restent dans la server function.
- Exemple officiel : `payloadcms/payload-tanstack-demo` fait exactement `loader → server fn → useLivePreview` dans `$slug.tsx` (sur Payload 4 canary ; le même code tourne avec un Payload 3.88 headless via GraphQL). Il n'a pas de route de preview authentifiée séparée ; à ajouter.
- `@payloadcms/tanstack-start` (PR #16139, fusionnée le 2 juillet 2026) concerne l'**admin Payload** hébergé dans TanStack Start, Payload 4 seulement, expérimental (E2E ~72 %). Sans rapport avec un frontend headless.
- Hydratation : l'app entière s'hydrate par défaut (React + Router + Start, quelques dizaines de ko gz par page). `ssr: 'data-only' | false` par route et les frontières `<Hydrate>` (expérimental) atténuent. Pas d'optimisation d'images, pas d'i18n, pas d'ISR intégrés ; `head()` + `<HeadContent/>` pour le SEO, option `sitemap` dans le plugin.

### Pour

Un seul modèle mental React de bout en bout ; la preview n'est pas un îlot mais une route comme les autres. Routage et loaders typés, server functions et middleware idéaux pour la preview authentifiée. L'équipe Payload investit dans TanStack (démo, adapter) — alignement plausible avec Payload 4. Meilleure option si la part applicative (espaces authentifiés, dashboards) grossit.

### Contre

Pour un site de contenu : JS sur chaque page publique, prérendu des slugs CMS à orchestrer, un process Node de toute façon. Statut RC permanent et API qui bouge (`validator` → `inputValidator`…), Nitro bêta, RSC et hydratation différée expérimentaux. Moins d'outillage natif « site » qu'Astro. Le risque de version, pour des projets clients à maintenir plusieurs années, est réel.

### Effort POC local

Deux à trois jours : projet Start, routes, server functions, prérendu avec liste de slugs, `packages/ui` et codegen identiques à l'option A.

---

## 4. Option C — App de preview dédiée + `packages/ui`

Une app Vite + React (ou une mini-app Start) dont l'unique rôle est : recevoir l'URL de l'admin, charger le brouillon, appeler `useLivePreview`, rendre `<Page/>` depuis `packages/ui`. Le site public (Astro, Start, ou un autre) consomme le même package.

**Pour.** Découplage maximal : la preview ne dépend pas du mode de rendu du site ; un CMS peut alimenter plusieurs frontends prévisualisés au même endroit ; Storybook y trouve sa place naturelle (même package, mêmes données de fixtures).

**Contre.** Un troisième déployable à héberger, sécuriser (secret, CORS, CSP `frame-ancestors`), versionner en phase avec `packages/ui` et le schéma GraphQL. Le layout global (header, navigation, thème) doit lui aussi vivre dans `packages/ui` pour que la preview soit fidèle — donc le site public devient lui-même une coquille autour du package, ce qui revient à l'option A ou B avec un déployable de plus. Pour un seul frontend, c'est de la maintenance sans contrepartie.

**Quand y venir.** Le jour où un second frontend (un site TanStack pour un client applicatif à côté d'un site Astro) doit être prévisualisé depuis le même Payload — et même alors, la route de preview dans chaque frontend reste souvent plus simple que l'app commune.

---

## 5. Grille de comparaison

| Critère | A. Astro hybride | B. TanStack Start | C. App de preview dédiée |
|---|---|---|---|
| Même composant pour public et preview | oui (2 fichiers de route) | oui (2 routes) | oui, via `packages/ui` |
| Même URL public/preview | non (namespace `/preview`) | non | non |
| JS sur pages publiques | 0 hors îlots | app complète | dépend du site |
| Prérendu des slugs CMS | `getStaticPaths()` natif | `crawlLinks` ou `pages` calculé | n/a |
| Preview instantanée (frappe) | îlot `useLivePreview` | `useLivePreview` natif | `useLivePreview` natif |
| Auth de preview | route à la demande + fetch serveur | server fn + middleware typés | route SPA + backend-for-frontend |
| Déployables | 1 (node, ou statique + node) | 1 (node) | 2 ou 3 |
| Maturité / stabilité 2026 | Astro 7 stable, route caching stable | RC permanent, Nitro bêta | dépend des briques |
| Image, i18n, sitemap | natifs | à assembler | n/a |
| Adéquation « contenu + îlots » | forte | moyenne | — |
| Adéquation « app riche » | moyenne | forte | — |
| Effort POC | 1–2 j | 2–3 j | +1–2 j au-dessus de A ou B |
| Réversibilité | `packages/ui` réutilisable en B | `packages/ui` réutilisable en A | — |

---

## 6. Recommandation et décision à prendre

Retenir **l'option A** pour la POC, avec le socle commun de la section 1 (package `ui` React, codegen GraphQL, JSON Lexical + sérialiseur maison, preview authentifiée par secret + clé API). Ne pas créer d'app de preview. Garder l'option B en réserve pour un projet dont la part applicative domine ; la migration coûte alors les routes et le prérendu, pas le rendu.

Deux choix secondaires à confirmer avant le HANDOFF :

1. **Rich text** : JSON Lexical + sérialiseur maison (recommandé) ou conserver le Markdown pour la première itération et n'écrire le sérialiseur qu'au premier bloc custom. Le second est plus rapide pour la POC, le premier évite une réécriture.
2. **Preview** : îlot `client:only="react"` avec `useLivePreview` (instantané, recommandé) ou simple rechargement sur `payload-document-event` avec autosave (plus simple encore, ~0,5 s de latence, aucun îlot). On peut livrer le second d'abord et ajouter le premier dans la foulée.

Base de données : le passage à `@payloadcms/db-postgres` en local n'a aucune incidence sur la preview ; il simplifie surtout `packages/mongo-dev` (remplacé par un `docker compose` Postgres ou `pglite` via `@payloadcms/db-postgres` en dev).

## Sources

Astro : [on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/) · [middleware](https://docs.astro.build/en/guides/middleware/) · [routing](https://docs.astro.build/en/guides/routing/) · [server islands](https://docs.astro.build/en/guides/server-islands/) · [caching](https://docs.astro.build/en/guides/caching/) · [content collections](https://docs.astro.build/en/guides/content-collections/) · [integrations (`refreshContent`)](https://docs.astro.build/en/reference/integrations-reference/) · [@astrojs/node](https://docs.astro.build/en/guides/integrations-guide/node/) · [source standalone.ts](https://github.com/withastro/astro/blob/main/packages/integrations/node/src/standalone.ts) · [issue #12981 prerender littéral](https://github.com/withastro/astro/issues/12981) · [roadmap #869 middleware on prerendered](https://github.com/withastro/roadmap/discussions/869) · [Astro 7](https://astro.build/blog/astro-7/) · [upgrade v7](https://docs.astro.build/en/guides/upgrade-to/v7/)

TanStack : [overview (RC)](https://tanstack.com/start/latest/docs/framework/react/overview) · [static prerendering](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering) · [hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) · [selective SSR](https://tanstack.com/start/latest/docs/framework/react/guide/selective-ssr) · [server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) · [middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware) · [ISR](https://tanstack.com/start/latest/docs/framework/react/guide/isr) · [SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode) · [RC announcement](https://tanstack.com/blog/announcing-tanstack-start-v1) · [discussion #7050](https://github.com/TanStack/router/discussions/7050)

Payload : [live preview client](https://payloadcms.com/docs/live-preview/client) · [live-preview-react package.json](https://github.com/payloadcms/payload/blob/main/packages/live-preview-react/package.json) · [converting JSX](https://payloadcms.com/docs/rich-text/converting-jsx) · [converting HTML](https://payloadcms.com/docs/rich-text/converting-html) · [RichText component source](https://github.com/payloadcms/payload/blob/main/packages/richtext-lexical/src/features/converters/lexicalToJSX/Component/index.tsx) · [richtext-lexical package.json](https://github.com/payloadcms/payload/blob/v3.87.1/packages/richtext-lexical/package.json) · [payload-tanstack-demo](https://github.com/payloadcms/payload-tanstack-demo) · [PR #16139](https://github.com/payloadcms/payload/pull/16139) · [discussion #5233 Astro](https://github.com/payloadcms/payload/discussions/5233)
