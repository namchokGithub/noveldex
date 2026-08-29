import { PageLoadingState } from './novels/ui'

export default function Loading() {
  return (
    <PageLoadingState
      maxWidth="max-w-6xl"
      backLinkWidth="h-8 w-40"
      headerWidths={['h-6 w-28', 'h-12 w-3/4', 'h-4 w-full', 'h-4 w-2/3']}
      contentCards={[1]}
    />
  )
}
