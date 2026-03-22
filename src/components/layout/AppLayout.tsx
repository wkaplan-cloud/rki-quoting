import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F2EC]">
      <Sidebar />
      <main className="ml-56 flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
