import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import Analysis from '@/components/screens/home/analysis/Analysis'
import HomeAffiliate from '@/components/screens/home/affiliate/HomeAffiliate'
import CtaBanner from '@/components/screens/home/cta-banner/CtaBanner'
import LazyDemoWidgets from '@/components/screens/home/demo-widgets/LazyDemoWidgets'
import HomeFaq from '@/components/screens/home/faq/HomeFaq'
import HeroSection from '@/components/screens/home/hero/HeroSection'
import HomePricing from '@/components/screens/home/pricing/HomePricing'
import HomeSteps from '@/components/screens/home/steps/HomeSteps'
import HomeTools from '@/components/screens/home/tools/HomeTools'
import type { HomePageContent } from '@/services/home-page-content/home-page-content.types'
import type { AffiliateSettings } from '@/services/affiliate/affiliate.service'
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
			{content.tools.enabled && <HomeTools content={content.tools} />}
			{content.steps.enabled && <HomeSteps content={content.steps} />}
			{affiliateSettings?.enabled && (
				<HomeAffiliate
					cashbackPercent={affiliateSettings.cashbackPercent}
				/>
			)}
			{content.pricing.enabled && (
				<HomePricing
					content={content.pricing}
					tariffPrices={tariffPrices}
				/>
			)}
			{content.faq.enabled && <HomeFaq content={content.faq} />}
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
