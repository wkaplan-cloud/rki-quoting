'use client'
import { useRouter } from 'next/navigation'
import { Home, Briefcase, Plus, FolderOpen, Menu } from 'lucide-react'

const S = { card: '#FFFFFF', accent: '#3A7CA5', muted: '#71717A', border: '#E4E4E7' }

export type NavTab = 'home' | 'jobs' | 'projects' | 'history' | 'more'

interface Props {
  activeTab?: NavTab
  onTabChange?: (tab: NavTab) => void
  onNewJob?: () => void
  jobsBadge?: number
  projectsBadge?: number
}

export function StaffBottomNav({ activeTab, onTabChange, onNewJob, jobsBadge, projectsBadge }: Props) {
  const router = useRouter()

  function go(tab: NavTab) {
    if (onTabChange) onTabChange(tab)
    else router.push('/supplier-portal/staff-home')
  }

  function handlePlus() {
    if (onNewJob) onNewJob()
    else router.push('/supplier-portal/staff-home')
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center"
      style={{ background: S.card, borderTop: `1px solid ${S.border}`, paddingBottom: 'env(safe-area-inset-bottom)' }}>

      <button onClick={() => go('home')}
        className="flex-1 flex flex-col items-center gap-1.5 py-3"
        style={{ color: activeTab === 'home' ? S.accent : S.muted }}>
        <Home size={24} />
        <span className="text-xs font-semibold">Home</span>
      </button>

      <button onClick={() => go('jobs')}
        className="flex-1 flex flex-col items-center gap-1.5 py-3 relative"
        style={{ color: activeTab === 'jobs' ? S.accent : S.muted }}>
        <Briefcase size={24} />
        <span className="text-xs font-semibold">Jobs</span>
        {!!jobsBadge && (
          <span className="absolute top-2 right-[calc(50%-16px)] w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            style={{ background: S.accent }}>
            {jobsBadge}
          </span>
        )}
      </button>

      <div className="flex-1 flex items-center justify-center">
        <button onClick={handlePlus}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white -mt-5"
          style={{ background: S.accent, boxShadow: '0 4px 16px rgba(58,124,165,0.45)' }}>
          <Plus size={26} />
        </button>
      </div>

      <button onClick={() => go('projects')}
        className="flex-1 flex flex-col items-center gap-1.5 py-3 relative"
        style={{ color: activeTab === 'projects' ? S.accent : S.muted }}>
        <FolderOpen size={24} />
        <span className="text-xs font-semibold">Projects</span>
        {!!projectsBadge && (
          <span className="absolute top-2 right-[calc(50%-16px)] w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
            style={{ background: S.accent }}>
            {projectsBadge}
          </span>
        )}
      </button>

      <button onClick={() => go('more')}
        className="flex-1 flex flex-col items-center gap-1.5 py-3"
        style={{ color: activeTab === 'more' ? S.accent : S.muted }}>
        <Menu size={24} />
        <span className="text-xs font-semibold">More</span>
      </button>
    </div>
  )
}
