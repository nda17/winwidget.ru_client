import { Pricing } from '@/screens/payment'
import { getHomePageContent } from '@/entities/home-page-content/server'
import { getSiteSettings } from '@/entities/site-settings/server'
import { getTariffPrices } from '@/entities/subscription/server'
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
			pricingContent={content.pricing}
			paymentEnabled={settings?.paymentEnabled ?? true}
			tariffPrices={tariffPrices}
		/>
	)
}

export default PaymentPage
