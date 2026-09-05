import { AdminAffiliate } from '@/screens/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Партнёрская программа',
	description: 'Admin panel affiliate program page'
}

const AdminAffiliatePage = () => {
	return <AdminAffiliate />
}

export default AdminAffiliatePage
