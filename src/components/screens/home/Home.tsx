'use client'

import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useAuthStore } from '@/store/auth-store/auth-store'
import CtaBanner from './cta-banner/CtaBanner'
import styles from './Home.module.scss'
import HeroSection from './hero/HeroSection'
import DemoWheel from './demo-wheel/DemoWheel'
import HomeFaq from './faq/HomeFaq'
import HomePricing from './pricing/HomePricing'
import HomeSteps from './steps/HomeSteps'
import HomeTools from './tools/HomeTools'
import Analysis from './analysis/Analysis'

const Home = () => {
	const auth = useAuthStore(state => state.auth)
	const ctaHref = auth ? PUBLIC_PAGES.CABINET : PUBLIC_PAGES.REGISTER

	const scrollToFaq = () => {
		document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<div className={styles.page}>
			<DemoWheel />
			<HeroSection ctaHref={ctaHref} onScrollToFaq={scrollToFaq} />
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
