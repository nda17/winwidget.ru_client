import styles from './HomeSteps.module.scss'

const HomeSteps = () => {
	return (
		<section className={styles.section}>
			<h2 className={styles.title}>Установка проще, чем сварить кофе..</h2>

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
					<p className={styles.text}>
						Настройте дизайн и логику виджета в личном кабинете
					</p>
					<span className={styles.num} style={{ color: '#e05a8a' }}>
						{String(1).padStart(2, '0')}
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
					<span className={styles.cardSecond}></span>
					<p className={styles.text}>Скопируйте одну строчку кода</p>
					<span className={styles.num} style={{ color: '#7b5ce5' }}>
						{String(2).padStart(2, '0')}
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
					<span className={styles.cardThird}></span>
					<p className={styles.text}>Вставьте в код своего сайта</p>
					<span className={styles.num} style={{ color: '#3a8fd4' }}>
						{String(3).padStart(2, '0')}
					</span>
				</div>

				<div className={styles.cardResult}>
					<span className={styles.iconHeart}></span>
					<p className={styles.resultText}>
						Ловите
						<br />
						горячие
						<br />
						лиды!
					</p>
				</div>
			</div>
		</section>
	)
}

export default HomeSteps
