'use client'

import styles from '@/components/screens/cabinet/Cabinet.module.scss'
import CabinetProfile from '@/components/screens/cabinet/CabinetProfile'
import CabinetWidgets from '@/components/screens/cabinet/CabinetWidgets'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import useUser from '@/hooks/useUser'
import widgetService from '@/services/widget/widget.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { FC, useState } from 'react'

type Tab = 'widgets' | 'profile'

const planLabel: Record<string, string> = {
	TRIAL: 'Тест-драйв',
	EASY: 'Easy',
	HARD: 'Hard'
}

const Cabinet: FC = () => {
	const searchParams = useSearchParams()
	const initialTab: Tab =
		searchParams.get('tab') === 'profile' ? 'profile' : 'widgets'
	const [tab, setTab] = useState<Tab>(initialTab)
	const auth = useAuthStore(state => state.auth)
	const { user, isLoading } = useUser()

	const { data } = useQuery({
		queryKey: ['widgets'],
		queryFn: widgetService.getMyWidgets,
		enabled: auth
	})

	const subscription = data?.subscription
	const planName = subscription
		? planLabel[subscription.plan] || subscription.plan
		: null

	const displayName =
		user?.name || user?.email || user?.phone || 'Пользователь'
	const displaySub = user?.email || user?.phone || ''

	return (
		<div className={styles.cabinet}>
			{/* ── User header ─────────────────────────────────────── */}
			<div className={styles.userHeader}>
				{isLoading ? (
					<div className="w-[52px] h-[52px] flex-shrink-0">
						<SkeletonLoader count={1} circle className="w-full h-full" />
					</div>
				) : (
					<Image
						src={
							user?.avatarPath || '/uploads/user-avatar/avatar-default.png'
						}
						alt={displayName}
						width={52}
						height={52}
						className={styles.avatarImg}
					/>
				)}
				<div className={styles.headerInfo}>
					{isLoading ? (
						<div className="flex flex-col gap-2">
							<div className="h-5 w-[10rem]">
								<SkeletonLoader count={1} className="w-full h-full" />
							</div>
							<div className="h-4 w-[7rem]">
								<SkeletonLoader count={1} className="w-full h-full" />
							</div>
							<div className="h-5 w-[4rem]">
								<SkeletonLoader count={1} className="w-full h-full" />
							</div>
						</div>
					) : (
						<>
							<p className={styles.headerName}>{displayName}</p>
							{displaySub && (
								<p className={styles.headerSub}>{displaySub}</p>
							)}
							{planName && (
								<span className={styles.planBadge}>{planName}</span>
							)}
							{subscription?.expiresAt &&
								subscription.plan !== 'TRIAL' && (
									<p className={styles.planExpires}>
										до{' '}
										{new Date(subscription.expiresAt).toLocaleDateString(
											'ru-RU'
										)}
									</p>
								)}
						</>
					)}
				</div>
			</div>

			{/* ── Tabs ────────────────────────────────────────────── */}
			<div className={styles.tabs}>
				<button
					className={`${styles.tab} ${tab === 'widgets' ? styles.tabActive : ''}`}
					onClick={() => setTab('widgets')}
				>
					Виджеты
				</button>
				<button
					className={`${styles.tab} ${tab === 'profile' ? styles.tabActive : ''}`}
					onClick={() => setTab('profile')}
				>
					Профиль
				</button>
			</div>

			{/* ── Content ─────────────────────────────────────────── */}
			<div className={styles.content}>
				{tab === 'widgets' ? <CabinetWidgets /> : <CabinetProfile />}
			</div>
		</div>
	)
}

export default Cabinet
