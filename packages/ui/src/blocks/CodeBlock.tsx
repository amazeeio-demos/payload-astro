import type { BlockProps } from '../RichText'

export interface CodeBlockFields {
  blockType: string
  code?: string | null
  language?: string | null
}

/**
 * The `Code` block Payload's Lexical editor ships.
 *
 * No syntax highlighting yet: the same component runs at build time and inside
 * the preview island, and a highlighter that only works on one side would make
 * the preview lie. `language-*` is the class Prism, Shiki and highlight.js all
 * recognise, so highlighting can be added later without touching the markup.
 */
export function CodeBlock({ fields }: BlockProps<CodeBlockFields>) {
  const { code, language } = fields

  if (!code) return null

  return (
    <pre className={language ? `language-${language}` : undefined}>
      <code className={language ? `language-${language}` : undefined}>{code}</code>
    </pre>
  )
}
