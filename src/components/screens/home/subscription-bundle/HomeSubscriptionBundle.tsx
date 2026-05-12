import AppIcon from '@/components/ui/icons/AppIcon'
import type { HomePageSubscriptionBundleContent } from '@/services/home-page-content/home-page-content.types'
import type { AppIconName } from '@/shared/types/icon.types'
import styles from './HomeSubscriptionBundle.module.scss'

const ICONS: AppIconName[] = ['apps', 'diamond', 'payment', 'dashboard']

interface Props {
	content: HomePageSubscriptionBundleContent
}

const renderLines = (text: string) =>
	text.split('\n').map((line, index, lines) => (
		<span key={`${line}-${index}`}>
			{line}
			{index < lines.length - 1 && <br />}
		</span>
	))

const HomeSubscriptionBundle = ({ content }: Props) => {
	return (
		<section className={styles.section}>
			<div className={styles.inner}>
				<div className={styles.heading}>
					<h2 className={styles.title}>{renderLines(content.title)}</h2>
					<p className={styles.subtitle}>
						{renderLines(content.subtitle)}
					</p>
				</div>

				<div className={styles.card}>
					<div className={styles.check} aria-hidden="true">
						<svg width="34" height="34" viewBox="0 0 34 34" fill="none">
							<path
								d="M8.5 17.4L14.35 23.25L25.8 11.8"
								stroke="currentColor"
								strokeWidth="4"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<p className={styles.cardTitle}>
						{renderLines(content.cardTitle)}
					</p>
					<div className={styles.items}>
						{content.items.map((item, index) => (
							<div key={`${item.text}-${index}`} className={styles.item}>
								<div className={styles.iconShell}>
									<AppIcon
										name={ICONS[index % ICONS.length]}
										size={34}
										className={styles.icon}
									/>
								</div>
								<span className={styles.itemText}>
									{renderLines(item.text)}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}

export default HomeSubscriptionBundle
