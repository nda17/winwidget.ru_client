import AdminSettings from '@/components/screens/admin/settings/AdminSettings'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Общие настройки',
	description: 'Admin panel page'
}

const AdminSettingsPage = () => {
	return <AdminSettings />
}

export default AdminSettingsPage
