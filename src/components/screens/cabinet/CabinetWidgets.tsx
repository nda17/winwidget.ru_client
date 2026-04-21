'use client'

import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import widgetService from '@/services/widget/widget.service'
import { Widget } from '@/services/widget/widget.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import WidgetSettingsModal from '@/components/screens/widgets/WidgetSettingsModal'
import WidgetTypeModal from '@/components/screens/widgets/WidgetTypeModal'
import {
	CheckIcon,
	DeleteIcon,
	ExternalLinkIcon,
	FileListIcon,
	SettingsIcon
} from '@/components/ui/icons/ActionIcons'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import styles from './Cabinet.module.scss'

const planLabel: Record<string, string> = {
	TRIAL: 'Тест-драйв',
	EASY: 'Easy',
	HARD: 'Hard'
}

const WIDGET_TYPE_NAMES: Record<string, string> = {
	wheel: 'Колесо фортуны',
	drum: 'Барабан'
}

const CabinetWidgets = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [settingsWidget, setSettingsWidget] = useState<Widget | null>(null)
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(
		null
	)
	const [showTypeModal, setShowTypeModal] = useState(false)

	const { data, isLoading } = useQuery({
		queryKey: ['widgets'],
		queryFn: widgetService.getMyWidgets,
		enabled: auth
	})

	const createMutation = useMutation({
		mutationFn: (typeId: string) =>
			widgetService.createWidget(WIDGET_TYPE_NAMES[typeId] || 'Виджет'),
		onMutate: () =>
			toast.loading('Создаём виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['widgets'] })
			setShowTypeModal(false)
			toast.success('Виджет создан', { id: toastId })
		},
		onError: (e: any, __, toastId) => {
			toast.error(
				e?.response?.data?.message || 'Ошибка создания виджета',
				{ id: toastId }
			)
		}
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => widgetService.deleteWidget(id),
		onMutate: () =>
			toast.loading('Удаляем виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['widgets'] })
			setConfirmDeleteId(null)
			toast.success('Виджет удалён', { id: toastId })
		},
		onError: (e: any, __, toastId) => {
			toast.error(
				e?.response?.data?.message || 'Ошибка удаления виджета',
				{ id: toastId }
			)
		}
	})

	const toggleMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			widgetService.updateWidget(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['widgets'] })
			toast.dismiss(toastId)
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка', { id: toastId })
		}
	})

	const widgets = data?.widgets || []
	const subscription = data?.subscription

	const isTrialExpiredByTime =
		subscription?.plan === 'TRIAL' && subscription.status === 'EXPIRED'
	const isLeadLimitReached =
		(subscription?.plan === 'TRIAL' &&
			subscription.status === 'ACTIVE' &&
			(subscription.leadsThisPeriod ?? 0) >= 10) ||
		(subscription?.plan === 'EASY' &&
			(subscription.leadsThisPeriod ?? 0) >= 100)

	const trialDaysLeft = (() => {
		if (
			subscription?.plan !== 'TRIAL' ||
			subscription.status !== 'ACTIVE' ||
			!subscription.expiresAt
		)
			return null
		const diff = Math.ceil(
			(new Date(subscription.expiresAt).getTime() - Date.now()) /
				86_400_000
		)
		return Math.max(0, diff)
	})()

	return (
		<div>
			{!isLoading && isTrialExpiredByTime && (
				<div className={styles.limitBanner}>
					<div className={styles.limitBannerContent}>
						<span className={styles.limitBannerIcon}>⏰</span>
						<div>
							<p className={styles.limitBannerTitle}>
								Тест-драйв завершён
							</p>
							<p className={styles.limitBannerText}>
								7-дневный период тест-драйва истёк. Виджеты больше не
								принимают новые заявки.
							</p>
						</div>
					</div>
					<a href="/payment" className={styles.limitBannerBtn}>
						Выбрать тариф
					</a>
				</div>
			)}
			{!isLoading && isLeadLimitReached && (
				<div className={styles.limitBanner}>
					<div className={styles.limitBannerContent}>
						<span className={styles.limitBannerIcon}>⚠️</span>
						<div>
							<p className={styles.limitBannerTitle}>
								Лимит заявок исчерпан
							</p>
							<p className={styles.limitBannerText}>
								Виджеты больше не принимают новые заявки. Перейдите на
								другой тариф, чтобы продолжить сбор заявок.
							</p>
						</div>
					</div>
					<a href="/payment" className={styles.limitBannerBtn}>
						Выбрать тариф
					</a>
				</div>
			)}
			{isLoading ? (
				<div className={styles.subInfo}>
					<SkeletonLoader width={72} height={22} />
					<SkeletonLoader width={150} height={18} />
				</div>
			) : subscription ? (
				<div className={styles.subInfo}>
					<span className={styles.planBadge}>
						{planLabel[subscription.plan] || subscription.plan}
					</span>
					{subscription.plan !== 'HARD' && (
						<span className={styles.leadsCount}>
							Заявок в периоде: {subscription.leadsThisPeriod}
							{subscription.plan === 'TRIAL' && ' / 10'}
							{subscription.plan === 'EASY' && ' / 100'}
						</span>
					)}
					{trialDaysLeft !== null && (
						<span
							className={
								trialDaysLeft <= 1
									? styles.trialDaysUrgent
									: styles.trialDays
							}
						>
							{trialDaysLeft === 0
								? 'Последний день'
								: `Осталось дней: ${trialDaysLeft}`}
						</span>
					)}
					{subscription.status === 'EXPIRED' && (
						<span className={styles.expiredBadge}>Подписка истекла</span>
					)}
				</div>
			) : null}

			{isLoading ? (
				<div className={styles.widgetList}>
					{[1, 2, 3].map(i => (
						<div key={i} className={styles.widgetRow}>
							<SkeletonLoader
								width={48}
								height={26}
								borderRadius={99}
								style={{ flexShrink: 0 }}
							/>
							<div style={{ flex: 1, minWidth: 0 }}>
								<SkeletonLoader width="60%" height={18} />
							</div>
							<div className={styles.actions}>
								<SkeletonLoader width={58} height={16} />
								<SkeletonLoader width={68} height={16} />
								<SkeletonLoader width={80} height={16} />
								<SkeletonLoader width={64} height={16} />
							</div>
						</div>
					))}
				</div>
			) : (
				<div className={styles.widgetList}>
					{widgets.map(widget => (
						<div key={widget.id} className={styles.widgetRow}>
							<button
								className={`${styles.toggle} ${widget.isActive ? styles.toggleOn : ''}`}
								onClick={() =>
									toggleMutation.mutate({
										id: widget.id,
										isActive: !widget.isActive
									})
								}
								aria-label={widget.isActive ? 'Отключить' : 'Включить'}
							>
								<span className={styles.toggleThumb} />
							</button>

							<span className={styles.widgetName}>{widget.name}</span>

							<div className={styles.actions}>
								<a
									href={`/page/${widget.publicKey}`}
									target="_blank"
									rel="noopener noreferrer"
									className={styles.actionBtn}
								>
									<ExternalLinkIcon size={17} /> открыть
								</a>

								<a
									href={`/widgets/${widget.id}/leads`}
									className={styles.actionBtn}
								>
									<FileListIcon size={17} /> заявки
									{widget._count?.leads ? (
										<span className={styles.leadsCountBadge}>
											{widget._count.leads}
										</span>
									) : null}
								</a>

								<button
									className={styles.actionBtn}
									onClick={() => setSettingsWidget(widget)}
								>
									<SettingsIcon size={17} /> настройки
								</button>

								{confirmDeleteId === widget.id ? (
									<>
										<button
											className={styles.actionBtnDanger}
											onClick={() => deleteMutation.mutate(widget.id)}
											disabled={deleteMutation.isPending}
										>
											{deleteMutation.isPending ? (
												'...'
											) : (
												<>
													<CheckIcon size={16} /> удалить
												</>
											)}
										</button>
										<button
											className={styles.actionBtn}
											onClick={() => setConfirmDeleteId(null)}
										>
											Отмена
										</button>
									</>
								) : (
									<button
										className={styles.actionBtn}
										onClick={() => setConfirmDeleteId(widget.id)}
									>
										<DeleteIcon size={17} /> удалить
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			<button
				className={styles.createBtn}
				onClick={() => setShowTypeModal(true)}
				disabled={createMutation.isPending}
			>
				НОВЫЙ ВИДЖЕТ
			</button>

			{showTypeModal && (
				<WidgetTypeModal
					onSelect={typeId => createMutation.mutate(typeId)}
					onClose={() => setShowTypeModal(false)}
					isCreating={createMutation.isPending}
				/>
			)}

			{settingsWidget && (
				<WidgetSettingsModal
					widget={settingsWidget}
					onClose={() => setSettingsWidget(null)}
					onSaved={updated => {
						setSettingsWidget(updated)
						queryClient.invalidateQueries({ queryKey: ['widgets'] })
					}}
				/>
			)}
		</div>
	)
}

export default CabinetWidgets
