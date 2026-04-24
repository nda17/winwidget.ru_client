import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import Analysis from '@/components/screens/home/analysis/Analysis'
import CtaBanner from '@/components/screens/home/cta-banner/CtaBanner'
import LazyDemoWidgets from '@/components/screens/home/demo-widgets/LazyDemoWidgets'
import HomeFaq from '@/components/screens/home/faq/HomeFaq'
import HeroSection from '@/components/screens/home/hero/HeroSection'
import HomePricing from '@/components/screens/home/pricing/HomePricing'
import HomeSteps from '@/components/screens/home/steps/HomeSteps'
import HomeTools from '@/components/screens/home/tools/HomeTools'
import styles from './Home.module.scss'

const Home = () => {
	return (
		<div className={styles.page}>
			<LazyDemoWidgets />
			<HeroSection />
			<CurvedCarousel />
			<Analysis />
			<HomeTools />
			<HomeSteps />
			<HomePricing />
			<HomeFaq />
			<div className={styles.offerWrapper}>
				<div className={styles.circleOrange}></div>
				<div className={styles.circleYellow}></div>
				<div className={styles.circlePink}></div>
				<CtaBanner />
			</div>
		</div>
	)
}

export default Home
