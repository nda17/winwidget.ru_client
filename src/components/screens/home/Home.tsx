'use client'

import CurvedCarousel from '@/components/ui/сurved-сarousel/CurvedCarousel'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useAuthStore } from '@/store/auth-store/auth-store'
import Link from 'next/link'
import CtaBanner from './cta-banner/CtaBanner'
import DemoWheel from './demo-wheel/DemoWheel'
import HomeFaq from './faq/HomeFaq'
import styles from './Home.module.scss'
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
			<div className={styles.heroWrapper}>
				<div className={styles.heroBackground}></div>
				<div className={styles.heroFirstCircle}></div>
				<div className={styles.heroSecondCircle}></div>
				<div className={styles.heroThirdCircle}></div>
				<div className={styles.heroContent}>
					<h1 className={styles.title}>
						Увеличение конверсии
						<br /> сайта до{' '}
						<span>
							<span className={styles.titleSide}></span>30%
						</span>
						<br /> с помощью умных виджетов
					</h1>
					<p className={styles.subtitle}>
						Простая интеграция, заметный результат.
					</p>
					<div className={styles.buttons}>
						<Link href={ctaHref} className={styles.buttonLink}>
							Попробовать бесплатно 7 дней
							<span className={styles.arrowBtn}></span>
						</Link>
						<button
							className={styles.buttonArrow}
							type="button"
							onClick={scrollToFaq}
							aria-label="Scroll to FAQ"
						/>
					</div>
				</div>
			</div>
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
