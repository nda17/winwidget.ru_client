import styles from '@/components/screens/premium-content/PremiumContent.module.scss'
import Heading from '@/components/ui/heading/Heading'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { NextPage } from 'next'
import Link from 'next/link'

const PremiumContent: NextPage = () => {
	// В реальном проекте здесь будет запрос к серверу и генерация списка на основе полученных данных.

	return (
		<div className={styles.wrapper}>
			<Heading text="Страница для пользователей с активной Premium-подпиской" />

			<div className={styles.text}>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=1`}
					className={styles.link}
				>
					Премиум-материал № 1
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=2`}
					className={styles.link}
				>
					Премиум-материал № 2
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=3`}
					className={styles.link}
				>
					Премиум-материал № 3
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=4`}
					className={styles.link}
				>
					Премиум-материал № 4
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=5`}
					className={styles.link}
				>
					Премиум-материал № 5
				</Link>
			</div>
		</div>
	)
}

export default PremiumContent
