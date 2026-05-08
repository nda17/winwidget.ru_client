import styles from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons.module.scss'
import AppIcon from '@/components/ui/icons/AppIcon'
import siteSettingsService from '@/services/site-settings/site-settings.service'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface SocialMediaButtonsProps {
	onTelegramAuthStart: () => void
	isTelegramAuthLoading?: boolean
}

const SocialMediaButtons = ({
	onTelegramAuthStart,
	isTelegramAuthLoading = false
}: SocialMediaButtonsProps) => {
	const router = useRouter()
	const { data: siteSettings } = useQuery({
		queryKey: ['site-settings'],
		queryFn: siteSettingsService.get
	})
	const googleAuthEnabled = siteSettings?.googleAuthEnabled ?? true
	const yandexAuthEnabled = siteSettings?.yandexAuthEnabled ?? true
	const githubAuthEnabled = siteSettings?.githubAuthEnabled ?? true
	const telegramAuthEnabled = siteSettings?.telegramAuthEnabled ?? true

	const handleSocialAuth = (path: string) => {
		toast.loading('Загрузка...', { id: 'social-auth' })
		router.push(path)
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.buttonGroup}>
				{googleAuthEnabled && (
					<button
						onClick={() => handleSocialAuth('/auth/google')}
						className={styles.button}
						type="button"
					>
						<AppIcon name="google" fill="currentColor" />
						<span>Google</span>
					</button>
				)}
				{yandexAuthEnabled && (
					<button
						onClick={() => handleSocialAuth('/auth/yandex')}
						className={styles.button}
						type="button"
					>
						<AppIcon name="yandex" fill="currentColor" />
						<span>Яндекс</span>
					</button>
				)}
			</div>
			<div className={styles.buttonGroup}>
				{telegramAuthEnabled && (
					<button
						onClick={onTelegramAuthStart}
						className={styles.button}
						type="button"
						disabled={isTelegramAuthLoading}
					>
						<AppIcon name="telegram" fill="currentColor" />
						<span>
							{isTelegramAuthLoading ? 'Открываем...' : 'Telegram'}
						</span>
					</button>
				)}
				{githubAuthEnabled && (
					<button
						onClick={() => handleSocialAuth('/auth/github')}
						className={styles.button}
						type="button"
					>
						<AppIcon name="github" fill="currentColor" />
						<span>GitHub</span>
					</button>
				)}
			</div>
		</div>
	)
}

export default SocialMediaButtons
