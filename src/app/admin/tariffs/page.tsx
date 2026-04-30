import AdminTariffs from '@/components/screens/admin/tariffs/AdminTariffs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Тарифы',
	description: 'Admin panel page'
}

const AdminTariffsPage = () => {
	return <AdminTariffs />
}

export default AdminTariffsPage
