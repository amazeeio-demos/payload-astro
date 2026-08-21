# Payload CMS — étude de faisabilité : live preview et écosystème AI

*État au 21 août 2026. Contexte : `astro-payload-lagoon` (Payload 3.86 / Next 16 / MongoDB, Astro 7.2 + Starlight 0.41, Lagoon). Versions vérifiées sur npm le jour même ; Payload est en 3.88.0, la 4.0 est en pré-bêta.*

## Synthèse

**Live preview.** C'est une fonctionnalité du core de Payload, et elle est frontend-agnostique par construction : l'admin ouvre le frontend dans une iframe et lui envoie l'état du formulaire (non sauvegardé) par `window.postMessage`. Le SDK `@payloadcms/live-preview` est du JavaScript pur ; les paquets React et Vue ne sont que des enrobages. Le seul prérequis côté frontend est de pouvoir **rendre une page à la demande à partir de données**, et non à la build. C'est précisément ce que Starlight ne sait pas faire : il fige la collection `docs` à la build et son pipeline Markdown (Expressive Code) n'existe pas à l'exécution. Le live preview est donc faisable sans difficulté sur un frontend « maison » (Astro avec ses propres composants, TanStack Start, etc.) et seulement de manière dégradée avec Starlight. Votre idée d'une app de preview dédiée est compatible avec le modèle de Payload, mais elle n'est utile que si le rendu est partagé dans un package de composants ; sans cela, elle prévisualise autre chose que le site.

**AI.** Le core de Payload ne contient **aucune fonctionnalité LLM**. Ce qu'il fournit, ce sont les briques : hooks, endpoints custom, composants de champ custom, file de jobs, convertisseurs Lexical ↔ Markdown/texte, et un plugin officiel MCP (`@payloadcms/plugin-mcp`) qui expose le CMS à des agents comme Claude Code. Les fonctions « AI » annoncées sur le site (assistant de rédaction, traduction, génération d'images, auto-embedding) sont des pages marketing Enterprise marquées *coming soon*. `@ai-stack/payloadcms` est un plugin communautaire (un mainteneur, bêta, MIT, supporte Claude) ; il est le seul à offrir un assistant dans l'éditeur Lexical. Pour les cas d'usage cités (résumé, alt text, tagging), une couche DIY mince — un endpoint, un bouton « Générer » sur le champ, le SDK Anthropic — coûte un à deux jours par cas et ne crée aucune dépendance fragile à la version de Payload.

---

## 1. Live preview

### 1.1 Comment Payload fait

La configuration tient dans `admin.livePreview` (au niveau racine avec `collections: ['docs']`, ou par collection) :

```ts
admin: {
  livePreview: {
    url: ({ data, locale, req }) =>
      `${process.env.PREVIEW_URL}/preview/${locale}/${data.slug}`,
    breakpoints: [{ name: 'mobile', label: 'Mobile', width: 375, height: 667 }],
  },
},
versions: { drafts: { autosave: { interval: 375 } } },
```

Mécanique, vérifiée dans le source (`packages/ui/src/elements/LivePreview/Window`, `packages/live-preview/src`) :

- L'admin rend `<iframe src={url}>`. La page doit appeler `ready({ serverURL })`, qui poste `{ type: 'payload-live-preview', ready: true }` au parent. Rien n'est envoyé avant.
- À chaque changement du formulaire, l'admin poste `{ type: 'payload-live-preview', collectionSlug, data, locale }` où `data` est **l'état non sauvegardé** du formulaire. À chaque sauvegarde (draft, autosave, publish), il poste aussi `{ type: 'payload-document-event' }`.
- Côté page, `subscribe({ serverURL, initialData, depth, callback })` écoute ces messages. Point important pour ce projet : le SDK **ne fusionne plus côté client**. Il renvoie les données reçues à Payload via `POST /api/docs/:id` avec l'en-tête `X-Payload-HTTP-Method-Override: GET`, body `{ data, depth, locale }` et `credentials: 'include'`. Payload exécute alors `findByID` sur ces données sans lire la base : les hooks `afterRead` tournent, les relations sont peuplées, et donc **le champ virtuel `markdown` est calculé sur le contenu non sauvegardé**. Le callback reçoit le document complet, exactement dans la forme que le loader Astro consomme déjà.
- Contraintes réseau : `serverURL` doit être l'origine exacte de l'admin (schéma + hôte + port, sans slash final), l'origine du frontend doit figurer dans `cors` et `csrf` de Payload, et en cas de CSP le frontend doit autoriser l'admin dans `frame-ancestors`. Le `POST` du SDK s'appuie sur le cookie `payload-token` : en cross-origin il faut un cookie `SameSite=None; Secure`, ou un domaine parent commun (`auth.cookies.domain`).

Deux modes coexistent :

| Mode | Principe | Ressenti | Exigence frontend |
|---|---|---|---|
| **Client-side** (`subscribe` / `useLivePreview`) | La page reçoit les données à chaque frappe et se re-rend en JS | Instantané | Rendu des données côté client (hydratation ou patch DOM) |
| **Save-based** (« server-side ») | La page écoute `payload-document-event` et se recharge ; elle relit le brouillon via l'API avec `draft: true` | ~0,4–1 s avec `autosave.interval` bas | Une route rendue à la demande, n'importe quelle techno |

Le mode save-based est documenté uniquement pour Next.js (`RefreshRouteOnSave`), mais rien n'empêche un `<script>` de quelques lignes de faire `location.reload()` sur l'événement ; c'est ce que font les deux starters Astro communautaires (`frockett/astro-payload-starter`, `jhb-software/payload-astro-website-template`). Il n'existe aucun exemple officiel Astro ni paquet Svelte ; un plugin communautaire tout neuf (`payload-live-preview` 1.2.2, patch DOM par attributs `data-payload-field`) existe mais n'est pas éprouvé.

À côté du live preview, `admin.preview` ajoute un bouton « Preview » qui ouvre un nouvel onglet. Sa fonction reçoit `{ locale, req, token }` — le JWT de l'éditeur — ce qui permet de l'embarquer dans l'URL et de l'utiliser côté serveur du frontend. Le live preview, lui, ne fournit pas de token : la route de preview doit s'authentifier autrement (cf. 1.3).

### 1.2 Pourquoi Starlight est le mauvais candidat

Trois faits vérifiés dans le source de Starlight 0.41 et la doc Astro 7 :

1. Starlight supporte le rendu à la demande (`starlight({ prerender: false })`, depuis la 0.28), mais ses routes lisent toujours `getCollection('docs')` **au chargement du module**, c'est-à-dire l'instantané du Content Layer produit à la build. Une page nouvelle ou un brouillon n'existe pas pour lui.
2. Les *live content collections* d'Astro sont stables depuis la 6.0 (mars 2026 : `defineLiveCollection`, `getLiveEntry`), mais Starlight ne les utilise pas pour `docs` et aucun ticket ne va dans ce sens.
3. `renderMarkdown()` n'existe que dans le `LoaderContext` de build. À l'exécution, Astro ne fournit pas son pipeline Markdown ; il faut un parseur npm (`marked`, ou `@astrojs/markdown-remark` instancié à la main), et Expressive Code (blocs de code, titres de fichiers) ne tourne pas. Or les blocs de code sont le cœur d'une documentation technique.

Il reste une voie semi-officielle : en mode `prerender: false`, le `routeMiddleware` de Starlight s'exécute à chaque requête et peut remplacer `starlightRoute.entry.data`, `headings` et `Content` par un brouillon lu dans Payload. C'est faisable mais non documenté, et le rendu Markdown reste dégradé. À réserver à une preview « save-based » approximative, pas à de l'instantané.

Conclusion : sur Starlight, le live preview est un compromis. Si la fidélité de preview est un critère d'adoption, le frontend doit posséder ses composants de rendu.

### 1.3 Scénarios

**A — Route de preview dans le frontend (recommandé pour démarrer).** Le frontend (Astro avec adapter `@astrojs/node`, ou TanStack Start) expose `/preview/[locale]/[slug]` rendue à la demande. Elle vérifie un `PREVIEW_SECRET` passé dans l'URL par `admin.livePreview.url`, interroge GraphQL avec `draft: true` et une clé API d'un utilisateur de service (`Authorization: users API-Key …`, `auth.useAPIKey: true`) dont l'accès `read` autorise les brouillons, puis rend la page avec **les mêmes composants que le site**. Un script appelle `ready()` puis `subscribe()` ; en Astro on peut se contenter du rechargement sur `payload-document-event` (save-based), en React on utilise `useLivePreview` et c'est instantané. Sur Lagoon, cela implique un service `node` pour le frontend (ou un service `preview` séparé) au lieu du `sirv` statique actuel ; le site public peut rester statique.

Effort : 1 à 2 jours pour le save-based sur Astro (POC), 1 à 2 jours de plus pour l'instantané client-side (re-rendu du Markdown côté client avec `marked` ou rendu direct du JSON Lexical).

**B — App de preview dédiée, frontend-agnostique (votre piste).** Une petite app (Vite + React ou Astro SSR) ne fait que : recevoir l'URL de l'admin, s'abonner au `postMessage`, et rendre le document avec les composants d'un package `packages/ui`. Le contrat commun est le schéma GraphQL : `@graphql-codegen/typescript` + `typescript-operations` génère les types depuis `/api/graphql`, et ces types sont l'interface du package UI. Payload ne sait pas que la preview n'est pas le site ; du point de vue du CMS les scénarios A et B sont identiques.

Ce scénario n'a de valeur que si **le site et l'app de preview consomment le même `packages/ui`**. Avec Starlight c'est impossible (Starlight possède le layout) : l'app de preview montrerait un rendu différent du site, ce qui est pire qu'une absence de preview. Avec un frontend maison (Astro + composants React/Preact islands, ou TanStack Start), c'est naturel, et l'app de preview devient une coquille de 100 lignes. Storybook est alors un bonus pour développer les composants du package, pas un prérequis de la preview.

Recommandation sans sur-ingénierie : ne pas créer d'app de preview au départ. Mettre les composants de rendu dans `packages/ui` dès le jour où on quitte Starlight, exposer la route de preview dans le frontend (scénario A), et ne sortir la preview en app séparée que si un deuxième frontend apparaît réellement. La décision structurante n'est pas « app dédiée ou non », c'est « composants de rendu partagés et typés depuis GraphQL » — c'est cela qui rend la suite triviale.

**C — TanStack Start.** C'est le chemin le plus court vers un live preview instantané : `@payloadcms/live-preview-react` fonctionne dans n'importe quelle app React (le hook `useLivePreview({ serverURL, initialData, depth })`), les loaders TanStack font la requête `draft: true` côté serveur, et la route de preview est une route React comme les autres. Signal intéressant : Payload lui-même explore TanStack Start comme hôte de l'admin (`@payloadcms/tanstack-start` dans le monorepo, démo `payloadcms/payload-tanstack-demo`, explicitement expérimentale, dans le cadre des adapters de framework visés par la 4.0). Rien à en tirer en production aujourd'hui, mais cela montre que la stack n'est pas à contre-courant.

### 1.4 Choix de représentation du contenu

Le champ virtuel `markdown` reste un bon contrat inter-frontends : neutre, calculé côté CMS (y compris en live preview, vérifié), consommable par n'importe quel parseur. Son coût : le rendu Markdown doit être fait par le frontend avec son propre outillage (Shiki pour le code), et les blocs Lexical custom doivent passer par la conversion Markdown. Alternative pour un frontend React : consommer le JSON Lexical et le rendre avec `RichText` de `@payloadcms/richtext-lexical/react` (convertisseurs JSX, blocs custom en composants). Plus fidèle, mais couple le frontend à Lexical. Les deux peuvent cohabiter : GraphQL expose `body` (JSON) et `markdown` ; chaque frontend choisit.

### 1.5 Prérequis et risques

Côté Payload : `cors`/`csrf` pour l'origine de preview, cookie `SameSite=None` ou domaine parent commun pour le `POST` du SDK, `autosave` activé si mode save-based, un utilisateur de service avec clé API, `PREVIEW_SECRET`. Côté infra : un service rendu à la demande. Côté Astro : `renderMarkdown` inaccessible à l'exécution, donc divergence possible entre rendu build et rendu preview — à neutraliser en utilisant le même parseur dans le loader et dans la route de preview (renoncer à `renderMarkdown()` au profit d'un pipeline explicite partagé), ce qui est de toute façon souhaitable une fois Starlight abandonné.

---

## 2. Écosystème AI

### 2.1 Ce que fournit le core et les paquets officiels

| Brique | Statut | Ce que c'est |
|---|---|---|
| `@payloadcms/plugin-mcp` | Officiel, stable, versionné avec le core (3.88) | Serveur MCP sur `POST /api/mcp` (streamable HTTP) ou stdio. Outils : `findDocuments`, `createDocuments`, `updateDocument`, `deleteDocuments`, `getCollectionSchema`, globals, upload. Auth par clé API Payload, access control respecté, outils custom via `defineTool`. Supporte `locale` / `fallbackLocale` automatiquement. Compatible Claude Code (`claude mcp add --transport http …`) et Claude Desktop. |
| `@payloadcms/plugin-seo` | Officiel | `generateTitle` / `generateDescription` sont des fonctions serveur asynchrones recevant `{ doc, locale, req }` ; la doc suggère d'y brancher une API AI mais ne fournit rien. Brancher Claude = une fonction. |
| Jobs Queue | Core | Tâches, workflows, `autoRun` cron, retries, clés de concurrence (la doc cite « regénérer des embeddings » comme cas d'usage, sans code). Le bon endroit pour tout appel LLM qui ne doit pas bloquer la sauvegarde. |
| Convertisseurs Lexical | Core (`@payloadcms/richtext-lexical`) | `convertLexicalToMarkdown`, `convertLexicalToPlaintext`, `convertMarkdownToLexical` — pour alimenter un prompt et réinjecter le résultat en rich text. |
| Hooks, endpoints custom, composants de champ | Core | `beforeChange`/`afterChange` avec `req.file` (buffer) sur les uploads ; `endpoints: [{ path, method, handler }]` ; `admin.components.Field` pour un bouton « Générer » qui appelle l'endpoint et fait `setValue`. C'est le patron qu'utilisent tous les plugins ci-dessous. |
| `payloadcms/skills` | Officiel (GitHub) | Skills pour agents de code (Claude Code) qui écrivent du Payload. Pas de l'AI à l'exécution. |
| « AI-Writing Assistant », « AI-Translations », « AI-Image Generation », « AI Auto-Embedding / AI Search » | Marketing Enterprise, *coming soon* ou sur devis | Aucun paquet, aucune doc, non vérifiable. Ne pas compter dessus. |
| Payload 4.0 (annonce juin 2026) | Pré-bêta | Refonte admin, TanStack, MCP simplifié. Pas d'assistant LLM ni d'embeddings annoncés en first-party. |

Il n'existe ni `@payloadcms/plugin-ai`, ni intégration AI dans l'éditeur Lexical officiel.

### 2.2 Plugins communautaires pertinents

| Paquet | Version / publication | Ce qu'il apporte | Réserves |
|---|---|---|---|
| `@ai-stack/payloadcms` (ashbuilds/payload-ai) | 3.2.30 / 11 août 2026, MIT, peer `payload ^3.82` | Compose, Proofread, Translate, Rephrase sur text/textarea/**richText Lexical** (`PayloadAiPluginLexicalEditorFeature`), génération d'images (DALL-E, Imagen), voix. Providers OpenAI, **Anthropic**, Google, ElevenLabs. Options `collections`, `access`, `promptFields`. | « Beta notice » dans le README, testé sur 3.84.1, un mainteneur, peer ranges serrés sur `@payloadcms/ui` et lexical → risque à chaque montée de version. Pas de fonction alt text. C'est le seul qui offre un assistant *dans* l'éditeur. |
| `@jhb.software/payload-alt-text-plugin` | 0.10.0 / 14 août 2026, MIT, peer `^3.88` | Bouton « Générer » sur les collections upload, génération en masse depuis la liste, par locale. Résolveurs OpenAI et Mistral fournis, résolveur custom possible (Claude). | Suit la dernière Payload de près, donc exige d'être à jour. Le résolveur reçoit une URL de vignette, pas le buffer. |
| `@jhb.software/payload-content-translator-plugin` | 0.5.0 / 14 août 2026 | Traduction entre locales depuis l'admin, résolveur pluggable. | Gestion de Lexical non documentée. |
| `payload-sync-ai-translations` | 1.31.0 / juillet 2026 | Traduction vers toutes les locales, revue avant application, statut « désynchronisé » par empreinte, audit SEO. | OpenAI seulement (endpoint custom possible). |
| `payloadcms-vectorize` + `@payloadcms-vectorize/mongodb` | 1.1.0 / juin 2026, MIT | Recherche sémantique / RAG : chunking (helpers Lexical), embeddings temps réel et en masse, filtres, localisation. Adapters pgvector, **MongoDB (Atlas ou 8.2+ auto-hébergé)**, Cloudflare Vectorize. | ~90 étoiles, testé sur 3.69. Seule option prête à l'emploi pour MongoDB. |

`payloadplugins.dev` est un annuaire ; `ai-stack-payloadcms` y est la fiche du plugin ci-dessus. Je n'y ai pas trouvé d'autre entrée AI visible.

### 2.3 Cas d'usage et effort

Hypothèse commune : SDK Anthropic (`@anthropic-ai/sdk`) ou Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) dans un petit module serveur partagé (`apps/cms/src/ai/`), et un composant de champ « Générer » réutilisable. Les efforts sont pour un premier cas fonctionnel, revue humaine comprise (le résultat est proposé, jamais imposé).

| Cas d'usage | Chemin recommandé | Effort | Notes |
|---|---|---|---|
| Résumé d'un article → `description` | DIY : endpoint `POST /api/docs/:id/summarize` qui prend `convertLexicalToPlaintext(body)`, appelle Claude, renvoie le texte ; bouton sur le champ `description`. Variante `plugin-seo` si on l'adopte. | ~1 jour | Localisé : générer par locale à partir du `body` de la locale. |
| Alt text des médias | `@jhb.software/payload-alt-text-plugin` avec résolveur Claude, **ou** DIY : hook `beforeChange` sur `media`, `sharp` réduit `req.file.data` en JPEG, Claude vision, remplit `alt` si vide. | ½ à 1 jour | DIY ≈ 50 lignes, aucune dépendance. Le plugin ajoute la génération en masse. |
| Auto-tagging (relation `category`, futurs tags) | DIY : endpoint qui reçoit le texte et la liste des termes existants, demande à Claude de choisir parmi eux (pas d'invention), propose dans l'UI. | 1 à 2 jours | Contraindre au vocabulaire existant ; utiliser les *structured outputs*. |
| Traduction en → fr | Plugin jhb ou `payload-sync-ai-translations`, ou DIY : job queue + `convertLexicalToMarkdown` → Claude → `convertMarkdownToLexical`. | 2 à 3 jours DIY | Le DIY passe par Markdown, donc les blocs custom (CodeBlock) doivent survivre à l'aller-retour — votre convertisseur existant le garantit déjà. |
| Assistant de rédaction dans Lexical | `@ai-stack/payloadcms` | ½ jour d'essai | Seule option sans développer une feature Lexical ; accepter le statut bêta ou s'abstenir. |
| Recherche sémantique / RAG | `payloadcms-vectorize` + adapter MongoDB | 2 à 4 jours | Nécessite un index vectoriel (Atlas ou MongoDB 8.2+) — à valider avec l'offre MongoDB de Lagoon. |
| Exposer le CMS à Claude Code / agents | `@payloadcms/plugin-mcp` | ½ jour | Officiel ; utile aussi pour les migrations de contenu et la rédaction assistée hors admin. |

### 2.4 Recommandation

Pour des projets clients, privilégier la couche DIY mince sur les briques core (endpoint + composant de champ + jobs queue) : elle survit aux montées de version de Payload, reste auditable, et couvre résumé, alt text et tagging en moins d'une semaine au total. Ajouter `@payloadcms/plugin-mcp` dès maintenant, c'est officiel et peu coûteux. Évaluer `@ai-stack/payloadcms` dans une branche pour l'assistant Lexical, sans en faire un engagement. Les fonctions Enterprise annoncées ne doivent pas entrer dans la décision d'adoption tant qu'elles n'ont pas de paquet et de doc.

---

## 3. Points à vérifier avant d'aller plus loin

- Version : passer en 3.88 avant tout POC (plugins officiels et jhb sont version-lockés sur le core ; l'API de `plugin-mcp` a bougé entre fin 2025 et mi-2026, les types du paquet installé font foi).
- Lagoon : un service rendu à la demande pour la preview (adapter node) ; cookies cross-origin entre le domaine admin et le domaine de preview.
- Offre MongoDB de Lagoon : version et support des index vectoriels, si la recherche sémantique est retenue.
- Décision de frontend : si Starlight est conservé, le live preview reste un compromis ; si on passe à des composants maison (Astro ou TanStack Start), prévoir `packages/ui` + codegen GraphQL dès le départ.

## Sources

Payload : [Live Preview overview](https://payloadcms.com/docs/live-preview/overview) · [client](https://payloadcms.com/docs/live-preview/client) · [server](https://payloadcms.com/docs/live-preview/server) · [admin.preview](https://payloadcms.com/docs/admin/preview) · [drafts](https://payloadcms.com/docs/versions/drafts) · [source live-preview SDK](https://github.com/payloadcms/payload/tree/main/packages/live-preview/src) · [LivePreview window (UI)](https://github.com/payloadcms/payload/blob/main/packages/ui/src/elements/LivePreview/Window/index.tsx) · [website template](https://github.com/payloadcms/payload/tree/main/templates/website) · [discussion Astro #5233](https://github.com/payloadcms/payload/discussions/5233) · [plugin-mcp](https://payloadcms.com/docs/plugins/mcp) · [plugin-seo](https://payloadcms.com/docs/plugins/seo) · [jobs queue](https://payloadcms.com/docs/jobs-queue/overview) · [packages/](https://github.com/payloadcms/payload/tree/main/packages) · [Payload 4.0 early look](https://payloadcms.com/posts/blog/payload-40-admin-ui-redesign-tanstack-mcp-and-more) · [enterprise AI](https://payloadcms.com/enterprise/enterprise-ai) · [AI search](https://payloadcms.com/enterprise/ai-search) · [payload-tanstack-demo](https://github.com/payloadcms/payload-tanstack-demo) · [skills](https://github.com/payloadcms/skills)

Astro / Starlight : [on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/) · [content collections (live)](https://docs.astro.build/en/guides/content-collections/) · [loader reference](https://docs.astro.build/en/reference/content-loader-reference/) · [markdown](https://docs.astro.build/en/guides/markdown-content/) · [Astro 6](https://astro.build/blog/astro-6/) · [Astro 7](https://astro.build/blog/astro-7/) · [Starlight config `prerender`](https://starlight.astro.build/reference/configuration/) · [route data / middleware](https://starlight.astro.build/guides/route-data/) · [Starlight routes source](https://github.com/withastro/starlight/tree/main/packages/starlight/routes)

Communauté : [ai-stack/payloadcms](https://github.com/ashbuilds/payload-ai) · [payloadplugins.dev](https://payloadplugins.dev/ai-stack-payloadcms/) · [jhb-software/payload-plugins](https://github.com/jhb-software/payload-plugins) · [payloadcms-vectorize](https://github.com/techiejd/payloadcms-vectorize) · [payload-sync-ai-translations](https://github.com/nielsreijnders/payload-sync-ai-translations) · [frockett/astro-payload-starter](https://github.com/frockett/astro-payload-starter) · [jhb-software/payload-astro-website-template](https://github.com/jhb-software/payload-astro-website-template) · [payload-live-preview (relative23)](https://payload.market/item/payload-live-preview-B6ISNVQ) · [FocusReactive Content Agent](https://focusreactive.com/blog/payload-content-agent/)
