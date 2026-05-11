import AdminAlerts from '@/components/screens/admin/alerts/AdminAlerts'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Предупреждения',
	description: 'Admin panel alerts page'
}

const AdminAlertsPage = () => {
	return <AdminAlerts />
}

export default AdminAlertsPage
