import { useLivePreview } from '@payloadcms/live-preview-react'
import type { DocDraftEntry } from '@repo/graphql'
import { DocPage } from '@repo/ui'

export interface PreviewIslandProps {
  /** The draft rendered server-side, before the admin sends anything. */
  initialData: DocDraftEntry
  locale: string
  defaultLocale: string
  /** Exact origin of the admin panel — the SDK checks `event.origin` against it. */
  serverURL: string
}

/**
 * The only interactive part of the preview page.
 *
 * `useLivePreview` subscribes to the admin's `postMessage`, tells it it is
 * ready, and returns the document Payload rebuilt from the unsaved form state.
 * `depth` must match the depth of `initialData` — the GraphQL query expands
 * `category` one level and no further — otherwise relationships disappear on the
 * first message.
 *
 * This file must never import `../site`: that module reads the preview secret
 * and API key from the environment, and this one is bundled for the browser.
 */
export default function PreviewIsland({
  initialData,
  locale,
  defaultLocale,
  serverURL,
}: PreviewIslandProps) {
  const { data } = useLivePreview<DocDraftEntry>({
    initialData,
    serverURL,
    depth: 1,
  })

  return <DocPage doc={data} locale={locale} defaultLocale={defaultLocale} />
}
