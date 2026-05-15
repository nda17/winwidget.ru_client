import HomeAffiliate from '@/components/screens/home/affiliate/HomeAffiliate'
import Analysis from '@/components/screens/home/analysis/Analysis'
import HomeAudiences from '@/components/screens/home/audiences/HomeAudiences'
import HomeCaseStudies from '@/components/screens/home/case-studies/HomeCaseStudies'
import CtaBanner from '@/components/screens/home/cta-banner/CtaBanner'
import HomeCustomization from '@/components/screens/home/customization/HomeCustomization'
import HomeDashboardPreview from '@/components/screens/home/dashboard-preview/HomeDashboardPreview'
import LazyDemoWidgets from '@/components/screens/home/demo-widgets/LazyDemoWidgets'
import HomeDirectLink from '@/components/screens/home/direct-link/HomeDirectLink'
import HomeFaq from '@/components/screens/home/faq/HomeFaq'
import HeroSection from '@/components/screens/home/hero/HeroSection'
import HomeLeadFlow from '@/components/screens/home/lead-flow/HomeLeadFlow'
import HomeMicroCta from '@/components/screens/home/micro-cta/HomeMicroCta'
import HomePricing from '@/components/screens/home/pricing/HomePricing'
import HomeSecurity from '@/components/screens/home/security/HomeSecurity'
import HomeSeoText from '@/components/screens/home/seo-text/HomeSeoText'
import HomeSteps from '@/components/screens/home/steps/HomeSteps'
import HomeSubscriptionBundle from '@/components/screens/home/subscription-bundle/HomeSubscriptionBundle'
import HomeTariffComparison from '@/components/screens/home/tariff-comparison/HomeTariffComparison'
import HomeTools from '@/components/screens/home/tools/HomeTools'
import HomeWhyWidgets from '@/components/screens/home/why-widgets/HomeWhyWidgets'
import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import type { AffiliateSettings } from '@/services/affiliate/affiliate.service'
import type { HomePageContent } from '@/services/home-page-content/home-page-content.types'
import type { TariffPrice } from '@/services/tariff-prices/tariff-prices.types'
import styles from './Home.module.scss'

interface Props {
	content: HomePageContent
	tariffPrices?: TariffPrice[] | null
	affiliateSettings?: AffiliateSettings | null
}

const Home = ({
	content,
	tariffPrices = null,
	affiliateSettings = null
}: Props) => {
	return (
		<div className={styles.page}>
			{content.demoWidgets.enabled && (
				<LazyDemoWidgets content={content.demoWidgets} />
			)}
			<HeroSection content={content.hero} />
			{content.integrations.enabled && (
				<CurvedCarousel content={content.integrations} />
			)}
			{content.analysis.enabled && <Analysis content={content.analysis} />}
			<HomeMicroCta
				content={content.microCta}
				text={content.microCta.afterIntegrationsText}
				buttonText={content.microCta.afterIntegrationsButtonText}
			/>
			<HomeAudiences content={content.audiences} />
			<HomeCaseStudies content={content.caseStudies} />
			<HomeWhyWidgets content={content.whyWidgets} />
			<HomeLeadFlow content={content.leadFlow} />
			{content.tools.enabled && <HomeTools content={content.tools} />}
			{content.customization.enabled && (
				<HomeCustomization content={content.customization} />
			)}
			{content.steps.enabled && <HomeSteps content={content.steps} />}
			<HomeMicroCta
				content={content.microCta}
				text={content.microCta.afterStepsText}
				buttonText={content.microCta.afterStepsButtonText}
			/>
			<HomeDashboardPreview content={content.dashboardPreview} />
			<HomeDirectLink content={content.directLink} />
			<HomeSecurity content={content.security} />
			{affiliateSettings?.enabled && (
				<HomeAffiliate
					cashbackPercent={affiliateSettings.cashbackPercent}
				/>
			)}
			{content.subscriptionBundle.enabled && (
				<HomeSubscriptionBundle content={content.subscriptionBundle} />
			)}
			<HomeTariffComparison content={content.tariffComparison} />
			{content.pricing.enabled && (
				<HomePricing
					content={content.pricing}
					tariffPrices={tariffPrices}
				/>
			)}
			{content.faq.enabled && <HomeFaq content={content.faq} />}
			<HomeSeoText content={content.seoText} />
			{content.cta.enabled && (
				<div className={styles.offerWrapper}>
					<div className={styles.circleOrange}></div>
					<div className={styles.circleYellow}></div>
					<div className={styles.circlePink}></div>
					<CtaBanner content={content.cta} />
				</div>
			)}
		</div>
	)
}

export default Home
