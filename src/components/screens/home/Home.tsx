'use client'

import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import Analysis from '@/components/screens/home/analysis/Analysis'
import CtaBanner from '@/components/screens/home/cta-banner/CtaBanner'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import DemoWheel from '@/components/screens/home/demo-wheel/DemoWheel'
import HomeFaq from '@/components/screens/home/faq/HomeFaq'
import HeroSection from '@/components/screens/home/hero/HeroSection'
import HomePricing from '@/components/screens/home/pricing/HomePricing'
import HomeSteps from '@/components/screens/home/steps/HomeSteps'
import HomeTools from '@/components/screens/home/tools/HomeTools'
import { useAuthStore } from '@/store/auth-store/auth-store'
import styles from './Home.module.scss'

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
