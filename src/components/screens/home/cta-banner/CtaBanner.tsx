import HomeStartTrialLink from '@/components/screens/home/_components/HomeStartTrialLink'
import styles from './CtaBanner.module.scss'

const CtaBanner = () => {
	return (
		<section className={styles.section}>
			<div className={styles.inner}>
				<p className={styles.text}>
					Попробуйте сейчас
					<br />и начните получать больше заявок уже через 10 минут
				</p>
				<HomeStartTrialLink className={styles.button}>
					Начать бесплатный период
					<span className={styles.arrow}>
						<svg
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M4.5 10H15.5M15.5 10L10.5 5M15.5 10L10.5 15"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</span>
				</HomeStartTrialLink>
			</div>
		</section>
	)
}

export default CtaBanner
