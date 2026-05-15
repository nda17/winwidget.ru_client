import HomeSectionHeader from '@/components/screens/home/_components/HomeSectionHeader'
import AppIcon from '@/components/ui/icons/AppIcon'
import type { HomePageSecurityContent } from '@/services/home-page-content/home-page-content.types'
import type { AppIconName } from '@/shared/types/icon.types'
import styles from './HomeSecurity.module.scss'

const CARD_ICONS: AppIconName[] = [
	'settings',
	'payment',
	'lock',
	'dashboard',
	'star',
	'diamond'
]

interface HomeSecurityProps {
	content: HomePageSecurityContent
}

const HomeSecurity = ({ content }: HomeSecurityProps) => {
	if (!content.enabled) return null

	return (
		<section className={styles.section}>
			<HomeSectionHeader
				title={content.title}
				subtitle={content.subtitle}
			/>
			<div className={styles.securityGrid}>
				{content.items.map((item, index) => (
					<article key={`${item.title}-${index}`} className={styles.item}>
						<span className={styles.icon}>
							<AppIcon
								name={CARD_ICONS[index % CARD_ICONS.length]}
								size={22}
							/>
						</span>
						<div>
							<h3 className={styles.title}>{item.title}</h3>
							<p className={styles.text}>{item.text}</p>
						</div>
					</article>
				))}
			</div>
		</section>
	)
}

export default HomeSecurity
