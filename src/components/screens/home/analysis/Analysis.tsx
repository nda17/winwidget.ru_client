import styles from './Analysis.module.scss'

const CARDS = [
	{
		num: 1,
		text: 'Собираются уйти',
		accent: '#e05a8a',
		border: 'linear-gradient(135deg, #f7a8c4, #e05a8a)'
	},
	{
		num: 2,
		text: 'Долго листают страницу',
		accent: '#3a8fd4',
		border: 'linear-gradient(135deg, #a8d4f7, #3a8fd4)'
	},
	{
		num: 3,
		text: 'Сравнивают с конкурентами',
		accent: '#2aab7a',
		border: 'linear-gradient(135deg, #a8f0d4, #2aab7a)'
	},
	{
		num: 4,
		text: 'Хотят быстрой связи',
		accent: '#7b5ce5',
		border: 'linear-gradient(135deg, #c4b0f7, #7b5ce5)'
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
				<div
					className={styles.card}
					style={
						{
							'--border-gradient':
								'linear-gradient(135deg, #f7a8c4, #e05a8a)'
						} as React.CSSProperties
					}
				>
					<span className={styles.cardFirst}></span>
					<p className={styles.text}>Собираются уйти</p>
					<span className={styles.num} style={{ color: '#e05a8a' }}>
						{String(1).padStart(2, '0')}
					</span>
				</div>

				<div
					className={styles.card}
					style={
						{
							'--border-gradient':
								'linear-gradient(135deg, #a8d4f7, #3a8fd4)'
						} as React.CSSProperties
					}
				>
					<span className={styles.cardSecond}></span>
					<p className={styles.text}>Долго листают страницу</p>
					<span className={styles.num} style={{ color: '#3a8fd4' }}>
						{String(2).padStart(2, '0')}
					</span>
				</div>

				<div
					className={styles.card}
					style={
						{
							'--border-gradient':
								'linear-gradient(135deg, #a8f0d4, #2aab7a)'
						} as React.CSSProperties
					}
				>
					<span className={styles.cardThird}></span>
					<p className={styles.text}>Сравнивают с конкурентами</p>
					<span className={styles.num} style={{ color: '#2aab7a' }}>
						{String(3).padStart(2, '0')}
					</span>
				</div>

				<div
					className={styles.card}
					style={
						{
							'--border-gradient':
								'linear-gradient(135deg, #c4b0f7, #7b5ce5)'
						} as React.CSSProperties
					}
				>
					<span className={styles.cardFour}></span>
					<p className={styles.text}>Хотят быстрой связи</p>
					<span className={styles.num} style={{ color: '#7b5ce5' }}>
						{String(4).padStart(2, '0')}
					</span>
				</div>
			</div>
		</section>
	)
}

export default Analysis
