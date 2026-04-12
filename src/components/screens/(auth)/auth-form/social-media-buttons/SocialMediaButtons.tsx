import styles from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons.module.scss'
import FontAwesomeIcon from '@/components/ui/icons/FontAwesomeIcon'
import { useRouter } from 'next/navigation'

const SocialMediaButtons = () => {
	const router = useRouter()

	return (
		<div className={styles.wrapper}>
			<button
				onClick={() => router.push('/auth/google')}
				className={styles.button}
				type="button"
			>
				<FontAwesomeIcon name="FaGoogle" fill="currentColor" />
				<span>Google</span>
			</button>
			<button
				onClick={() => router.push('/auth/github')}
				className={styles.button}
				type="button"
			>
				<FontAwesomeIcon name="FaGithub" fill="currentColor" />
				<span>GitHub</span>
			</button>
			<button
				onClick={() => router.push('/auth/yandex')}
				className={styles.button}
				type="button"
			>
				<FontAwesomeIcon name="FaYandex" fill="currentColor" />
				<span>Яндекс</span>
			</button>
		</div>
	)
}

export default SocialMediaButtons
