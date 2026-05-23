import { PageLoadingState } from '../ui'

export default function Loading() {
  return (
    <PageLoadingState
      maxWidth="max-w-6xl"
      backLinkWidth="h-8 w-36"
      headerWidths={['h-7 w-20', 'h-12 w-96', 'h-4 w-full max-w-2xl']}
      sidebar
      sidebarLines={['h-4 w-28', 'h-28 w-full', 'h-28 w-full']}
      contentCards={[3, 5]}
      gridClassName="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"
    />
  )
}
