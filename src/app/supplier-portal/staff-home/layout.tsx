import { NumberInputAutoSelect } from '@/components/NumberInputAutoSelect'
import { SessionExpiredHandler } from '@/components/SessionExpiredHandler'

export default function StaffHomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionExpiredHandler loginPath="/supplier-portal/login" />
      <NumberInputAutoSelect />
      {children}
    </>
  )
}
