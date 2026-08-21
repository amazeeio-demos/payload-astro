import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublished } from '../access'
import { markdownField } from '../fields/markdown'

export const Docs: CollectionConfig = {
  slug: 'docs',
  labels: { singular: 'Doc page', plural: 'Doc pages' },
  // Explicit names: the Astro loader hardcodes them in its queries.
  graphQL: {
    singularName: 'Doc',
    pluralName: 'Docs',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'category', 'sidebarOrder', '_status'],
  },
  access: {
    read: authenticatedOrPublished,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  versions: {
    // Autosave is what makes the live preview feel instant: the admin pushes the
    // unsaved form state to the iframe on every change, and persists a draft
    // version in the background at this interval.
    drafts: { autosave: { interval: 375 } },
  },
  defaultSort: 'sidebarOrder',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'URL segment, never translated — shared across all locales.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: { description: 'Summary used as meta description and in search results.' },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: { position: 'sidebar' },
    },
    {
      name: 'sidebarLabel',
      type: 'text',
      localized: true,
      admin: {
        position: 'sidebar',
        description: 'Short label in the sidebar. Empty means the page title.',
      },
    },
    {
      name: 'sidebarOrder',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Position within the category (ascending).',
      },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      localized: true,
    },
    // Derived from `body`, exposed over GraphQL, never stored.
    markdownField('body'),
  ],
}
