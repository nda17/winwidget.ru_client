import styles from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons.module.scss'
import FontAwesomeIcon from '@/components/ui/icons/FontAwesomeIcon'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const SocialMediaButtons = () => {
	const router = useRouter()

	const handleSocialAuth = (path: string) => {
		toast.loading('Загрузка...', { id: 'social-auth' })
		router.push(path)
	}

	return (
		<div className={styles.wrapper}>
			<button
				onClick={() => handleSocialAuth('/auth/google')}
				className={styles.button}
				type="button"
			>
				<FontAwesomeIcon name="FaGoogle" fill="currentColor" />
				<span>Google</span>
			</button>
			<button
				onClick={() => handleSocialAuth('/auth/yandex')}
				className={styles.button}
				type="button"
			>
				<FontAwesomeIcon name="FaYandex" fill="currentColor" />
				<span>Яндекс</span>
			</button>
			<button
				onClick={() => handleSocialAuth('/auth/github')}
				className={styles.button}
				type="button"
			>
				<FontAwesomeIcon name="FaGithub" fill="currentColor" />
				<span>GitHub</span>
			</button>
		</div>
	)
}

export default SocialMediaButtons
