import AppIcon from '@/components/ui/icons/AppIcon'
import type { HomePageSubscriptionBundleContent } from '@/services/home-page-content/home-page-content.types'
import type { AppIconName } from '@/shared/types/icon.types'
import type { CSSProperties } from 'react'
import styles from './HomeSubscriptionBundle.module.scss'

const CARDS: Array<{
	icon: AppIconName
	accent: string
	glow: string
}> = [
	{
		icon: 'apps',
		accent: '#7b2fff',
		glow: 'radial-gradient(circle at 50% 0%, rgb(123 47 255 / 0.18), transparent 58%)'
	},
	{
		icon: 'diamond',
		accent: '#e05a8a',
		glow: 'radial-gradient(circle at 50% 0%, rgb(224 90 138 / 0.18), transparent 58%)'
	},
	{
		icon: 'payment',
		accent: '#2aab7a',
		glow: 'radial-gradient(circle at 50% 0%, rgb(42 171 122 / 0.18), transparent 58%)'
	},
	{
		icon: 'dashboard',
		accent: '#f0a51f',
		glow: 'radial-gradient(circle at 50% 0%, rgb(240 165 31 / 0.2), transparent 58%)'
	}
]

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
						{content.items.map((item, index) => {
							const card = CARDS[index % CARDS.length]

							return (
								<div
									key={`${item.text}-${index}`}
									className={styles.item}
									style={
										{
											'--item-accent': card.accent,
											'--item-glow': card.glow
										} as CSSProperties
									}
								>
									<div className={styles.iconShell}>
										<AppIcon
											name={card.icon}
											size={34}
											className={styles.icon}
										/>
									</div>
									<span className={styles.itemText}>
										{renderLines(item.text)}
									</span>
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</section>
	)
}

export default HomeSubscriptionBundle
