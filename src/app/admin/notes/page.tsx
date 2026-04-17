import AdminNotes from '@/components/screens/admin/notes/AdminNotes'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Заметки',
	description: 'Admin panel page'
}

const AdminNotesPage = () => {
	return <AdminNotes />
}

export default AdminNotesPage
