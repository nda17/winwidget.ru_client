import AdminEventLog from '@/components/screens/admin/event-log/AdminEventLog'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Журнал событий',
	description: 'Admin panel event log page'
}

const AdminEventLogPage = () => {
	return <AdminEventLog />
}

export default AdminEventLogPage
