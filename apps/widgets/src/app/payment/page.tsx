import { Pricing } from '@/screens/payment'
import { getHomePageContent } from '@/entities/home-page-content/server'
import { getBillingPublicSettings } from '@/entities/billing-settings/server'
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
	const [billingSettings, tariffPrices, content] = await Promise.all([
		getBillingPublicSettings(),
		getTariffPrices(),
		getHomePageContent()
	])
	return (
		<Pricing
			pricingContent={content.pricing}
			paymentEnabled={billingSettings?.paymentEnabled ?? false}
			autoRenewalSignupEnabled={
				billingSettings?.autoRenewalSignupEnabled ?? false
			}
			autoRenewalTerms={billingSettings?.autoRenewalTerms ?? null}
			tariffPrices={tariffPrices}
		/>
	)
}

export default PaymentPage
