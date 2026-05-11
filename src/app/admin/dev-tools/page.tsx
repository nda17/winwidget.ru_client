import AdminDevTools from '@/components/screens/admin/dev-tools/AdminDevTools'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'DEV-инструменты',
	description: 'Admin panel developer tools page'
}

const AdminDevToolsPage = () => {
	return <AdminDevTools />
}

export default AdminDevToolsPage
