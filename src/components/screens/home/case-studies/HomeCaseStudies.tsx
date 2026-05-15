import HomeSectionHeader from '@/components/screens/home/_components/HomeSectionHeader'
import type { HomePageCaseStudiesContent } from '@/services/home-page-content/home-page-content.types'
import styles from './HomeCaseStudies.module.scss'

interface HomeCaseStudiesProps {
	content: HomePageCaseStudiesContent
}

const HomeCaseStudies = ({ content }: HomeCaseStudiesProps) => {
	if (!content.enabled) return null

	return (
		<section className={styles.section}>
			<HomeSectionHeader
				title={content.title}
				subtitle={content.subtitle}
			/>
			<div className={styles.caseGrid}>
				{content.items.map((item, index) => (
					<article key={`${item.title}-${index}`} className={styles.card}>
						<span className={styles.badge}>
							Сценарий {String(index + 1).padStart(2, '0')}
						</span>
						<h3 className={styles.title}>{item.title}</h3>
						<p className={styles.text}>{item.text}</p>
						<p className={styles.result}>{item.result}</p>
					</article>
				))}
			</div>
		</section>
	)
}

export default HomeCaseStudies
