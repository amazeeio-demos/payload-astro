// Must stay first: populates process.env before anything else reads it.
import './lib/env'

import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { BlocksFeature, CodeBlock, lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Categories } from './collections/Categories'
import { Docs } from './collections/Docs'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { resolveMongoUri } from './lib/mongoUri'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const CODE_LANGUAGES = {
  bash: 'Bash',
  json: 'JSON',
  yaml: 'YAML',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  tsx: 'TSX',
  astro: 'Astro',
  graphql: 'GraphQL',
  dockerfile: 'Dockerfile',
  nginx: 'nginx',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  markdown: 'Markdown',
  diff: 'Diff',
  plaintext: 'Plain text',
}

/** Origins allowed to query the API: the Astro site, in dev and in production. */
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.LAGOON_ROUTE,
  'http://localhost:4321',
].filter((origin): origin is string => Boolean(origin))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Docs, Categories, Media, Users],
  // Must stay in sync with LOCALES in apps/web/src/site.ts.
  localization: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    fallback: true,
  },
  cors: allowedOrigins,
  csrf: allowedOrigins,
  // The Lexical editor has no built-in code block — a dealbreaker for technical
  // documentation. `CodeBlock` is the block Payload ships: it brings the editing
  // UI and, more importantly, a two-way Markdown converter that preserves ```
  // fences and their language in both directions.
  //
  // Its default list is Monaco's (about a hundred entries, and `shell` rather
  // than `bash`). We narrow it to what this project actually uses, with
  // identifiers Shiki recognises on the Astro side: the value picked here lands
  // verbatim after the ``` and drives syntax highlighting.
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      BlocksFeature({ blocks: [CodeBlock({ languages: CODE_LANGUAGES })] }),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: resolveMongoUri(),
  }),
  sharp,
  plugins: [],
})
