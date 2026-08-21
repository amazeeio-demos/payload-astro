import type { DocEntry } from '@repo/graphql'

import { CodeBlock } from './blocks/CodeBlock'
import { RichText, type BlockComponents } from './RichText'

/**
 * Blocks the editor can insert, keyed by the `blockType` Payload stores.
 * `Code` is capitalised because that is the slug of the block registered in
 * `apps/cms/src/payload.config.ts`.
 */
export const DEFAULT_BLOCKS: BlockComponents = {
  Code: CodeBlock as BlockComponents[string],
}

export interface DocPageProps {
  /**
   * Either the published page from the build-time snapshot or the draft the
   * preview island receives — the two shapes only differ by `_status`.
   */
  doc: Pick<DocEntry, 'title' | 'description' | 'body'>
  locale: string
  defaultLocale?: string
}

/**
 * A documentation page. Purely presentational: it never fetches anything, which
 * is what lets the same component render statically at build time and live in
 * the preview island.
 */
export function DocPage({ doc, locale, defaultLocale = 'en' }: DocPageProps) {
  return (
    <article className="doc">
      <h1 className="doc-title">{doc.title}</h1>
      {doc.description ? <p className="doc-description">{doc.description}</p> : null}
      <div className="doc-body">
        <RichText
          data={doc.body}
          blocks={DEFAULT_BLOCKS}
          locale={locale}
          defaultLocale={defaultLocale}
        />
      </div>
    </article>
  )
}
