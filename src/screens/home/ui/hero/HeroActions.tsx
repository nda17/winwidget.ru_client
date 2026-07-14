'use client'

import HomeStartTrialLink from '@/screens/home/ui/_components/HomeStartTrialLink'
import type { HomePageHeroContent } from '@/entities/home-page-content'
import styles from './HeroSection.module.scss'

interface Props {
	content: Pick<
		HomePageHeroContent,
		'primaryButtonText' | 'faqButtonLabel'
	>
}

const HeroActions = ({ content }: Props) => {
	const scrollToFaq = () => {
		document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
	}

	return (
		<div className={styles.buttons}>
			<HomeStartTrialLink className={styles.buttonLink}>
				{content.primaryButtonText}
				<span className={styles.arrowBtn}></span>
			</HomeStartTrialLink>
			<button
				className={styles.buttonArrow}
				type="button"
				onClick={scrollToFaq}
				aria-label={content.faqButtonLabel}
			/>
		</div>
	)
}

export default HeroActions
