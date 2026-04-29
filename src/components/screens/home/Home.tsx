import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import Analysis from '@/components/screens/home/analysis/Analysis'
import CtaBanner from '@/components/screens/home/cta-banner/CtaBanner'
import LazyDemoWidgets from '@/components/screens/home/demo-widgets/LazyDemoWidgets'
import HomeFaq from '@/components/screens/home/faq/HomeFaq'
import HeroSection from '@/components/screens/home/hero/HeroSection'
import HomePricing from '@/components/screens/home/pricing/HomePricing'
import HomeSteps from '@/components/screens/home/steps/HomeSteps'
import HomeTools from '@/components/screens/home/tools/HomeTools'
import type { HomePageContent } from '@/services/home-page-content/home-page-content.types'
import styles from './Home.module.scss'

interface Props {
	content: HomePageContent
}

const Home = ({ content }: Props) => {
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
			{content.pricing.enabled && (
				<HomePricing content={content.pricing} />
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
