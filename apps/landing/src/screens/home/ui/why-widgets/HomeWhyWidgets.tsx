import HomeSectionHeader from '@/screens/home/ui/_components/HomeSectionHeader'
import type { HomePageWhyWidgetsContent } from '@/entities/home-page-content'
import styles from './HomeWhyWidgets.module.scss'

interface HomeWhyWidgetsProps {
	content: HomePageWhyWidgetsContent
}

const HomeWhyWidgets = ({ content }: HomeWhyWidgetsProps) => {
	if (!content.enabled) return null

	return (
		<section className={styles.section}>
			<HomeSectionHeader
				title={content.title}
				subtitle={content.subtitle}
			/>
			<div className={styles.cards}>
				<article className={styles.cardMuted}>
					<h3 className={styles.title}>{content.formTitle}</h3>
					<ul className={styles.list}>
						{content.formItems.map((item, index) => (
							<li key={`${item.text}-${index}`}>{item.text}</li>
						))}
					</ul>
				</article>
				<article className={styles.cardAccent}>
					<h3 className={styles.title}>{content.widgetTitle}</h3>
					<ul className={styles.list}>
						{content.widgetItems.map((item, index) => (
							<li key={`${item.text}-${index}`}>{item.text}</li>
						))}
					</ul>
				</article>
			</div>
		</section>
	)
}

export default HomeWhyWidgets
