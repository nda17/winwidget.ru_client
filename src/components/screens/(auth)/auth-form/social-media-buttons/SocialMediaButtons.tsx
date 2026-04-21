import styles from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons.module.scss'
import AppIcon from '@/components/ui/icons/AppIcon'
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
				<AppIcon name="google" fill="currentColor" />
				<span>Google</span>
			</button>
			<button
				onClick={() => handleSocialAuth('/auth/yandex')}
				className={styles.button}
				type="button"
			>
				<AppIcon name="yandex" fill="currentColor" />
				<span>Яндекс</span>
			</button>
			<button
				onClick={() => handleSocialAuth('/auth/github')}
				className={styles.button}
				type="button"
			>
				<AppIcon name="github" fill="currentColor" />
				<span>GitHub</span>
			</button>
		</div>
	)
}

export default SocialMediaButtons
