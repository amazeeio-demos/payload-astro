import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Field, RichTextField } from 'payload'

import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'

/**
 * Virtual field exposing the Lexical body as Markdown.
 *
 * The frontend no longer uses it — it renders the Lexical JSON itself, see
 * `packages/ui/src/RichText.tsx`. The field stays because Markdown remains the
 * cheapest input for anything that is not a browser: search indexing, an export,
 * a prompt.
 *
 * It is computed on read and dropped before write: nothing is stored.
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
