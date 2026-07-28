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
 * Builds the Starlight sidebar from Payload categories.
 *
 * Called from `astro.config.mjs`, so before the loader runs: the sidebar belongs
 * to the integration's configuration, not to the content. Entries are declared
 * by `slug`, which lets Starlight prefix the URLs per locale itself.
 *
 * If Payload is unavailable we return an empty sidebar rather than failing to
 * load the config — the hard build failure is the loader's job.
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
    console.warn(`[sidebar] Payload unreachable, empty sidebar. ${(error as Error).message}`)
    return []
  }

  const base = byLocale.get(defaultLocale)
  if (!base) return []

  // Slugs of the documents attached to each category, in the order Payload
  // returned them (sorted on `sidebarOrder`).
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
    groups.push({ label: 'Other', items: orphans.map((slug) => ({ slug })) })
  }

  return groups
}
