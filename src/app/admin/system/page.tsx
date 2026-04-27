import AdminSystem from '@/components/screens/admin/system/AdminSystem'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Система',
	description: 'Admin system status page'
}

const AdminSystemPage = () => {
	return <AdminSystem />
}

export default AdminSystemPage
