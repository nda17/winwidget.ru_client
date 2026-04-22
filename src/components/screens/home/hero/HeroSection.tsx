import heroBgDesktopAvif from '@/assets/images/hero/hero-bg-desktop.avif'
import heroBgDesktopWebp from '@/assets/images/hero/hero-bg-desktop.webp'
import heroBgMobileAvif from '@/assets/images/hero/hero-bg-mobile.avif'
import heroBgMobileWebp from '@/assets/images/hero/hero-bg-mobile.webp'
import { getImageProps } from 'next/image'
import HeroActions from './HeroActions'
import styles from './HeroSection.module.scss'

const HeroSection = () => {
	const commonImageProps = {
		alt: '',
		sizes: '100vw',
		loading: 'eager' as const
	}

	const {
		props: { srcSet: desktopAvifSrcSet }
	} = getImageProps({
		...commonImageProps,
		src: heroBgDesktopAvif
	})

	const {
		props: { srcSet: desktopWebpSrcSet, ...desktopImageProps }
	} = getImageProps({
		...commonImageProps,
		src: heroBgDesktopWebp
	})

	const {
		props: { srcSet: mobileAvifSrcSet }
	} = getImageProps({
		...commonImageProps,
		src: heroBgMobileAvif
	})

	const {
		props: { srcSet: mobileWebpSrcSet, sizes: mobileSizes }
	} = getImageProps({
		...commonImageProps,
		src: heroBgMobileWebp
	})

	return (
		<section className={styles.heroWrapper} aria-labelledby="hero-title">
			<div className={styles.heroBackground} aria-hidden="true">
				<picture className={styles.heroBackgroundPicture}>
					<source
						media="(max-width: 767px)"
						srcSet={mobileAvifSrcSet}
						sizes={mobileSizes}
						type="image/avif"
					/>
					<source
						media="(max-width: 767px)"
						srcSet={mobileWebpSrcSet}
						sizes={mobileSizes}
						type="image/webp"
					/>
					<source
						media="(min-width: 768px)"
						srcSet={desktopAvifSrcSet}
						sizes={desktopImageProps.sizes}
						type="image/avif"
					/>
					<source
						media="(min-width: 768px)"
						srcSet={desktopWebpSrcSet}
						sizes={desktopImageProps.sizes}
						type="image/webp"
					/>
					<img
						{...desktopImageProps}
						alt=""
						fetchPriority="high"
						decoding="async"
						aria-hidden="true"
						className={styles.heroBackgroundImage}
					/>
				</picture>
			</div>
			<div className={styles.heroFirstCircle} aria-hidden="true"></div>
			<div className={styles.heroSecondCircle} aria-hidden="true"></div>
			<div className={styles.heroThirdCircle} aria-hidden="true"></div>
			<div className={styles.heroContent}>
				<h1 id="hero-title" className={styles.title}>
					Увеличение конверсии
					<br /> сайта до{' '}
					<span className={styles.percentWrapper}>
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
