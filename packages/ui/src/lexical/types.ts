/**
 * The serialized Lexical nodes this project renders.
 *
 * Deliberately hand-written rather than imported from `@payloadcms/richtext-lexical`:
 * that package pulls `payload`, `@payloadcms/next` and `@payloadcms/ui` through
 * its peers, which has no place in a static frontend. What crosses the wire is
 * plain JSON, so a structural description of it is enough.
 *
 * Anything not listed here still parses — `SerializedNode` keeps an open shape —
 * and the serializer skips it with a warning instead of crashing.
 */

/** Bitmask Lexical packs the inline formats of a text node into. */
export const TEXT_FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
  subscript: 32,
  superscript: 64,
} as const

export interface SerializedElementNode {
  type: string
  children?: SerializedNode[]
  /** Alignment for element nodes ('left', 'center', …); empty when untouched. */
  format?: string | number
  /** Nesting level applied by the editor's indent buttons. */
  indent?: number
  direction?: 'ltr' | 'rtl' | null
  version?: number
}

export interface SerializedTextNode {
  type: 'text'
  text: string
  format: number
  style?: string
  mode?: string
  detail?: number
}

export interface SerializedHeadingNode extends SerializedElementNode {
  type: 'heading'
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export interface SerializedListNode extends SerializedElementNode {
  type: 'list'
  listType: 'bullet' | 'number' | 'check'
  tag: 'ul' | 'ol'
  start?: number
}

export interface SerializedListItemNode extends SerializedElementNode {
  type: 'listitem'
  value: number
  checked?: boolean
}

/** Target of an internal link: a document in another collection. */
export interface LinkDocument {
  relationTo: string
  value: { id?: string | number; slug?: string | null } | string | number
}

export interface SerializedLinkNode extends SerializedElementNode {
  type: 'link' | 'autolink'
  fields: {
    url?: string | null
    newTab?: boolean | null
    linkType?: 'custom' | 'internal'
    doc?: LinkDocument | null
  }
}

export interface SerializedUploadNode {
  type: 'upload'
  relationTo: string
  value: {
    url?: string | null
    alt?: string | null
    width?: number | null
    height?: number | null
  } | null
}

/**
 * A Payload block embedded in the rich text. `blockType` selects the component;
 * the other fields are the block's own, so they stay untyped here — each block
 * component narrows them itself.
 */
export interface SerializedBlockNode {
  type: 'block'
  fields: { blockType: string; [field: string]: unknown }
}

export interface SerializedRootNode extends SerializedElementNode {
  type: 'root'
}

export type SerializedNode =
  | SerializedElementNode
  | SerializedTextNode
  | SerializedHeadingNode
  | SerializedListNode
  | SerializedListItemNode
  | SerializedLinkNode
  | SerializedUploadNode
  | SerializedBlockNode

/** What Payload stores in a `richText` field. */
export interface SerializedEditorState {
  root: SerializedRootNode
}

/**
 * `body` arrives from GraphQL as the `JSON` scalar, so it is `any` at the edge.
 * This narrows it once, at the point where rendering starts.
 */
export function isEditorState(value: unknown): value is SerializedEditorState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'root' in value &&
    typeof (value as { root: unknown }).root === 'object'
  )
}
