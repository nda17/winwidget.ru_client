import heroBgDesktopAvif from '@/assets/images/hero/hero-bg-desktop.avif'
import heroBgDesktopWebp from '@/assets/images/hero/hero-bg-desktop.webp'
import heroBgMobileAvif from '@/assets/images/hero/hero-bg-mobile.avif'
import heroBgMobileWebp from '@/assets/images/hero/hero-bg-mobile.webp'
import HeroActions from './HeroActions'
import type { CSSProperties } from 'react'
import styles from './HeroSection.module.scss'

const HeroSection = () => {
	const heroBackgroundStyle = {
		'--hero-bg-desktop-webp': `url(${heroBgDesktopWebp.src})`,
		'--hero-bg-desktop-avif': `url(${heroBgDesktopAvif.src})`,
		'--hero-bg-mobile-webp': `url(${heroBgMobileWebp.src})`,
		'--hero-bg-mobile-avif': `url(${heroBgMobileAvif.src})`
	} as CSSProperties

	return (
		<section className={styles.heroWrapper} aria-labelledby="hero-title">
			<div
				className={styles.heroBackground}
				style={heroBackgroundStyle}
				aria-hidden="true"
			></div>
			<div className={styles.heroFirstCircle} aria-hidden="true"></div>
			<div className={styles.heroSecondCircle} aria-hidden="true"></div>
			<div className={styles.heroThirdCircle} aria-hidden="true"></div>
			<div className={styles.heroContent}>
				<h1 id="hero-title" className={styles.title}>
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
				<HeroActions />
			</div>
		</section>
	)
}

export default HeroSection
