import { graphqlRequest } from './graphql.js'

export interface SidebarLink {
  slug: string
}

export interface SidebarGroup {
  label: string
  translations?: Record<string, string>
  items: SidebarLink[]
}

export interface FetchSidebarOptions {
  endpoint: string
  locales: readonly string[]
  defaultLocale: string
}

interface SidebarQueryResult {
  Categories: { docs: { id: string; slug: string; name: string }[] }
  Docs: { docs: { slug: string; category: { id: string } | null }[] }
}

const SIDEBAR_QUERY = /* GraphQL */ `
  query Sidebar($locale: LocaleInputType!) {
    Categories(locale: $locale, limit: 100, sort: "order") {
      docs {
        id
        slug
        name
      }
    }
    Docs(
      locale: $locale
      limit: 500
      sort: "sidebarOrder"
      where: { _status: { equals: published } }
    ) {
      docs {
        slug
        category {
          id
        }
      }
    }
  }
`

/**
 * Construit la sidebar Starlight à partir des catégories Payload.
 *
 * Appelée depuis `astro.config.mjs`, donc avant l'exécution du loader : la
 * sidebar fait partie de la configuration de l'intégration, pas du contenu.
 * Les entrées sont déclarées par `slug`, ce qui laisse Starlight préfixer
 * lui-même les URL selon la locale.
 *
 * En cas d'indisponibilité de Payload, on renvoie une sidebar vide plutôt que
 * de faire échouer le chargement de la config : c'est le loader qui porte
 * l'échec bloquant du build.
 */
export async function fetchStarlightSidebar(
  options: FetchSidebarOptions,
): Promise<SidebarGroup[]> {
  const { endpoint, locales, defaultLocale } = options

  let byLocale: Map<string, SidebarQueryResult>
  try {
    const results = await Promise.all(
      locales.map(async (locale) => {
        const data = await graphqlRequest<SidebarQueryResult>(endpoint, SIDEBAR_QUERY, { locale })
        return [locale, data] as const
      }),
    )
    byLocale = new Map(results)
  } catch (error) {
    console.warn(`[sidebar] Payload injoignable, sidebar vide. ${(error as Error).message}`)
    return []
  }

  const base = byLocale.get(defaultLocale)
  if (!base) return []

  // Slugs des documents rattachés à chaque catégorie, dans l'ordre renvoyé par
  // Payload (tri sur `sidebarOrder`).
  const slugsByCategory = new Map<string, string[]>()
  const orphans: string[] = []
  for (const doc of base.Docs.docs) {
    if (!doc.category) {
      orphans.push(doc.slug)
      continue
    }
    const existing = slugsByCategory.get(doc.category.id)
    if (existing) existing.push(doc.slug)
    else slugsByCategory.set(doc.category.id, [doc.slug])
  }

  const groups: SidebarGroup[] = []

  for (const category of base.Categories.docs) {
    const slugs = slugsByCategory.get(category.id)
    if (!slugs?.length) continue

    const translations: Record<string, string> = {}
    for (const [locale, data] of byLocale) {
      if (locale === defaultLocale) continue
      const translated = data.Categories.docs.find((c) => c.id === category.id)
      if (translated) translations[locale] = translated.name
    }

    groups.push({
      label: category.name,
      ...(Object.keys(translations).length ? { translations } : {}),
      items: slugs.map((slug) => ({ slug })),
    })
  }

  if (orphans.length) {
    groups.push({ label: 'Divers', items: orphans.map((slug) => ({ slug })) })
  }

  return groups
}
