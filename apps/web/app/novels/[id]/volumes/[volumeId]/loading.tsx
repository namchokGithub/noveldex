import { PageLoadingState } from '@/app/novels/ui'

export default function Loading() {
  return (
    <PageLoadingState
      maxWidth="max-w-5xl"
      backLinkWidth="h-8 w-44"
      headerWidths={['h-7 w-24', 'h-12 w-72', 'h-4 w-full max-w-xl']}
      contentCards={[3, 5, 5]}
    />
  )
}
