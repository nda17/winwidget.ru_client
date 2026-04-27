import AdminNotes from '@/components/screens/admin/notes/AdminNotes'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Бэклог',
	description: 'Admin panel page'
}

const AdminBacklogPage = () => {
	return <AdminNotes />
}

export default AdminBacklogPage
