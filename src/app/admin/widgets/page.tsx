import AdminWidgets from '@/components/screens/admin/widgets/AdminWidgets'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Виджеты',
	description: 'Admin panel widgets monitoring page'
}

const AdminWidgetsPage = () => {
	return <AdminWidgets />
}

export default AdminWidgetsPage
