import type { CodegenConfig } from '@graphql-codegen/cli'

/**
 * Generates the types of the queries the frontend sends to Payload.
 *
 * The schema is read from a running CMS — `pnpm generate:graphql` therefore
 * needs `pnpm dev` up, exactly like `pnpm generate:types`. The output is
 * committed, so a build never has to reach the schema.
 */
const config: CodegenConfig = {
  schema: process.env.PAYLOAD_GRAPHQL_URL ?? 'http://localhost:3000/api/graphql',
  documents: ['src/documents.ts'],
  generates: {
    './src/generated/': {
      preset: 'client',
      presetConfig: {
        // No fragment masking: this project has a handful of queries and the
        // extra indirection buys nothing.
        fragmentMasking: false,
      },
      config: {
        // Documents come out as branded strings rather than parsed AST nodes:
        // the frontend then needs `fetch` and nothing else — no `graphql`
        // runtime, which would otherwise ship in the Astro build.
        documentMode: 'string',
        // Only the types the queries above actually use: without this the whole
        // Payload schema lands in the generated file.
        onlyOperationTypes: true,
        // Enums as string-literal unions rather than TypeScript `enum`s: the
        // locale codes then stay plain strings on the Astro side.
        enumsAsTypes: true,
        // `import type` in the generated file — the repo compiles with
        // `verbatimModuleSyntax`, which rejects a value import used as a type.
        useTypeImports: true,
      },
    },
  },
}

export default config
