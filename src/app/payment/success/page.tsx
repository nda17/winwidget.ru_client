import PaymentSuccess from '@/components/screens/payment-success/PaymentSuccess'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Оплата принята',
	description: 'Оплата принята, подписка активируется автоматически'
}

const PaymentSuccessPage = () => {
	return <PaymentSuccess />
}

export default PaymentSuccessPage
