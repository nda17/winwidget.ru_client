import Pricing from '@/components/screens/payment/Pricing'
import { getHomePageContent } from '@/services/home-page-content/home-page-content.server'
import { getSiteSettings } from '@/services/site-settings/site-settings.server'
import { getTariffPrices } from '@/services/tariff-prices/tariff-prices.server'
import { Metadata } from 'next'

export const generateMetadata = async (): Promise<Metadata> => {
	const content = await getHomePageContent()

	return {
		title: content.payment.seoTitle,
		description: content.payment.seoDescription
	}
}

const PaymentPage = async () => {
	const [settings, tariffPrices, content] = await Promise.all([
		getSiteSettings(),
		getTariffPrices(),
		getHomePageContent()
	])
	return (
		<Pricing
			content={content.payment}
			paymentEnabled={settings?.paymentEnabled ?? true}
			tariffPrices={tariffPrices}
		/>
	)
}

export default PaymentPage
