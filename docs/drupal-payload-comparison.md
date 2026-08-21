# Payload vu depuis Drupal — correspondances, absences, et ce que coûte l'écosystème

*État au 21 août 2026. Notes prises après une évaluation pratique de `payload-website-starter` (Payload 3.84.1, Next 16.3, déploiement Vercel) menée dans un dépôt de test séparé : extension du seed à 18 articles, 8 pages, catégories imbriquées, 3 formulaires, redirections, versions et publication programmée. Le projet cible ici est Payload 3.88 en full decoupled, donc les conclusions sur Views et ECA sont volontairement écartées.*

## Réponse courte

**Le modèle de contenu de Payload se transpose presque terme à terme depuis Drupal**, y compris sur les briques qu'on installe habituellement en contrib : formulaires, redirections, métadonnées SEO, index de recherche, révisions avec modération, menus, adaptateurs de base et de mail. Un développeur Drupal retrouve ses repères en quelques heures.

**Deux absences comptent** : il n'existe aucun équivalent de Views (toute requête est du code) ni d'interface de gestion des permissions. La première est sans objet en full decoupled. La seconde est un vrai sujet d'organisation, traité dans `docs/roles-and-access-control.md`.

**La différence structurante n'est pas fonctionnelle mais architecturale** : chez Drupal la configuration vit en base et s'exporte en YAML ; chez Payload elle n'existe qu'en TypeScript et génère les types du projet. On y gagne la vérification à la compilation, on y perd la modification par l'UI.

**Le coût réel de l'écosystème n'est pas dans le CMS mais dans la couche de déploiement.** Sur dix pannes rencontrées pendant l'évaluation, aucune ne venait du cœur de Payload (§ 3).

---

## 1. Correspondances

| Drupal | Payload | Remarques |
|---|---|---|
| Content types + champs | Collections + `fields` | En TypeScript, pas en base ni via l'UI |
| Paragraphs | Blocks | Tableau de blocs typés sur un champ |
| Webform | plugin `form-builder` | Champs texte, select, checkbox, number, country/state, textarea ; e-mails de confirmation ; soumissions stockées |
| Redirect | plugin `redirects` | Cible interne (référence) ou URL ; voir le piège § 3 |
| Pathauto | `slugField` | Génération depuis un champ source, surchargeable |
| Metatag | plugin `seo` | Champs meta + génération de titre/URL |
| Search API | plugin `search` | Collection d'index synchronisée par hook |
| Revisions + Content Moderation | `versions.drafts` | Brouillons, autosave, `schedulePublish`, `maxPerDoc` |
| Menus | Globals (`Header`, `Footer`) | Un global = un singleton de configuration |
| Database API | db adapters | `postgres`, `sqlite`, `mongodb` |
| Mail API | email adapters | Sans adaptateur, les mails partent en console |
| File API / stream wrappers | storage adapters | `s3`, `vercel-blob`, `azure`, `gcs`, disque local |
| Cron / Queue API | jobs queue | Collection `payload-jobs`, tâches planifiées via `waitUntil` |
| JSON:API / GraphQL | REST + GraphQL + Local API | Les trois partagent le même contrôle d'accès |
| Hooks (`hook_entity_presave`…) | `hooks` de collection et de champ | Portée locale, pas d'`_alter` global |
| Config sync (YAML) | *(pas d'équivalent)* | La config **est** le code |
| Migrate API | *(pas d'équivalent)* | Scripts sur l'API locale |
| Views | *(pas d'équivalent)* | Requêtes écrites à la main |
| `/admin/people/permissions` | *(pas d'équivalent)* | Fonctions d'accès en TypeScript |
| node_access (grants) | contraintes de requête | Voir § 2 |

## 2. Trois différences de modèle

### 2.1 La configuration est du code, et elle génère les types

Un champ ajouté à une collection modifie `payload-types.ts` au prochain `generate:types`. Pendant l'évaluation, une erreur de structure sur un champ de formulaire est ressortie en **erreur de compilation TypeScript**, pas en erreur d'exécution. C'est le gain le plus concret sur Drupal, et il vaut surtout pour un frontend découplé qui consomme ces types.

La contrepartie : aucun changement de modèle sans commit ni déploiement. Là où un site Drupal laisse un intégrateur ajouter un champ en production, Payload impose le cycle de développement complet.

### 2.2 Le contrôle d'accès par ligne est une requête, pas une table de grants

Une fonction d'accès peut retourner un objet `Where` au lieu d'un booléen ; ce filtre est injecté dans toutes les requêtes, quelle que soit l'API. Le starter en contient déjà un exemple :

```ts
export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { _status: { equals: 'published' } }
}
```

Fonctionnellement, cela couvre l'essentiel de ce que `hook_node_access_records` / `hook_node_grants` permettent, sans table d'index à reconstruire ni cache à invalider. Détails et schéma de rôles : `docs/roles-and-access-control.md`.

### 2.3 Pas de système de modules, donc pas d'`alter`

Les plugins Payload composent la configuration au démarrage (ils ajoutent des collections, des champs, des hooks). Il n'existe pas de mécanisme par lequel un module tiers modifie le comportement d'un autre, comme le font les `hook_*_alter`. Les surcharges passent par les options du plugin — par exemple `formOverrides.fields` du form-builder, utilisé dans le starter pour enrichir l'éditeur du message de confirmation.

Moins de magie, moins d'interactions imprévues, mais aussi moins de latitude quand un plugin ne prévoit pas le point d'extension dont on a besoin. Rencontré pendant l'évaluation : l'adaptateur `vercel-blob` ne transmet pas `allowOverwrite` à l'API sous-jacente, l'option est donc simplement inaccessible.

## 3. Ce que l'évaluation a coûté, et à qui l'imputer

Dix pannes ont jalonné le déploiement d'un starter officiel sur son hébergeur de référence. La répartition est instructive :

| Origine | Nombre | Exemples |
|---|---|---|
| Couche de déploiement | 4 | `ERR_PNPM_IGNORED_BUILDS` (pnpm 11 a déplacé la configuration des scripts d'install) ; `__turbopack_context__.a is not a function` sur un `postcss.config.js` en ESM (Next 16.3, linux-x64 uniquement) ; Vercel passé à OIDC, dont l'adaptateur Payload ne sait rien |
| Template | 3 | Nettoyage via `payload.db.deleteMany`, qui contourne les hooks et laisse les fichiers dans le stockage ; token de stockage lu en dur ; suppressions concurrentes qui bloquent le pool de connexions |
| Contenu de test | 3 | Nœuds Lexical non activés dans l'éditeur ; redirections sur des chemins à deux segments ; dépassement du délai de fonction |

**Aucune ne venait du cœur de Payload.** Collections, versions, brouillons, Lexical, plugins, API locale et panneau d'administration ont fonctionné sans incident sur 18 articles et 8 pages.

Deux enseignements transposables à ce projet :

- **Les défauts du template ne se voient qu'à l'échelle.** Ils étaient tous invisibles avec le contenu de démonstration d'origine (3 articles, base locale). C'est un argument pour se doter tôt d'un jeu de données réaliste.
- **La fraîcheur simultanée des versions coûte cher.** Next 16.3, pnpm 11 et le basculement OIDC de Vercel datent tous de quelques semaines. Épingler des versions reposées aurait supprimé quatre pannes sur dix.

## 4. Pièges vérifiés, utiles pour ce projet

- **Un type de nœud Lexical absent de la configuration de l'éditeur casse le panneau d'administration** (`Minified Lexical error #17`), alors que le frontend l'affiche correctement — les convertisseurs de rendu sont indépendants de la configuration de l'éditeur. Conséquence directe ici : le sérialiseur maison de `packages/ui` peut rendre des nœuds que le CMS refuse d'ouvrir. Toute feature ajoutée exige aussi `generate:importmap`.
- **Les redirections ne sont résolues que sur des chemins correspondant à une route existante.** Un `from` à deux segments renvoie un 404 avant même que le plugin soit consulté.
- **Supprimer des médias via la couche base laisse les fichiers dans le stockage.** Passer par `payload.delete()` pour déclencher les hooks de l'adaptateur.
- **Sans adaptateur de stockage, Payload écrit sur le disque** et ne le signale que par un avertissement au démarrage (`Collection(s) without storage adapters`). En environnement à système de fichiers en lecture seule, l'échec arrive plus tard, à l'upload.
- **Écrire une cinquantaine de documents séquentiellement ne tient pas dans une fonction serverless.** Un traitement par lots de 4 (le pool par défaut est à 10) divise les allers-retours par plus de trois. Pour ce projet, le seed doit rester un script CLI, pas une route HTTP.

## Sources

- Évaluation pratique menée le 21 août 2026 sur `payload-website-starter` (Payload 3.84.1, Next 16.3), dépôt de test séparé.
- Contrôle d'accès Payload : https://payloadcms.com/docs/access-control/overview
- Versions et brouillons : https://payloadcms.com/docs/versions/drafts
- Adaptateurs de stockage : https://payloadcms.com/docs/upload/storage-adapters
- Vercel Blob, authentification OIDC par défaut : https://vercel.com/docs/vercel-blob
