import AdminPayments from '@/components/screens/admin/payments/AdminPayments'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Платежи',
	description: 'Admin panel payments page'
}

const AdminPaymentsPage = () => {
	return <AdminPayments />
}

export default AdminPaymentsPage
