'use client'
import { useRouter } from 'next/navigation'
import { Home, Briefcase, Plus, FolderOpen, ClipboardCheck } from 'lucide-react'

const S = { card: '#FFFFFF', accent: '#3A7CA5', muted: '#A1A1AA', border: '#E4E4E7' }

export type NavTab = 'home' | 'jobs' | 'projects' | 'history' | 'inspect'

interface Props {
  activeTab?: NavTab
  onTabChange?: (tab: NavTab) => void
  onNewJob?: () => void
  jobsBadge?: number
  projectsBadge?: number
}

interface NavButtonProps {
  tab: NavTab
  activeTab?: NavTab
  icon: React.ReactNode
  label: string
  badge?: number
  onClick: () => void
}

function NavButton({ tab, activeTab, icon, label, badge, onClick }: NavButtonProps) {
  const isActive = activeTab === tab
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-0.5 py-2 relative"
      style={{ color: isActive ? S.accent : S.muted }}
    >
      <div
        className="w-14 h-8 rounded-full flex items-center justify-center relative"
        style={{ background: isActive ? 'rgba(58,124,165,0.14)' : 'transparent' }}
      >
        <div style={{ color: isActive ? S.accent : S.muted }}>{icon}</div>
        {!!badge && (
          <span
            className="absolute -top-1 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5"
            style={{ background: S.accent }}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span
        className="text-[10px] leading-none"
        style={{ fontWeight: isActive ? 700 : 500, color: isActive ? S.accent : S.muted }}
      >
        {label}
      </span>
      {isActive && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 rounded-b-full"
          style={{ height: 3, background: S.accent }}
        />
      )}
    </button>
  )
}

export function StaffBottomNav({ activeTab, onTabChange, onNewJob, jobsBadge, projectsBadge }: Props) {
  const router = useRouter()

  function go(tab: NavTab) {
    if (onTabChange) onTabChange(tab)
    else {
      const map: Partial<Record<NavTab, string>> = {
        jobs: '/supplier-portal/staff-home?tab=jobs',
        projects: '/supplier-portal/staff-home?tab=projects',
        history: '/supplier-portal/staff-home?tab=history',
        inspect: '/supplier-portal/staff-home?tab=inspect',
      }
      router.push(map[tab] ?? '/supplier-portal/staff-home')
    }
  }

  function handlePlus() {
    if (onNewJob) onNewJob()
    else router.push('/supplier-portal/staff-home')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center"
      style={{ background: S.card, borderTop: `1px solid ${S.border}`, paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <NavButton tab="home"     activeTab={activeTab} icon={<Home size={24} />}      label="Home"     onClick={() => go('home')} />
      <NavButton tab="jobs"     activeTab={activeTab} icon={<Briefcase size={24} />} label="Jobs"     badge={jobsBadge}     onClick={() => go('jobs')} />

      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={handlePlus}
          className="w-13 h-13 rounded-full flex items-center justify-center text-white -mt-4"
          style={{ background: S.accent, boxShadow: '0 4px 16px rgba(58,124,165,0.5)', width: 52, height: 52 }}
        >
          <Plus size={24} />
        </button>
      </div>

      <NavButton tab="projects" activeTab={activeTab} icon={<FolderOpen size={24} />}      label="Projects" badge={projectsBadge} onClick={() => go('projects')} />
      <NavButton tab="inspect"  activeTab={activeTab} icon={<ClipboardCheck size={24} />}  label="Inspect"  onClick={() => go('inspect')} />
    </div>
  )
}
