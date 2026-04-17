import AdminContentSettings from '@/components/screens/admin/content-settings/AdminContentSettings'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Настройки контента сайта',
	description: 'Admin panel page'
}

const AdminContentSettingsPage = () => {
	return <AdminContentSettings />
}

export default AdminContentSettingsPage
