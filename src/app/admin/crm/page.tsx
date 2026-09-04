import { AdminCrm } from '@/screens/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'WinCRM',
	description: 'Настройки и состояние WinCRM'
}

const AdminCrmPage = () => {
	return <AdminCrm />
}

export default AdminCrmPage
