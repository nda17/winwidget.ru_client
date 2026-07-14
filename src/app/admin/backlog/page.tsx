import { AdminNotes } from '@/screens/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Бэклог',
	description: 'Admin panel page'
}

const AdminBacklogPage = () => {
	return <AdminNotes />
}

export default AdminBacklogPage
