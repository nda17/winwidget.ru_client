import AdminMailings from '@/components/screens/admin/mailings/AdminMailings'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Рассылки',
	description: 'Admin panel page'
}

const AdminMailingsPage = () => {
	return <AdminMailings />
}

export default AdminMailingsPage
