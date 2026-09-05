import { AdminPayments } from '@/screens/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Платежи',
	description: 'Admin panel payments page'
}

const AdminPaymentsPage = () => {
	return <AdminPayments />
}

export default AdminPaymentsPage
