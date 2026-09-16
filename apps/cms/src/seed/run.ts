/**
 * Idempotent seed: can be re-run without duplicating or overwriting anything.
 *
 * Goes through Payload's local API — no HTTP, no server to start.
 */
import { randomUUID } from 'node:crypto'

import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload, type RichTextField } from 'payload'

import config from '../payload.config'
import { CATEGORIES, DOCS } from './content'

const payload = await getPayload({ config })

// `--if-empty`: only ever seed a blank database. The post-rollout task on Lagoon
// runs on every deployment; this is what makes it a first-install step.
if (process.argv.includes('--if-empty')) {
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) {
    console.log(`[seed] ${totalDocs} user(s) already present, nothing to do`)
    process.exit(0)
  }
}

// The `body` field's editor, not the default Lexical one: it is the one carrying
// `CodeBlock`, hence the converter that knows how to read ``` fences.
const bodyField = payload.collections.docs.config.fields.find(
  (field): field is RichTextField => 'name' in field && field.name === 'body',
)
if (!bodyField) throw new Error('No `body` field on the docs collection')

const editorConfig = await editorConfigFactory.fromField({ field: bodyField })
const toLexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })

// --- Administrator ----------------------------------------------------------

const email = process.env.SEED_ADMIN_EMAIL
const password = process.env.SEED_ADMIN_PASSWORD

if (!email || !password) {
  throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')
}

/** Looks a user up by address — the seed creates two, so a count would not do. */
const userExists = async (address: string) =>
  (await payload.find({ collection: 'users', where: { email: { equals: address } }, limit: 1 }))
    .docs.length > 0

if (await userExists(email)) {
  console.log(`[seed] administrator ${email} already exists, skipping creation`)
} else {
  await payload.create({ collection: 'users', data: { email, password } })
  console.log(`[seed] administrator created: ${email}`)
}

// --- Preview service user ---------------------------------------------------

// The Astro preview route reads drafts with this API key rather than a session:
// `authenticatedOrPublished` grants drafts to any authenticated user, and a
// request carrying a valid key counts as one.
const previewApiKey = process.env.PREVIEW_API_KEY

if (!previewApiKey) {
  throw new Error('PREVIEW_API_KEY must be set in .env')
}

const PREVIEW_EMAIL = 'preview@example.com'

if (await userExists(PREVIEW_EMAIL)) {
  console.log(`[seed] preview user ${PREVIEW_EMAIL} already exists, skipping creation`)
} else {
  await payload.create({
    collection: 'users',
    data: {
      email: PREVIEW_EMAIL,
      // Never used to log in: the API key is the only credential. Payload still
      // requires a password, so it gets one nobody knows.
      password: randomUUID(),
      enableAPIKey: true,
      apiKey: previewApiKey,
    },
  })
  console.log(`[seed] preview user created: ${PREVIEW_EMAIL}`)
}

// --- Categories -------------------------------------------------------------

// Postgres ids are integers, not strings: a relationship field rejects an id
// whose type does not match the one its collection uses.
const categoryIds = new Map<string, number>()

for (const category of CATEGORIES) {
  const found = await payload.find({
    collection: 'categories',
    where: { slug: { equals: category.slug } },
    limit: 1,
  })

  const existing = found.docs[0]
  if (existing) {
    categoryIds.set(category.slug, existing.id)
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
  categoryIds.set(category.slug, created.id)
  console.log(`[seed] category "${category.slug}"`)
}

// --- Doc pages --------------------------------------------------------------

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
  if (!categoryId) throw new Error(`Unknown category: ${doc.category}`)

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
  console.log(`[seed] page "${doc.slug}" (en + fr)`)
}

console.log(`[seed] done — ${created} page(s) created, ${DOCS.length - created} already present`)
process.exit(0)
