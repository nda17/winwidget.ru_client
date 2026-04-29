import HomeStartTrialLink from '@/components/screens/home/_components/HomeStartTrialLink'
import type { HomePageCtaContent } from '@/services/home-page-content/home-page-content.types'
import styles from './CtaBanner.module.scss'

interface Props {
	content: HomePageCtaContent
}

const CtaBanner = ({ content }: Props) => {
	return (
		<section className={styles.section}>
			<div className={styles.inner}>
				<p className={styles.text}>
					{content.text.split('\n').map((line, index, lines) => (
						<span key={`${line}-${index}`}>
							{line}
							{index < lines.length - 1 && <br />}
						</span>
					))}
				</p>
				<HomeStartTrialLink className={styles.button}>
					{content.buttonText}
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
