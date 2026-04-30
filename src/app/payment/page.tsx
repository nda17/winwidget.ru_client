import Pricing from '@/components/screens/payment/Pricing'
import { getSiteSettings } from '@/services/site-settings/site-settings.server'
import { getTariffPrices } from '@/services/tariff-prices/tariff-prices.server'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Тарифы и оплата',
	description:
		'Тарифы Winwidget и оплата подписки через ЮKassa. Виджеты для увеличения конверсии сайта.'
}

const PaymentPage = async () => {
	const [settings, tariffPrices] = await Promise.all([
		getSiteSettings(),
		getTariffPrices()
	])
	return (
		<Pricing
			paymentEnabled={settings?.paymentEnabled ?? true}
			tariffPrices={tariffPrices}
		/>
	)
}

export default PaymentPage
