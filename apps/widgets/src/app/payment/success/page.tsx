import { PaymentSuccess } from '@/screens/payment'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Статус оплаты',
	description: 'Проверка статуса оплаты и активации подписки'
}

const PaymentSuccessPage = () => {
	return <PaymentSuccess />
}

export default PaymentSuccessPage
