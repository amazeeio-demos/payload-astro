import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Field, RichTextField } from 'payload'

import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'

/**
 * Champ virtuel qui expose le corps Lexical en Markdown.
 *
 * C'est la charnière entre Payload et Astro : le frontend ne manipule jamais le
 * JSON Lexical, il reçoit du Markdown que le pipeline d'Astro rend lui-même —
 * ce qui lui vaut gratuitement les ancres de titres, la table des matières
 * Starlight et la coloration syntaxique Expressive Code.
 *
 * Le champ est calculé en lecture et supprimé avant écriture : rien n'est stocké.
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
