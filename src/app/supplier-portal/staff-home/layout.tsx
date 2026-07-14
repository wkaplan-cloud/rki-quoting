import { NumberInputAutoSelect } from '@/components/NumberInputAutoSelect'

export default function StaffHomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NumberInputAutoSelect />
      {children}
    </>
  )
}
