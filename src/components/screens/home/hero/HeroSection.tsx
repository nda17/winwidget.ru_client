import Link from 'next/link'
import styles from './HeroSection.module.scss'

interface IHeroSectionProps {
	ctaHref: string
	onScrollToFaq: () => void
}

const HeroSection = ({ ctaHref, onScrollToFaq }: IHeroSectionProps) => {
	return (
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
						onClick={onScrollToFaq}
						aria-label="Scroll to FAQ"
					/>
				</div>
			</div>
		</div>
	)
}

export default HeroSection
