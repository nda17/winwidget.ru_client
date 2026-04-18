import AdminSubscriptions from '@/components/screens/admin/subscriptions/AdminSubscriptions'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Подписки',
	description: 'Admin panel page'
}

const AdminSubscriptionsPage = () => {
	return <AdminSubscriptions />
}

export default AdminSubscriptionsPage
