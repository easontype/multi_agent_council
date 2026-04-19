'use client'

import { DiscussionTimeline } from '@/components/council/discussion-timeline'
import { ReviewSidebar } from '@/components/council/review-sidebar'
import type { DiscussionSession } from '@/types/council'

interface ReviewResultsProps {
  session: DiscussionSession
  activeSourceLabel: string | null
  sidebarTab: 'sources' | 'chat'
  onSourceClick: (label: string) => void
  onTabChange: (tab: 'sources' | 'chat') => void
}

export function ReviewResults({
  session,
  activeSourceLabel,
  sidebarTab,
  onSourceClick,
  onTabChange,
}: ReviewResultsProps) {
  return (
    <>
      <div style={{ flex: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid #ececf1' }}>
        <DiscussionTimeline session={session} onSourceClick={onSourceClick} />
      </div>
      <div style={{ flex: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
        <ReviewSidebar
          session={session}
          activeSourceLabel={activeSourceLabel}
          tab={sidebarTab}
          onTabChange={onTabChange}
        />
      </div>
    </>
  )
}
