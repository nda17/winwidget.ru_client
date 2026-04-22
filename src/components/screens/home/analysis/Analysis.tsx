import clsx from 'clsx'
import styles from './Analysis.module.scss'

const CARDS = [
	{
		num: 1,
		text: 'Собираются уйти',
		accent: '#e05a8a',
		border: 'linear-gradient(135deg, #f7a8c4, #e05a8a)',
		glow: 'radial-gradient(circle at top left, rgb(224 90 138 / 0.22), transparent 58%)',
		iconClass: 'cardFirst'
	},
	{
		num: 2,
		text: 'Долго листают страницу',
		accent: '#3a8fd4',
		border: 'linear-gradient(135deg, #a8d4f7, #3a8fd4)',
		glow: 'radial-gradient(circle at top left, rgb(58 143 212 / 0.2), transparent 58%)',
		iconClass: 'cardSecond'
	},
	{
		num: 3,
		text: 'Сравнивают с конкурентами',
		accent: '#2aab7a',
		border: 'linear-gradient(135deg, #a8f0d4, #2aab7a)',
		glow: 'radial-gradient(circle at top left, rgb(42 171 122 / 0.2), transparent 58%)',
		iconClass: 'cardThird'
	},
	{
		num: 4,
		text: 'Хотят быстрой связи',
		accent: '#7b5ce5',
		border: 'linear-gradient(135deg, #c4b0f7, #7b5ce5)',
		glow: 'radial-gradient(circle at top left, rgb(123 92 229 / 0.2), transparent 58%)',
		iconClass: 'cardFour'
	}
]

const Analysis = () => {
	return (
		<section className={styles.section}>
			<span className={styles.titleWrapper}>
				<h2 className={styles.title}>
					98% посетителей уходят с вашего сайта навсегда, не оставив
					контактов
				</h2>
				<h3 className={styles.subtitle}>
					Вы платите за рекламу, SEO и контент, но клиенты молча закрывают
					вкладку. Мы поможем их «зацепить», когда они:
				</h3>
			</span>

			<div className={styles.gridLayout}>
				{CARDS.map(card => (
					<div
						key={card.num}
						className={styles.card}
						style={
							{
								'--border-gradient': card.border,
								'--card-accent': card.accent,
								'--card-glow': card.glow
							} as React.CSSProperties
						}
					>
						<div className={styles.cardSurface}>
							<div className={styles.cardTop}>
								<div className={styles.iconShell}>
									<span
										className={clsx(
											styles.cardIcon,
											styles[card.iconClass as keyof typeof styles]
										)}
									></span>
								</div>
								<span className={styles.cardBadge}>
									Сценарий {String(card.num).padStart(2, '0')}
								</span>
							</div>

							<p className={styles.text}>{card.text}</p>

							<span className={styles.num}>
								{String(card.num).padStart(2, '0')}
							</span>
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

export default Analysis
