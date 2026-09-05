import { AdminTariffs } from '@/screens/admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Тарифы',
	description: 'Admin panel page'
}

const AdminTariffsPage = () => {
	return <AdminTariffs />
}

export default AdminTariffsPage
