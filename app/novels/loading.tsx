import { PageLoadingState } from './ui'

export default function Loading() {
  return (
    <PageLoadingState
      maxWidth="max-w-7xl"
      headerWidths={['h-7 w-24', 'h-12 w-80', 'h-4 w-full max-w-2xl']}
      sidebar
      sidebarLines={['h-4 w-28', 'h-24 w-full', 'h-20 w-full']}
      contentCards={[3, 4, 4]}
      gridClassName="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"
    />
  )
}
