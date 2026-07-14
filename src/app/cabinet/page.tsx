import { Cabinet } from '@/screens/cabinet'
import { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
	title: 'Кабинет — Winwidget',
	description: 'Личный кабинет'
}

const CabinetPage = async () => {
	return (
		<Suspense>
			<Cabinet />
		</Suspense>
	)
}

export default CabinetPage
