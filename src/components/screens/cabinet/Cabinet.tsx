'use client'

import styles from '@/components/screens/cabinet/Cabinet.module.scss'
import CabinetAffiliate from '@/components/screens/cabinet/CabinetAffiliate'
import CabinetProfile from '@/components/screens/cabinet/CabinetProfile'
import CabinetWidgets from '@/components/screens/cabinet/CabinetWidgets'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import useUser from '@/hooks/useUser'
import affiliateService from '@/services/affiliate/affiliate.service'
import widgetService from '@/services/widget/widget.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { FC, useEffect, useState } from 'react'

type Tab = 'widgets' | 'profile' | 'affiliate'

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
	const { data: affiliateSettings } = useQuery({
		queryKey: ['affiliate-public-settings'],
		queryFn: affiliateService.getPublicSettings,
		enabled: auth
	})

	const subscription = data?.subscription
	const isAffiliateEnabled = Boolean(affiliateSettings?.enabled)
	const planName = subscription
		? planLabel[subscription.plan] || subscription.plan
		: null

	const displayName = user?.name || 'Пользователь'
	const displaySub = user?.email || user?.phone || ''

	useEffect(() => {
		if (tab === 'affiliate' && !isAffiliateEnabled) {
			setTab('widgets')
		}
	}, [isAffiliateEnabled, tab])

	return (
		<div className={styles.cabinet}>
			{/* ── User header ─────────────────────────────────────── */}
			<div className={styles.userHeader}>
				{isLoading ? (
					<div className={styles.avatarSkeleton}>
						<SkeletonLoader count={1} circle className="w-full h-full" />
					</div>
				) : (
					<Image
						src={user?.avatarPath || '/avatar-default.png'}
						alt={displayName}
						width={52}
						height={52}
						className={styles.avatarImg}
					/>
				)}
				<div className={styles.headerInfo}>
					{isLoading ? (
						<div className={styles.headerInfoSkeleton} aria-hidden="true">
							<div className={styles.headerNameSkeleton}>
								<SkeletonLoader count={1} className="w-full h-full" />
							</div>
							<div className={styles.headerSubSkeleton}>
								<SkeletonLoader count={1} className="w-full h-full" />
							</div>
							<div className={styles.headerPlanRow}>
								<div className={styles.headerBadgeSkeleton}>
									<SkeletonLoader count={1} className="w-full h-full" />
								</div>
								<div className={styles.headerExpiresSkeleton}>
									<SkeletonLoader count={1} className="w-full h-full" />
								</div>
							</div>
						</div>
					) : (
						<>
							<p className={styles.headerName}>{displayName}</p>
							{displaySub && (
								<p className={styles.headerSub}>{displaySub}</p>
							)}
							{(planName || subscription?.expiresAt) && (
								<div className={styles.headerPlanRow}>
									{planName && (
										<span className={styles.planBadge}>{planName}</span>
									)}
									{subscription?.expiresAt && (
										<p className={styles.planExpires}>
											до{' '}
											{new Date(subscription.expiresAt).toLocaleDateString(
												'ru-RU'
											)}
										</p>
									)}
								</div>
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
				{isAffiliateEnabled && (
					<button
						className={`${styles.tab} ${tab === 'affiliate' ? styles.tabActive : ''}`}
						onClick={() => setTab('affiliate')}
					>
						Партнёрская программа
					</button>
				)}
			</div>

			{/* ── Content ─────────────────────────────────────────── */}
			<div className={styles.content}>
				{tab === 'widgets' && <CabinetWidgets />}
				{tab === 'profile' && <CabinetProfile />}
				{tab === 'affiliate' && isAffiliateEnabled && <CabinetAffiliate />}
			</div>
		</div>
	)
}

export default Cabinet
