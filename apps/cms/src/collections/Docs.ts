import type { CollectionConfig } from 'payload'

import { authenticated, authenticatedOrPublished } from '../access'
import { markdownField } from '../fields/markdown'

export const Docs: CollectionConfig = {
  slug: 'docs',
  labels: { singular: 'Page de doc', plural: 'Pages de doc' },
  // Noms explicites : le loader Astro les référence en dur dans ses requêtes.
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
    drafts: true,
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
        description: "Segment d'URL, non traduit — partagé par toutes les locales.",
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      admin: { description: 'Résumé affiché en méta-description et dans la recherche.' },
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
        description: 'Libellé court dans la sidebar. Vide = titre de la page.',
      },
    },
    {
      name: 'sidebarOrder',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Ordre au sein de la catégorie (croissant).',
      },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      localized: true,
    },
    // Dérivé de `body`, exposé en GraphQL, jamais stocké.
    markdownField('body'),
  ],
}
