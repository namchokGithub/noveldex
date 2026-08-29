import { PageLoadingState } from '@/app/novels/ui'

export default function Loading() {
  return (
    <PageLoadingState
      maxWidth="max-w-4xl"
      backLinkWidth="h-8 w-36"
      headerWidths={['h-7 w-28', 'h-12 w-80', 'h-4 w-full max-w-xl']}
      contentCards={[4, 4, 6]}
    />
  )
}
