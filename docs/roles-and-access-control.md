# Rôles et contrôle d'accès dans Payload — schéma proposé

*État au 21 août 2026. Vérifié contre la documentation Payload et le code de `payload-website-starter` (3.84.1) ; le projet cible Payload 3.88, où le mécanisme est inchangé. Rédigé en réponse à un besoin identifié pendant l'évaluation : disposer d'au moins trois rôles (administrateur, éditeur, lecteur) avec un contrôle d'accès qui tienne. À implémenter dans une passe ultérieure — voir HANDOFF.md § 7.*

## Réponse courte

**Payload ne fournit pas de système de rôles clé en main, mais fournit tout pour en construire un**, et le contrôle s'applique à la couche d'accès aux données : REST, GraphQL et Local API sont couverts par les mêmes règles. Un frontend découplé ne peut donc pas contourner une règle en passant par une autre porte.

**Un rôle se matérialise par un champ `roles` sur la collection d'authentification**, plus des fonctions d'accès en TypeScript. Comptez une centaine de lignes pour le schéma décrit ici.

**Le point de vigilance principal est le champ `roles` lui-même** : sans accès en écriture restreint, un éditeur se promeut administrateur depuis son propre profil.

**Ce qui n'existe pas : une interface de gestion des permissions.** Ajouter un rôle ou modifier une règle demande un commit et un déploiement.

---

## 0. État actuel de ce projet (vérifié le 21 août 2026)

| Collection | `read` | `create` / `update` / `delete` |
|---|---|---|
| `Docs` | `authenticatedOrPublished` | `authenticated` |
| `Categories` | `anyone` | `authenticated` |
| `Media` | `() => true` | *aucune règle* → défaut Payload (utilisateur authentifié) |
| `Users` | *aucune règle* | *aucune règle* → défaut Payload (utilisateur authentifié) |

Autrement dit : **tout compte connecté peut modifier et supprimer n'importe quel document, et gérer les comptes utilisateurs**, y compris créer un administrateur. Il n'existe aujourd'hui qu'un seul niveau de privilège, « connecté ».

Deux conséquences immédiates :

- L'utilisateur de service `preview@`, dont la clé API est utilisée par la route de preview Astro (HANDOFF § 2), dispose des mêmes droits en écriture que n'importe qui. Une clé destinée à **lire des brouillons** ouvre en réalité l'écriture sur tout le CMS. C'est le point le plus urgent de cette note.
- Aucun rôle « lecteur » n'est possible : ouvrir le panneau à quelqu'un revient à lui donner les pleins pouvoirs.

C'est le comportement par défaut de Payload et du template dont ce projet est issu, pas une régression. Il est sans conséquence tant que le CMS reste sur `localhost`.

## 1. Les trois niveaux

| Niveau | Opérations | Retour possible |
|---|---|---|
| Collection | `create`, `read`, `update`, `delete`, `admin` | booléen **ou** contrainte de requête |
| Global | `read`, `update` | booléen **ou** contrainte de requête |
| Champ | `read`, `update` | booléen uniquement |

`admin` ne contrôle pas les droits mais la visibilité de la collection dans le panneau d'administration.

La contrainte de requête est le mécanisme intéressant : la fonction retourne un objet `Where` qui est injecté dans la requête. C'est ce qui remplace les grants de `node_access`, sans table d'index.

```ts
// Un éditeur ne voit que ses propres brouillons, un administrateur voit tout
export const ownDraftsOrPublished: Access = ({ req: { user } }) => {
  if (user?.roles?.includes('admin')) return true
  if (!user) return { _status: { equals: 'published' } }

  return {
    or: [{ _status: { equals: 'published' } }, { authors: { contains: user.id } }],
  }
}
```

## 2. Le champ `roles`

```ts
// apps/cms/src/collections/Users/index.ts
{
  name: 'roles',
  type: 'select',
  hasMany: true,
  required: true,
  defaultValue: ['viewer'],
  options: [
    { label: 'Administrator', value: 'admin' },
    { label: 'Editor', value: 'editor' },
    { label: 'Viewer', value: 'viewer' },
  ],
  // Roles travel in the JWT so access checks need no extra database read.
  saveToJWT: true,
  access: {
    // Without this, an editor can promote themselves from their own profile.
    update: ({ req: { user } }) => Boolean(user?.roles?.includes('admin')),
  },
}
```

Comportement du panneau, à connaître : un champ dont `access.update` renvoie `false` reste **visible mais en lecture seule** ; un champ dont `access.read` renvoie `false` est **retiré** du formulaire.

## 3. Les fonctions d'accès

À placer à côté des `anyone` / `authenticated` / `authenticatedOrPublished` existants.

```ts
// apps/cms/src/access/roles.ts
import type { Access } from 'payload'

const hasRole =
  (...roles: string[]): Access =>
  ({ req: { user } }) =>
    Boolean(user?.roles?.some((role) => roles.includes(role)))

/** Full control, including user management. */
export const isAdmin = hasRole('admin')

/** Content authoring. Admins are editors by construction. */
export const isEditor = hasRole('admin', 'editor')

/** Any signed-in user, including viewers: read-only access to the panel. */
export const isSignedIn: Access = ({ req: { user } }) => Boolean(user)
```

## 4. Application aux collections

| Collection | `read` | `create` / `update` / `delete` | `admin` |
|---|---|---|---|
| Contenu (docs, pages…) | `authenticatedOrPublished` | `isEditor` | `isSignedIn` |
| Media | `anyone` | `isEditor` | `isSignedIn` |
| Users | `isAdmin` | `isAdmin` | `isAdmin` |
| Globals (nav, réglages) | `anyone` | `isEditor` | — |

Le lecteur obtient ainsi un panneau consultable sans aucun bouton d'écriture, et n'a aucune visibilité sur les comptes.

Un raffinement possible, si les brouillons doivent rester privés à leur auteur : remplacer `read` du contenu par `ownDraftsOrPublished` (§ 1).

## 5. Pièges

**Le champ `roles` doit être protégé en écriture.** C'est l'erreur classique, et elle est silencieuse.

**`saveToJWT` fige les rôles dans le token.** Retirer un rôle ne prend effet qu'à l'expiration ou à la reconnexion. Acceptable pour un back-office ; si une révocation immédiate est nécessaire, lire les rôles en base plutôt qu'au JWT, au prix d'une requête par vérification.

**L'accès au niveau champ ne supporte pas les contraintes de requête**, seulement un booléen. Un filtrage par ligne se fait donc au niveau collection.

**Le premier utilisateur créé n'a pas de rôle particulier.** Avec `defaultValue: ['viewer']`, l'inscription initiale produirait un compte sans droits. Prévoir soit un `beforeChange` qui donne `admin` au premier utilisateur, soit un rôle explicite dans le script de seed.

**Aucune interface de permissions.** Chaque ajustement passe par le cycle commit / déploiement. C'est un changement d'organisation pour une équipe habituée à `/admin/people/permissions`.

## 6. À décider avant d'implémenter

1. Les brouillons doivent-ils être privés à leur auteur, ou visibles par tous les éditeurs ?
2. Le lecteur a-t-il besoin du panneau d'administration, ou lit-il uniquement le frontend ? Si le second, `admin: isEditor` suffit et le rôle `viewer` devient une simple étiquette d'API.
3. La route de preview utilise un utilisateur de service à clé API (HANDOFF § 2). Quel rôle lui donner ? Un rôle dédié en lecture seule autorisant les brouillons est plus propre que de réutiliser `admin`.
4. Faut-il un rôle par langue (éditeur FR / EN) ? Faisable via une contrainte de requête sur la locale, mais cela conditionne le modèle dès maintenant.

## Sources

- Contrôle d'accès : https://payloadcms.com/docs/access-control/overview
- Accès au niveau champ : https://payloadcms.com/docs/access-control/fields
- Authentification et `saveToJWT` : https://payloadcms.com/docs/authentication/overview
- Code vérifié : `src/access/*.ts` et `src/collections/Users` de `payload-website-starter` 3.84.1
