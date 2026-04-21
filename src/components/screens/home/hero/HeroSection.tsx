import heroBgDesktopAvif from '@/assets/images/hero/hero-bg-desktop.avif'
import heroBgDesktopWebp from '@/assets/images/hero/hero-bg-desktop.webp'
import heroBgMobileAvif from '@/assets/images/hero/hero-bg-mobile.avif'
import heroBgMobileWebp from '@/assets/images/hero/hero-bg-mobile.webp'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import styles from './HeroSection.module.scss'

interface IHeroSectionProps {
	ctaHref: string
	onScrollToFaq: () => void
}

const HeroSection = ({ ctaHref, onScrollToFaq }: IHeroSectionProps) => {
	const heroBackgroundStyle = {
		'--hero-bg-desktop-webp': `url(${heroBgDesktopWebp.src})`,
		'--hero-bg-desktop-avif': `url(${heroBgDesktopAvif.src})`,
		'--hero-bg-mobile-webp': `url(${heroBgMobileWebp.src})`,
		'--hero-bg-mobile-avif': `url(${heroBgMobileAvif.src})`
	} as CSSProperties

	return (
		<div className={styles.heroWrapper}>
			<div
				className={styles.heroBackground}
				style={heroBackgroundStyle}
			></div>
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
						onClick={onScrollToFaq}
						aria-label="Scroll to FAQ"
					/>
				</div>
			</div>
		</div>
	)
}

export default HeroSection
