import HomeStartTrialLink from '@/components/screens/home/_components/HomeStartTrialLink'
import AppIcon from '@/components/ui/icons/AppIcon'
import type { HomePageMicroCtaContent } from '@/services/home-page-content/home-page-content.types'
import styles from './HomeMicroCta.module.scss'

interface HomeMicroCtaProps {
	text: string
	buttonText: string
	content: HomePageMicroCtaContent
}

const HomeMicroCta = ({
	text,
	buttonText,
	content
}: HomeMicroCtaProps) => {
	if (!content.enabled || !text || !buttonText) return null

	return (
		<section className={styles.section}>
			<p className={styles.text}>{text}</p>
			<HomeStartTrialLink className={styles.button}>
				{buttonText}
				<AppIcon name="navigate-next" size={18} />
			</HomeStartTrialLink>
		</section>
	)
}

export default HomeMicroCta
