'use client'

import HomeStartTrialLink from '@/components/screens/home/_components/HomeStartTrialLink'
import styles from './HeroSection.module.scss'

const HeroActions = () => {
	const scrollToFaq = () => {
		document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<div className={styles.buttons}>
			<HomeStartTrialLink className={styles.buttonLink}>
				Попробовать бесплатно 7 дней
				<span className={styles.arrowBtn}></span>
			</HomeStartTrialLink>
			<button
				className={styles.buttonArrow}
				type="button"
				onClick={scrollToFaq}
				aria-label="Прокрутить к вопросам и ответам"
			/>
		</div>
	)
}

export default HeroActions
