'use client'

import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import widgetService from '@/services/widget/widget.service'
import quizService from '@/services/quiz/quiz.service'
import callbackService from '@/services/callback/callback.service'
import countdownTimerService from '@/services/countdown-timer/countdown-timer.service'
import { Widget } from '@/services/widget/widget.types'
import { Quiz } from '@/services/quiz/quiz.types'
import { Callback } from '@/services/callback/callback.types'
import { CountdownTimer } from '@/services/countdown-timer/countdown-timer.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import WheelSettingsModal from '@/components/screens/widgets/WheelSettingsModal'
import QuizSettingsModal from '@/components/screens/widgets/QuizSettingsModal'
import CallbackSettingsModal from '@/components/screens/widgets/CallbackSettingsModal'
import CountdownTimerSettingsModal from '@/components/screens/widgets/CountdownTimerSettingsModal'
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

type ListItem =
	| { kind: 'wheel'; item: Widget }
	| { kind: 'quiz'; item: Quiz }
	| { kind: 'callback'; item: Callback }
	| { kind: 'timer'; item: CountdownTimer }

const CabinetWidgets = () => {
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)
	const queryClient = useQueryClient()

	const [settingsWidget, setSettingsWidget] = useState<Widget | null>(null)
	const [settingsQuiz, setSettingsQuiz] = useState<Quiz | null>(null)
	const [settingsCallback, setSettingsCallback] =
		useState<Callback | null>(null)
	const [settingsTimer, setSettingsTimer] =
		useState<CountdownTimer | null>(null)
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(
		null
	)
	const [showTypeModal, setShowTypeModal] = useState(false)

	const { data: widgetsData, isLoading: widgetsLoading } = useQuery({
		queryKey: ['widgets'],
		queryFn: widgetService.getMyWidgets,
		enabled: !!auth
	})

	const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
		queryKey: ['quizzes'],
		queryFn: quizService.getMyQuizzes,
		enabled: !!auth
	})

	const { data: callbacksData, isLoading: callbacksLoading } = useQuery({
		queryKey: ['callbacks'],
		queryFn: callbackService.getMyCallbacks,
		enabled: !!auth
	})

	const { data: timersData, isLoading: timersLoading } = useQuery({
		queryKey: ['countdown-timers'],
		queryFn: countdownTimerService.getMyCountdownTimers,
		enabled: !!auth
	})

	const subscription =
		widgetsData?.subscription ||
		quizzesData?.subscription ||
		callbacksData?.subscription ||
		timersData?.subscription

	const allItems: ListItem[] = [
		...(widgetsData?.widgets || []).map(w => ({
			kind: 'wheel' as const,
			item: w
		})),
		...(quizzesData?.quizzes || []).map(q => ({
			kind: 'quiz' as const,
			item: q
		})),
		...(callbacksData?.callbacks || []).map(c => ({
			kind: 'callback' as const,
			item: c
		})),
		...(timersData?.countdownTimers || []).map(t => ({
			kind: 'timer' as const,
			item: t
		}))
	].sort(
		(a, b) =>
			new Date(b.item.createdAt).getTime() -
			new Date(a.item.createdAt).getTime()
	)

	const isLoading =
		!isAuthResolved ||
		(!!auth &&
			(widgetsLoading ||
				quizzesLoading ||
				callbacksLoading ||
				timersLoading))

	const createMutation = useMutation({
		mutationFn: (typeId: string) => {
			if (typeId === 'quiz') return quizService.createQuiz('Квиз')
			if (typeId === 'callback')
				return callbackService.createCallback('Обратный звонок')
			if (typeId === 'timer')
				return countdownTimerService.createCountdownTimer('Таймер')
			const names: Record<string, string> = {
				wheel: 'Колесо фортуны',
				drum: 'Барабан'
			}
			return widgetService.createWidget(names[typeId] || 'Виджет')
		},
		onMutate: () =>
			toast.loading('Создаём виджет, пожалуйста подождите...'),
		onSuccess: (_, typeId, toastId) => {
			queryClient.invalidateQueries({
				queryKey:
					typeId === 'quiz'
						? ['quizzes']
						: typeId === 'callback'
							? ['callbacks']
							: typeId === 'timer'
								? ['countdown-timers']
								: ['widgets']
			})
			setShowTypeModal(false)
			toast.success('Виджет создан', { id: toastId })
		},
		onError: (e: any, _, toastId) => {
			toast.error(
				e?.response?.data?.message || 'Ошибка создания виджета',
				{ id: toastId }
			)
		}
	})

	const deleteWidgetMutation = useMutation({
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

	const deleteQuizMutation = useMutation({
		mutationFn: (id: string) => quizService.deleteQuiz(id),
		onMutate: () => toast.loading('Удаляем квиз, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['quizzes'] })
			setConfirmDeleteId(null)
			toast.success('Квиз удалён', { id: toastId })
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка удаления квиза', {
				id: toastId
			})
		}
	})

	const deleteCallbackMutation = useMutation({
		mutationFn: (id: string) => callbackService.deleteCallback(id),
		onMutate: () =>
			toast.loading('Удаляем виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['callbacks'] })
			setConfirmDeleteId(null)
			toast.success('Виджет удалён', { id: toastId })
		},
		onError: (e: any, __, toastId) => {
			toast.error(
				e?.response?.data?.message || 'Ошибка удаления виджета',
				{
					id: toastId
				}
			)
		}
	})

	const deleteTimerMutation = useMutation({
		mutationFn: (id: string) =>
			countdownTimerService.deleteCountdownTimer(id),
		onMutate: () =>
			toast.loading('Удаляем виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['countdown-timers'] })
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

	const toggleWidgetMutation = useMutation({
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

	const toggleQuizMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			quizService.updateQuiz(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(isActive ? 'Включаем квиз...' : 'Отключаем квиз...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['quizzes'] })
			toast.dismiss(toastId)
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка', { id: toastId })
		}
	})

	const toggleCallbackMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			callbackService.updateCallback(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['callbacks'] })
			toast.dismiss(toastId)
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка', { id: toastId })
		}
	})

	const toggleTimerMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			countdownTimerService.updateCountdownTimer(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['countdown-timers'] })
			toast.dismiss(toastId)
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка', { id: toastId })
		}
	})

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
	const hasSubscriptionMeta =
		!!subscription &&
		(subscription.plan !== 'HARD' ||
			trialDaysLeft !== null ||
			subscription.status === 'EXPIRED')

	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: '')
	).replace(/\/$/, '')

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
				<div
					className={`${styles.subInfo} ${styles.subInfoSkeleton}`}
					aria-hidden="true"
				>
					<SkeletonLoader
						width={148}
						height={18}
						containerClassName={styles.subInfoSkeletonMeta}
					/>
					<SkeletonLoader
						width={112}
						height={18}
						containerClassName={styles.subInfoSkeletonMeta}
					/>
				</div>
			) : hasSubscriptionMeta ? (
				<div className={styles.subInfo}>
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
				<div className={styles.widgetList} aria-hidden="true">
					<div
						className={`${styles.widgetRow} ${styles.widgetRowSkeleton}`}
					>
						<SkeletonLoader
							width={48}
							height={26}
							borderRadius={99}
							containerClassName={styles.widgetToggleSkeleton}
						/>
						<div className={styles.widgetNameSkeleton}>
							<SkeletonLoader width="100%" height={22} />
						</div>
						<div className={styles.actionsSkeleton}>
							<SkeletonLoader width={74} height={18} />
							<SkeletonLoader width={72} height={18} />
							<SkeletonLoader width={92} height={18} />
							<SkeletonLoader width={68} height={18} />
						</div>
					</div>
				</div>
			) : (
				<div className={styles.widgetList}>
					{allItems.length > 0 ? (
						allItems.map(entry => {
							const { kind, item } = entry
							const isDeleting =
								(kind === 'wheel'
									? deleteWidgetMutation.isPending
									: kind === 'quiz'
										? deleteQuizMutation.isPending
										: kind === 'callback'
											? deleteCallbackMutation.isPending
											: deleteTimerMutation.isPending) &&
								confirmDeleteId === item.id

							const pageUrl =
								kind === 'wheel'
									? `${publicSiteUrl}/page-wheel/${item.publicKey}`
									: kind === 'quiz'
										? `${publicSiteUrl}/page-quiz/${item.publicKey}`
										: kind === 'callback'
											? `${publicSiteUrl}/page-callback/${item.publicKey}`
											: `${publicSiteUrl}/page-timer/${item.publicKey}`

							const leadsUrl =
								kind === 'wheel'
									? `/wheels/${item.id}/leads`
									: kind === 'quiz'
										? `/quizzes/${item.id}/leads`
										: kind === 'callback'
											? `/callbacks/${item.id}/leads`
											: `/timers/${item.id}/leads`

							return (
								<div
									key={`${kind}-${item.id}`}
									className={styles.widgetRow}
								>
									<button
										className={`${styles.toggle} ${item.isActive ? styles.toggleOn : ''}`}
										onClick={() => {
											if (kind === 'wheel') {
												toggleWidgetMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											} else if (kind === 'quiz') {
												toggleQuizMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											} else if (kind === 'callback') {
												toggleCallbackMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											} else {
												toggleTimerMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											}
										}}
										aria-label={item.isActive ? 'Отключить' : 'Включить'}
									>
										<span className={styles.toggleThumb} />
									</button>

									<span className={styles.widgetName}>
										{item.name}
										<span
											style={{
												marginLeft: 8,
												fontSize: 11,
												color: '#7b3fa0',
												background: '#f3eeff',
												borderRadius: 4,
												padding: '1px 6px'
											}}
										>
											{kind === 'wheel'
												? 'Колесо'
												: kind === 'quiz'
													? 'Квиз'
													: kind === 'callback'
														? 'Звонок'
														: 'Таймер'}
										</span>
									</span>

									<div className={styles.actions}>
										<a
											href={pageUrl}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.actionBtn}
										>
											<ExternalLinkIcon size={17} /> открыть
										</a>

										<a href={leadsUrl} className={styles.actionBtn}>
											<FileListIcon size={17} /> заявки
											{item._count?.leads ? (
												<span className={styles.leadsCountBadge}>
													{item._count.leads}
												</span>
											) : null}
										</a>

										<button
											className={styles.actionBtn}
											onClick={() => {
												if (kind === 'wheel') {
													setSettingsWidget(item as Widget)
												} else if (kind === 'quiz') {
													setSettingsQuiz(item as Quiz)
												} else if (kind === 'callback') {
													setSettingsCallback(item as Callback)
												} else {
													setSettingsTimer(item as CountdownTimer)
												}
											}}
										>
											<SettingsIcon size={17} /> настройки
										</button>

										{confirmDeleteId === item.id ? (
											<>
												<button
													className={styles.actionBtnDanger}
													onClick={() => {
														if (kind === 'wheel') {
															deleteWidgetMutation.mutate(item.id)
														} else if (kind === 'quiz') {
															deleteQuizMutation.mutate(item.id)
														} else if (kind === 'callback') {
															deleteCallbackMutation.mutate(item.id)
														} else {
															deleteTimerMutation.mutate(item.id)
														}
													}}
													disabled={isDeleting}
												>
													{isDeleting ? (
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
												onClick={() => setConfirmDeleteId(item.id)}
											>
												<DeleteIcon size={17} /> удалить
											</button>
										)}
									</div>
								</div>
							)
						})
					) : (
						<div className={styles.emptyWidgetRow}>
							<p className={styles.emptyWidgetTitle}>
								У вас пока нет виджетов
							</p>
							<p className={styles.emptyWidgetText}>
								Создайте первый виджет, чтобы начать сбор заявок.
							</p>
						</div>
					)}
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
				<WheelSettingsModal
					widget={settingsWidget}
					onClose={() => setSettingsWidget(null)}
					onSaved={updated => {
						setSettingsWidget(updated)
						queryClient.invalidateQueries({ queryKey: ['widgets'] })
					}}
				/>
			)}

			{settingsQuiz && (
				<QuizSettingsModal
					quiz={settingsQuiz}
					onClose={() => setSettingsQuiz(null)}
					onSaved={updated => {
						setSettingsQuiz(updated)
						queryClient.invalidateQueries({ queryKey: ['quizzes'] })
					}}
				/>
			)}

			{settingsCallback && (
				<CallbackSettingsModal
					callback={settingsCallback}
					onClose={() => setSettingsCallback(null)}
					onSaved={updated => {
						setSettingsCallback(updated)
						queryClient.invalidateQueries({ queryKey: ['callbacks'] })
					}}
				/>
			)}

			{settingsTimer && (
				<CountdownTimerSettingsModal
					timer={settingsTimer}
					onClose={() => setSettingsTimer(null)}
					onSaved={updated => {
						setSettingsTimer(updated)
						queryClient.invalidateQueries({
							queryKey: ['countdown-timers']
						})
					}}
				/>
			)}
		</div>
	)
}

export default CabinetWidgets
