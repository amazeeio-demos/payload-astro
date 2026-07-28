/**
 * Seed idempotent : peut être relancé sans dupliquer ni écraser.
 *
 * Passe par l'API locale de Payload — pas de HTTP, pas de serveur à démarrer.
 */
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload, type RichTextField } from 'payload'

import config from '../payload.config'
import { CATEGORIES, DOCS } from './content'
import { ensureCollections } from './ensureCollections'

const payload = await getPayload({ config })
await ensureCollections(payload)

// L'éditeur du champ `body`, pas l'éditeur Lexical par défaut : c'est lui qui
// porte le `CodeBlock`, donc le convertisseur qui sait lire les clôtures ```.
const bodyField = payload.collections.docs.config.fields.find(
  (field): field is RichTextField => 'name' in field && field.name === 'body',
)
if (!bodyField) throw new Error("Champ `body` introuvable sur la collection docs")

const editorConfig = await editorConfigFactory.fromField({ field: bodyField })
const toLexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })

// --- Administrateur ---------------------------------------------------------

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD

if (!email || !password) {
  throw new Error('SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD doivent être définis dans .env')
}

const existingUsers = await payload.count({ collection: 'users' })
if (existingUsers.totalDocs === 0) {
  await payload.create({ collection: 'users', data: { email, password } })
  console.log(`[seed] administrateur créé : ${email}`)
} else {
  console.log('[seed] un utilisateur existe déjà, création ignorée')
}

// --- Catégories -------------------------------------------------------------

const categoryIds = new Map<string, string>()

for (const category of CATEGORIES) {
  const found = await payload.find({
    collection: 'categories',
    where: { slug: { equals: category.slug } },
    limit: 1,
  })

  const existing = found.docs[0]
  if (existing) {
    categoryIds.set(category.slug, String(existing.id))
    continue
  }

  const created = await payload.create({
    collection: 'categories',
    locale: 'en',
    data: { slug: category.slug, name: category.name.en, order: category.order },
  })
  await payload.update({
    collection: 'categories',
    id: created.id,
    locale: 'fr',
    data: { name: category.name.fr },
  })
  categoryIds.set(category.slug, String(created.id))
  console.log(`[seed] catégorie « ${category.slug} »`)
}

// --- Pages de doc -----------------------------------------------------------

let created = 0

for (const doc of DOCS) {
  const found = await payload.find({
    collection: 'docs',
    where: { slug: { equals: doc.slug } },
    limit: 1,
    draft: true,
  })

  if (found.docs.length > 0) continue

  const categoryId = categoryIds.get(doc.category)
  if (!categoryId) throw new Error(`Catégorie inconnue : ${doc.category}`)

  const page = await payload.create({
    collection: 'docs',
    locale: 'en',
    data: {
      slug: doc.slug,
      title: doc.en.title,
      description: doc.en.description,
      body: toLexical(doc.en.body),
      category: categoryId,
      sidebarOrder: doc.sidebarOrder,
      _status: 'published',
    },
  })

  await payload.update({
    collection: 'docs',
    id: page.id,
    locale: 'fr',
    data: {
      title: doc.fr.title,
      description: doc.fr.description,
      body: toLexical(doc.fr.body),
      _status: 'published',
    },
  })

  created++
  console.log(`[seed] page « ${doc.slug} » (en + fr)`)
}

console.log(`[seed] terminé — ${created} page(s) créée(s), ${DOCS.length - created} déjà présente(s)`)
process.exit(0)
