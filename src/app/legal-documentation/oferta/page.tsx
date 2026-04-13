import Oferta from '@/components/screens/legal-documentation/oferta/Oferta'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Публичная оферта',
	description: 'Публичная оферта Winwidget.ru'
}

const OfertaPage = () => {
	return <Oferta />
}

export default OfertaPage
