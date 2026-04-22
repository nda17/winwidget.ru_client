import clsx from 'clsx'
import styles from './HomeSteps.module.scss'

const STEPS = [
	{
		num: 1,
		text: 'Настройте дизайн и логику виджета в личном кабинете',
		accent: '#e05a8a',
		border: 'linear-gradient(135deg, #f7a8c4, #e05a8a)',
		glow: 'radial-gradient(circle at top left, rgb(224 90 138 / 0.22), transparent 58%)',
		iconClass: 'cardFirst'
	},
	{
		num: 2,
		text: 'Скопируйте одну строчку кода',
		accent: '#7b5ce5',
		border: 'linear-gradient(135deg, #c4b0f7, #7b5ce5)',
		glow: 'radial-gradient(circle at top left, rgb(123 92 229 / 0.22), transparent 58%)',
		iconClass: 'cardSecond'
	},
	{
		num: 3,
		text: 'Вставьте в код своего сайта',
		accent: '#3a8fd4',
		border: 'linear-gradient(135deg, #a8d4f7, #3a8fd4)',
		glow: 'radial-gradient(circle at top left, rgb(58 143 212 / 0.2), transparent 58%)',
		iconClass: 'cardThird'
	}
]

const HomeSteps = () => {
	return (
		<section className={styles.section}>
			<h2 className={styles.title}>Установка проще, чем сварить кофе..</h2>

			<div className={styles.gridLayout}>
				{STEPS.map(step => (
					<div
						key={step.num}
						className={styles.card}
						style={
							{
								'--border-gradient': step.border,
								'--card-accent': step.accent,
								'--card-glow': step.glow
							} as React.CSSProperties
						}
					>
						<div className={styles.cardSurface}>
							<div className={styles.cardTop}>
								<div className={styles.iconShell}>
									<span
										className={clsx(
											styles.cardIcon,
											styles[step.iconClass as keyof typeof styles]
										)}
									></span>
								</div>
								<span className={styles.cardBadge}>
									Шаг {String(step.num).padStart(2, '0')}
								</span>
							</div>

							<p className={styles.text}>{step.text}</p>

							<span className={styles.num}>
								{String(step.num).padStart(2, '0')}
							</span>
						</div>
					</div>
				))}

				<div className={styles.cardResult}>
					<div className={styles.resultInner}>
						<div className={styles.resultTop}>
							<span className={styles.resultBadge}>Результат</span>
							<span className={styles.iconHeart}></span>
						</div>
						<p className={styles.resultText}>
							Ловите
							<br />
							горячие
							<br />
							лиды!
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}

export default HomeSteps
