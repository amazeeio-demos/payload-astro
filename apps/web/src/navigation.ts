import { getCollection } from 'astro:content'

import { docHrefFor } from './routes'
import type { Locale } from './site'

export interface NavLink {
  href: string
  label: string
  slug: string
}

export interface NavGroup {
  label: string
  items: NavLink[]
}

/**
 * Sidebar of one locale: the published documents grouped by category.
 *
 * Both collections are build-time snapshots, so this runs against local data —
 * no request to the CMS, whether the page is prerendered or rendered on demand.
 * Categories give the order of the groups; documents that belong to none are
 * collected at the end rather than dropped.
 */
export async function buildNavigation(locale: Locale): Promise<NavGroup[]> {
  const docs = (await getCollection('docs'))
    .filter((entry) => entry.data.locale === locale)
    .sort((a, b) => (a.data.sidebarOrder ?? 0) - (b.data.sidebarOrder ?? 0))

  const categories = (await getCollection('categories'))
    .filter((entry) => entry.data.locale === locale)
    .sort((a, b) => a.data.order - b.data.order)

  const linksByCategory = new Map<string, NavLink[]>()
  const orphans: NavLink[] = []

  for (const entry of docs) {
    const link: NavLink = {
      href: docHrefFor(entry.data.slug, locale),
      label: entry.data.sidebarLabel ?? entry.data.title,
      slug: entry.data.slug,
    }

    const categorySlug = entry.data.category?.slug
    if (!categorySlug) {
      orphans.push(link)
      continue
    }

    const existing = linksByCategory.get(categorySlug)
    if (existing) existing.push(link)
    else linksByCategory.set(categorySlug, [link])
  }

  const groups: NavGroup[] = []

  for (const category of categories) {
    const items = linksByCategory.get(category.data.slug)
    if (!items?.length) continue
    groups.push({ label: category.data.name ?? category.data.slug, items })
  }

  if (orphans.length) groups.push({ label: 'Other', items: orphans })

  return groups
}
