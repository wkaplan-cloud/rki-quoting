import { redirect } from 'next/navigation'

export default function SupplierDashboardRedirect() {
  redirect('/supplier-portal/price-requests')
}
