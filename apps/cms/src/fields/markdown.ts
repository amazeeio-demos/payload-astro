import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Field, RichTextField } from 'payload'

import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'

/**
 * Virtual field exposing the Lexical body as Markdown.
 *
 * This is the hinge between Payload and Astro: the frontend never handles
 * Lexical JSON, it receives Markdown that Astro's own pipeline renders — which
 * earns it heading anchors, the Starlight table of contents and Expressive Code
 * syntax highlighting for free.
 *
 * The field is computed on read and dropped before write: nothing is stored.
 */
export const markdownField = (richTextFieldName: string): Field => ({
  name: 'markdown',
  type: 'textarea',
  localized: true,
  admin: {
    hidden: true,
  },
  hooks: {
    afterRead: [
      ({ siblingData, siblingFields }) => {
        const data = siblingData[richTextFieldName] as SerializedEditorState | undefined

        if (!data) return ''

        return convertLexicalToMarkdown({
          data,
          editorConfig: editorConfigFactory.fromField({
            field: siblingFields.find(
              (field) => 'name' in field && field.name === richTextFieldName,
            ) as RichTextField,
          }),
        })
      },
    ],
    beforeChange: [
      ({ siblingData }) => {
        delete siblingData['markdown']
        return null
      },
    ],
  },
})
