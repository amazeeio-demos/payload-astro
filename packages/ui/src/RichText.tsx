import type { CSSProperties, ComponentType, ReactNode } from 'react'
import { Fragment } from 'react'

import { internalDocToHref, type LocaleContext } from './links'
import {
  isEditorState,
  TEXT_FORMAT,
  type SerializedBlockNode,
  type SerializedElementNode,
  type SerializedHeadingNode,
  type SerializedLinkNode,
  type SerializedListItemNode,
  type SerializedListNode,
  type SerializedNode,
  type SerializedTextNode,
  type SerializedUploadNode,
} from './lexical/types'

/** Props a block component receives: its own fields, straight from Lexical. */
export interface BlockProps<Fields = Record<string, unknown>> {
  fields: Fields & { blockType: string }
}

export type BlockComponents = Record<string, ComponentType<BlockProps<never>>>

export interface Converters {
  /**
   * Overrides or additions, keyed by node type. `children` is already
   * serialized; return null to drop the node entirely.
   */
  [nodeType: string]: (args: {
    node: SerializedNode
    children: ReactNode
    context: RichTextContext
  }) => ReactNode
}

export interface RichTextContext extends LocaleContext {
  blocks: BlockComponents
  converters: Converters
}

export interface RichTextProps extends Partial<LocaleContext> {
  /** The `body` field as GraphQL returns it — the `JSON` scalar, hence unknown. */
  data: unknown
  converters?: Converters
  blocks?: BlockComponents
}

/**
 * Renders Payload's Lexical JSON as React elements.
 *
 * Public pages render this server-side with no client directive, so the output
 * is plain HTML and ships no JavaScript; the preview island renders the very
 * same component in the browser. Keeping one serializer for both is what makes
 * the preview trustworthy.
 */
export function RichText({
  data,
  converters = {},
  blocks = {},
  locale = 'en',
  defaultLocale = 'en',
}: RichTextProps) {
  if (!isEditorState(data)) return null

  const context: RichTextContext = { blocks, converters, locale, defaultLocale }

  return <>{serializeChildren(data.root.children, context)}</>
}

function serializeChildren(
  nodes: SerializedNode[] | undefined,
  context: RichTextContext,
): ReactNode {
  if (!nodes?.length) return null

  return nodes.map((node, index) => (
    <Fragment key={index}>{serializeNode(node, context)}</Fragment>
  ))
}

function serializeNode(node: SerializedNode, context: RichTextContext): ReactNode {
  const children = serializeChildren((node as SerializedElementNode).children, context)

  const override = context.converters[node.type]
  if (override) return override({ node, children, context })

  switch (node.type) {
    case 'text':
      return serializeText(node as SerializedTextNode)

    case 'linebreak':
      return <br />

    // A tab inside a paragraph. `\t` alone would collapse in HTML.
    case 'tab':
      return <span style={{ whiteSpace: 'pre' }}>{'\t'}</span>

    case 'paragraph':
      return <p style={elementStyle(node)}>{children}</p>

    case 'heading': {
      const Tag = (node as SerializedHeadingNode).tag
      return <Tag style={elementStyle(node)}>{children}</Tag>
    }

    case 'quote':
      return <blockquote style={elementStyle(node)}>{children}</blockquote>

    case 'list': {
      const list = node as SerializedListNode
      const Tag = list.tag
      return (
        <Tag
          className={list.listType === 'check' ? 'rt-list-check' : undefined}
          start={Tag === 'ol' ? list.start : undefined}
          style={elementStyle(node)}
        >
          {children}
        </Tag>
      )
    }

    case 'listitem': {
      const item = node as SerializedListItemNode
      // Check lists carry their state on the item; `aria-checked` keeps it
      // readable without any interactive markup.
      if (typeof item.checked === 'boolean') {
        return (
          <li aria-checked={item.checked} role="checkbox" style={elementStyle(node)}>
            {children}
          </li>
        )
      }
      return <li style={elementStyle(node)}>{children}</li>
    }

    case 'horizontalrule':
      return <hr />

    case 'link':
    case 'autolink':
      return serializeLink(node as SerializedLinkNode, children, context)

    case 'upload':
      return serializeUpload(node as SerializedUploadNode)

    case 'block':
      return serializeBlock(node as SerializedBlockNode, context)

    default:
      warnUnknown(node.type)
      return null
  }
}

function serializeText(node: SerializedTextNode): ReactNode {
  let element: ReactNode = node.text
  const { format } = node

  // Innermost first: `code` hugs the text, emphasis wraps it.
  if (format & TEXT_FORMAT.code) element = <code>{element}</code>
  if (format & TEXT_FORMAT.subscript) element = <sub>{element}</sub>
  if (format & TEXT_FORMAT.superscript) element = <sup>{element}</sup>
  if (format & TEXT_FORMAT.underline) element = <u>{element}</u>
  if (format & TEXT_FORMAT.strikethrough) element = <s>{element}</s>
  if (format & TEXT_FORMAT.italic) element = <em>{element}</em>
  if (format & TEXT_FORMAT.bold) element = <strong>{element}</strong>

  return element
}

function serializeLink(
  node: SerializedLinkNode,
  children: ReactNode,
  context: RichTextContext,
): ReactNode {
  const { fields } = node
  const href =
    fields.linkType === 'internal'
      ? internalDocToHref(fields.doc, context)
      : (fields.url ?? null)

  // An internal link whose target was not populated has no URL: render the text
  // rather than an anchor pointing nowhere.
  if (!href) return <>{children}</>

  return (
    <a
      href={href}
      {...(fields.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  )
}

function serializeUpload(node: SerializedUploadNode): ReactNode {
  const media = node.value
  if (!media?.url) return null

  return (
    <img
      src={media.url}
      alt={media.alt ?? ''}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading="lazy"
    />
  )
}

function serializeBlock(node: SerializedBlockNode, context: RichTextContext): ReactNode {
  const { blockType } = node.fields
  const Block = context.blocks[blockType]

  if (!Block) {
    warnUnknown(`block:${blockType}`)
    return null
  }

  return <Block fields={node.fields as never} />
}

/**
 * Alignment and indentation, the two element-level properties the editor can
 * set. Indentation goes through a CSS variable so a stylesheet decides what one
 * level is worth.
 */
function elementStyle(node: SerializedNode): CSSProperties | undefined {
  const element = node as SerializedElementNode
  const style: CSSProperties & Record<string, string | number> = {}

  if (typeof element.format === 'string' && element.format) {
    style.textAlign = element.format as CSSProperties['textAlign']
  }
  if (element.indent) {
    style['--rt-indent'] = element.indent
    style.paddingInlineStart = 'calc(var(--rt-indent, 0) * var(--rt-indent-step, 1.5rem))'
  }

  return Object.keys(style).length ? style : undefined
}

const warned = new Set<string>()

/** Once per node type, and only in development: a build must not go noisy. */
function warnUnknown(type: string): void {
  if (process.env.NODE_ENV === 'production' || warned.has(type)) return
  warned.add(type)
  console.warn(`[RichText] no converter for "${type}" — node skipped.`)
}
