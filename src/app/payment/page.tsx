import Pricing from '@/components/screens/payment/Pricing'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Тарифы и оплата',
	description:
		'Тарифы Winwidget: TRIAL бесплатно 7 дней, EASY от 390 ₽/мес, HARD от 790 ₽/мес. Виджеты для увеличения конверсии сайта.'
}

const PaymentPage = () => {
	return <Pricing />
}

export default PaymentPage
