import styles from '@/components/screens/premium-content/PremiumContent.module.scss'
import Heading from '@/components/ui/heading/Heading'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { NextPage } from 'next'
import Link from 'next/link'

const PremiumContent: NextPage = () => {
	// В реальном проекте здесь будет запрос к серверу и генерация списка на основе полученных данных.

	return (
		<div className={styles.wrapper}>
			<Heading text="Платный Premium контент" />

			<div className={styles.text}>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=1`}
					className={styles.link}
				>
					Премиум-контент
				</Link>
			</div>
		</div>
	)
}

export default PremiumContent
