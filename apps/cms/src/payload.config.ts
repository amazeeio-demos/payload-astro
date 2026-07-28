// Doit rester en tout premier : peuple process.env avant toute autre lecture.
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
  plaintext: 'Texte brut',
}

/** Origines autorisées à interroger l'API : le site Astro, en dev et en prod. */
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
  // Doit rester aligné avec LOCALES dans apps/web/src/site.ts.
  localization: {
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    fallback: true,
  },
  cors: allowedOrigins,
  csrf: allowedOrigins,
  // L'éditeur Lexical n'a pas de bloc de code natif — rédhibitoire pour de la
  // documentation technique. `CodeBlock` est le bloc fourni par Payload : il
  // apporte l'UI d'édition et, surtout, un convertisseur Markdown bidirectionnel
  // qui préserve les clôtures ``` et le langage à l'aller comme au retour.
  //
  // La liste par défaut est celle de Monaco (une centaine d'entrées, et `shell`
  // plutôt que `bash`). On la restreint à ce que ce projet utilise réellement,
  // avec des identifiants que Shiki reconnaît côté Astro : la valeur choisie ici
  // atterrit telle quelle après les ``` et pilote la coloration syntaxique.
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
