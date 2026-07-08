import styles from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons.module.scss'
import AppIcon from '@/components/ui/icons/AppIcon'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import siteSettingsService from '@/services/site-settings/site-settings.service'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const AFFILIATE_REFERRER_STORAGE_KEY = 'affiliateReferrerId'
const SOCIAL_AUTH_SKELETON_ITEMS = [0, 1]

interface SocialMediaButtonsProps {
	onTelegramAuthStart: () => void
	isTelegramAuthLoading?: boolean
}

const SocialMediaButtons = ({
	onTelegramAuthStart,
	isTelegramAuthLoading = false
}: SocialMediaButtonsProps) => {
	const router = useRouter()
	const { data: siteSettings, isPending: isSiteSettingsPending } =
		useQuery({
			queryKey: ['site-settings'],
			queryFn: siteSettingsService.get
		})
	const googleAuthEnabled = Boolean(siteSettings?.googleAuthEnabled)
	const yandexAuthEnabled = Boolean(siteSettings?.yandexAuthEnabled)
	const githubAuthEnabled = Boolean(siteSettings?.githubAuthEnabled)
	const vkAuthEnabled = Boolean(siteSettings?.vkAuthEnabled)
	const telegramAuthEnabled = Boolean(siteSettings?.telegramAuthEnabled)
	const hasSocialAuthButtons =
		googleAuthEnabled ||
		yandexAuthEnabled ||
		telegramAuthEnabled ||
		vkAuthEnabled ||
		githubAuthEnabled

	const handleSocialAuth = (path: string) => {
		const referrerId =
			typeof window !== 'undefined'
				? window.localStorage
						.getItem(AFFILIATE_REFERRER_STORAGE_KEY)
						?.trim()
				: ''
		const targetPath = referrerId
			? `${path}?${new URLSearchParams({ ref: referrerId })}`
			: path

		toast.loading('Загрузка...', { id: 'social-auth' })
		router.push(targetPath)
	}

	if (isSiteSettingsPending) {
		return (
			<>
				<div className={styles.sectionDivider}>
					<span>или продолжить через</span>
				</div>
				<div
					className={styles.wrapper}
					aria-busy="true"
					aria-label="Загрузка способов входа"
				>
					{SOCIAL_AUTH_SKELETON_ITEMS.map(item => (
						<SkeletonLoader
							key={item}
							containerClassName={styles.skeletonButtonWrapper}
							className={styles.skeletonButton}
						/>
					))}
				</div>
			</>
		)
	}

	if (!hasSocialAuthButtons) return null

	return (
		<>
			<div className={styles.sectionDivider}>
				<span>или продолжить через</span>
			</div>
			<div className={styles.wrapper}>
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
				{telegramAuthEnabled && (
					<button
						onClick={onTelegramAuthStart}
						className={styles.button}
						type="button"
						disabled={isTelegramAuthLoading}
					>
						<AppIcon name="telegram" fill="currentColor" />
						<span>{isTelegramAuthLoading ? 'Ждём...' : 'Telegram'}</span>
					</button>
				)}
				{vkAuthEnabled && (
					<button
						onClick={() => handleSocialAuth('/auth/vk')}
						className={styles.button}
						type="button"
					>
						<AppIcon name="vk" fill="currentColor" />
						<span>VK</span>
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
		</>
	)
}

export default SocialMediaButtons
