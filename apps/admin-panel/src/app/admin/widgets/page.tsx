import { AdminWidgets } from '@/screens/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Виджеты',
	description: 'Admin panel widgets monitoring page'
}

const AdminWidgetsPage = () => {
	return <AdminWidgets />
}

export default AdminWidgetsPage
