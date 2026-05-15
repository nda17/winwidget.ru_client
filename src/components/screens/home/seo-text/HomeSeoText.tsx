import type { HomePageSeoTextContent } from '@/services/home-page-content/home-page-content.types'
import styles from './HomeSeoText.module.scss'

interface HomeSeoTextProps {
	content: HomePageSeoTextContent
}

const HomeSeoText = ({ content }: HomeSeoTextProps) => {
	if (!content.enabled) return null

	return (
		<section className={styles.section}>
			<h2 className={styles.title}>{content.title}</h2>
			<p className={styles.text}>{content.text}</p>
		</section>
	)
}

export default HomeSeoText
