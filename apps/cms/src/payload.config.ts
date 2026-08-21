// Must stay first: populates process.env before anything else reads it.
import './lib/env'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { BlocksFeature, CodeBlock, lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Categories } from './collections/Categories'
import { Docs } from './collections/Docs'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { resolveDatabaseUri } from './lib/databaseUri'

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

/**
 * Public URL of this CMS. Payload appends it to the CSRF allowlist on its own
 * (`sanitizeConfig`), and without it the admin panel cannot write: browsers send
 * an `Origin` header on same-origin POSTs, `extractJWT` finds it missing from a
 * non-empty `csrf` list and drops the session cookie, so every save comes back
 * as "You are not allowed to perform this action."
 *
 * The localhost fallback only holds in development. In production a wrong value
 * reproduces that exact bug against the real domain, so an unset variable stops
 * the boot instead of shipping an admin panel that cannot save.
 */
function resolveServerURL(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL

  if (configured) return configured

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_SERVER_URL is not set. Point it at the public URL of this CMS, ' +
        'otherwise the admin panel rejects its own writes on CSRF grounds.',
    )
  }

  return 'http://localhost:3000'
}

const serverURL = resolveServerURL()

/** Origins allowed to query the API: the Astro site, in dev and in production. */
const allowedOrigins = [
  process.env.SITE_URL,
  process.env.LAGOON_ROUTE,
  'http://localhost:4321',
].filter((origin): origin is string => Boolean(origin))

export default buildConfig({
  serverURL,
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
  db: postgresAdapter({
    pool: { connectionString: resolveDatabaseUri() },
  }),
  sharp,
  plugins: [],
})
