import { Sidebar } from './Sidebar'

export function AppLayout({ children, isAdmin, businessName }: { children: React.ReactNode; isAdmin: boolean; businessName: string }) {
  return (
    <div className="flex min-h-screen bg-[#F5F2EC]">
      <Sidebar isAdmin={isAdmin} businessName={businessName} />
      <main className="ml-44 flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip">
        {children}
      </main>
    </div>
  )
}
