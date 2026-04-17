import styles from './HomeSteps.module.scss'

const STEPS = [
	{
		num: 1,
		text: 'Настройте дизайн и логику виджета в личном кабинете',
		accent: '#e05a8a',
		border: 'linear-gradient(135deg, #f7a8c4, #e05a8a)',
		iconBg: 'linear-gradient(135deg, #fce4ee, #f7a8c4)',
		icon: (
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
					stroke="#e05a8a"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
					stroke="#e05a8a"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		)
	},
	{
		num: 2,
		text: 'Скопируйте одну строчку кода',
		accent: '#7b5ce5',
		border: 'linear-gradient(135deg, #c4b0f7, #7b5ce5)',
		iconBg: 'linear-gradient(135deg, #ede8fc, #c4b0f7)',
		icon: (
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect
					x="9"
					y="9"
					width="13"
					height="13"
					rx="2"
					stroke="#7b5ce5"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
					stroke="#7b5ce5"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		)
	},
	{
		num: 3,
		text: 'Вставьте в код своего сайта',
		accent: '#3a8fd4',
		border: 'linear-gradient(135deg, #a8d4f7, #3a8fd4)',
		iconBg: 'linear-gradient(135deg, #deeefb, #a8d4f7)',
		icon: (
			<svg
				width="28"
				height="28"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle
					cx="12"
					cy="12"
					r="10"
					stroke="#3a8fd4"
					strokeWidth="1.6"
				/>
				<path
					d="M12 8v4m0 4h.01"
					stroke="#3a8fd4"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			</svg>
		)
	}
]

const HomeSteps = () => {
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

			<div className={styles.grid}>
				{STEPS.map(step => (
					<div
						key={step.num}
						className={styles.card}
						style={
							{ '--border-gradient': step.border } as React.CSSProperties
						}
					>
						<div
							className={styles.iconWrap}
							style={{ background: step.iconBg }}
						>
							{step.icon}
						</div>
						<p className={styles.text}>{step.text}</p>
						<span className={styles.num} style={{ color: step.accent }}>
							{String(step.num).padStart(2, '0')}
						</span>
					</div>
				))}

				<div className={styles.cardResult}>
					<div className={styles.resultHeart} aria-hidden="true">
						<svg
							width="90"
							height="90"
							viewBox="0 0 90 90"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M45 75S10 52 10 30a18 18 0 0 1 35-6 18 18 0 0 1 35 6c0 22-35 45-35 45Z"
								fill="rgb(255 255 255 / 0.15)"
							/>
						</svg>
					</div>
					<div className={styles.resultHeartSmall} aria-hidden="true">
						<svg
							width="50"
							height="50"
							viewBox="0 0 90 90"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M45 75S10 52 10 30a18 18 0 0 1 35-6 18 18 0 0 1 35 6c0 22-35 45-35 45Z"
								fill="rgb(255 255 255 / 0.12)"
							/>
						</svg>
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
		</section>
	)
}

export default HomeSteps
