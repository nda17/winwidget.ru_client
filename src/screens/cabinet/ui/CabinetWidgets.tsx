'use client'

import { WidgetTypeModal } from '@/features/create-widget'
import {
	CheckIcon,
	DeleteIcon,
	ExternalLinkIcon,
	FileListIcon,
	SettingsIcon
} from '@/shared/ui/icons/ActionIcons'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import { callbackService } from '@/entities/site-widget'
import { Callback } from '@/entities/site-widget'
import { calculatorService } from '@/entities/site-widget'
import { Calculator } from '@/entities/site-widget'
import { countdownTimerService } from '@/entities/site-widget'
import { CountdownTimer } from '@/entities/site-widget'
import { onlineConsultantService } from '@/entities/site-widget'
import { OnlineConsultant } from '@/entities/site-widget'
import { quizService } from '@/entities/site-widget'
import { Quiz } from '@/entities/site-widget'
import { stopOfferService } from '@/entities/site-widget'
import { StopOffer } from '@/entities/site-widget'
import { widgetService } from '@/entities/site-widget'
import { Widget } from '@/entities/site-widget'
import { useAuthStore } from '@/entities/user'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './Cabinet.module.scss'

type ListItem =
	| { kind: 'wheel'; item: Widget }
	| { kind: 'quiz'; item: Quiz }
	| { kind: 'callback'; item: Callback }
	| { kind: 'timer'; item: CountdownTimer }
	| { kind: 'stop-offer'; item: StopOffer }
	| { kind: 'online-consultant'; item: OnlineConsultant }
	| { kind: 'calculator'; item: Calculator }

const CabinetWidgets = () => {
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)
	const queryClient = useQueryClient()
	const router = useRouter()

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

	const { data: stopOffersData, isLoading: stopOffersLoading } = useQuery({
		queryKey: ['stop-offers'],
		queryFn: stopOfferService.getMyStopOffers,
		enabled: !!auth
	})

	const {
		data: onlineConsultantsData,
		isLoading: onlineConsultantsLoading
	} = useQuery({
		queryKey: ['online-consultants'],
		queryFn: onlineConsultantService.getMyOnlineConsultants,
		enabled: !!auth
	})

	const { data: calculatorsData, isLoading: calculatorsLoading } =
		useQuery({
			queryKey: ['calculators'],
			queryFn: calculatorService.getMyCalculators,
			enabled: !!auth
		})

	const subscription =
		widgetsData?.subscription ||
		quizzesData?.subscription ||
		callbacksData?.subscription ||
		timersData?.subscription ||
		stopOffersData?.subscription ||
		onlineConsultantsData?.subscription ||
		calculatorsData?.subscription

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
		})),
		...(stopOffersData?.stopOffers || []).map(s => ({
			kind: 'stop-offer' as const,
			item: s
		})),
		...(onlineConsultantsData?.onlineConsultants || []).map(c => ({
			kind: 'online-consultant' as const,
			item: c
		})),
		...(calculatorsData?.calculators || []).map(calculator => ({
			kind: 'calculator' as const,
			item: calculator
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
				timersLoading ||
				stopOffersLoading ||
				onlineConsultantsLoading ||
				calculatorsLoading))

	const createMutation = useMutation({
		mutationFn: (typeId: string) => {
			if (typeId === 'quiz') return quizService.createQuiz('Квиз')
			if (typeId === 'callback')
				return callbackService.createCallback('Обратный звонок')
			if (typeId === 'timer')
				return countdownTimerService.createCountdownTimer('Таймер')
			if (typeId === 'stop-offer')
				return stopOfferService.createStopOffer('Стоп-оффер')
			if (typeId === 'online-consultant')
				return onlineConsultantService.createOnlineConsultant(
					'Онлайн-консультант'
				)
			if (typeId === 'calculator')
				return calculatorService.createCalculator('Калькулятор стоимости')
			const names: Record<string, string> = {
				wheel: 'Колесо фортуны'
			}
			return widgetService.createWidget(names[typeId] || 'Виджет')
		},
		onMutate: () =>
			toast.loading('Создаём виджет, пожалуйста подождите...'),
		onSuccess: (createdWidget, typeId, toastId) => {
			queryClient.invalidateQueries({
				queryKey:
					typeId === 'quiz'
						? ['quizzes']
						: typeId === 'callback'
							? ['callbacks']
							: typeId === 'timer'
								? ['countdown-timers']
								: typeId === 'stop-offer'
									? ['stop-offers']
									: typeId === 'online-consultant'
										? ['online-consultants']
										: typeId === 'calculator'
											? ['calculators']
											: ['widgets']
			})
			setShowTypeModal(false)
			toast.success('Виджет создан', { id: toastId })
			router.push(`/cabinet/widgets/${typeId}/${createdWidget.id}`)
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
			toast.success('Виджет удалён', { id: toastId })
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

	const deleteStopOfferMutation = useMutation({
		mutationFn: (id: string) => stopOfferService.deleteStopOffer(id),
		onMutate: () =>
			toast.loading('Удаляем виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['stop-offers'] })
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

	const deleteOnlineConsultantMutation = useMutation({
		mutationFn: (id: string) =>
			onlineConsultantService.deleteOnlineConsultant(id),
		onMutate: () =>
			toast.loading('Удаляем виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['online-consultants'] })
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

	const deleteCalculatorMutation = useMutation({
		mutationFn: (id: string) => calculatorService.deleteCalculator(id),
		onMutate: () =>
			toast.loading('Удаляем виджет, пожалуйста подождите...'),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['calculators'] })
			setConfirmDeleteId(null)
			toast.success('Виджет удалён', { id: toastId })
		},
		onError: (error: any, __, toastId) => {
			toast.error(
				error?.response?.data?.message || 'Ошибка удаления виджета',
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

	const toggleStopOfferMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			stopOfferService.updateStopOffer(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['stop-offers'] })
			toast.dismiss(toastId)
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка', { id: toastId })
		}
	})

	const toggleOnlineConsultantMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			onlineConsultantService.updateOnlineConsultant(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['online-consultants'] })
			toast.dismiss(toastId)
		},
		onError: (e: any, __, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка', { id: toastId })
		}
	})

	const toggleCalculatorMutation = useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			calculatorService.updateCalculator(id, { isActive }),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (_, __, toastId) => {
			queryClient.invalidateQueries({ queryKey: ['calculators'] })
			toast.success('Статус виджета обновлён', { id: toastId })
		},
		onError: (error: any, __, toastId) => {
			toast.error(error?.response?.data?.message || 'Ошибка', {
				id: toastId
			})
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
							const lifecycle = item as typeof item & {
								publishedVersion?: number
								hasUnpublishedChanges?: boolean
							}
							const isDeleting =
								(kind === 'wheel'
									? deleteWidgetMutation.isPending
									: kind === 'quiz'
										? deleteQuizMutation.isPending
										: kind === 'callback'
											? deleteCallbackMutation.isPending
											: kind === 'timer'
												? deleteTimerMutation.isPending
												: kind === 'stop-offer'
													? deleteStopOfferMutation.isPending
													: kind === 'online-consultant'
														? deleteOnlineConsultantMutation.isPending
														: deleteCalculatorMutation.isPending) &&
								confirmDeleteId === item.id

							const widgetStatus =
								lifecycle.publishedVersion === 0
									? {
											label: 'Не опубликован',
											description:
												'Сохраните настройки и опубликуйте первую версию.',
											className: styles.widgetStatusWarning
										}
									: !item.isActive
										? {
												label: 'Выключен',
												description:
													'Виджет отключён вручную и не показывается на сайте.',
												className: styles.widgetStatusDisabled
											}
										: subscription?.status !== 'ACTIVE'
											? {
													label:
														subscription?.status === 'CANCELLED'
															? 'Подписка отменена'
															: 'Подписка неактивна',
													description:
														'Виджет не работает, пока подписка не активна.',
													className: styles.widgetStatusBlocked
												}
											: isLeadLimitReached
												? {
														label: 'Лимит заявок',
														description:
															'Виджет может отображаться, но новые заявки временно не принимаются.',
														className: styles.widgetStatusBlocked
													}
												: !item.installDomain.trim()
													? {
															label: 'Требует настройки',
															description:
																'Добавьте домен в настройках, чтобы подключить виджет к сайту.',
															className: styles.widgetStatusWarning
														}
													: {
															label: 'Включён',
															description:
																'Работа виджета разрешена. Фактическую установку можно проверить в настройках.',
															className: styles.widgetStatusActive
														}
							const publicationStatus =
								lifecycle.publishedVersion === 0
									? null
									: lifecycle.hasUnpublishedChanges
										? {
												label: 'Есть черновик',
												description:
													'Сохранённые изменения ещё не опубликованы.',
												className: styles.widgetStatusWarning
											}
										: null

							const pageUrl =
								kind === 'wheel'
									? `${publicSiteUrl}/page-wheel/${item.publicKey}`
									: kind === 'quiz'
										? `${publicSiteUrl}/page-quiz/${item.publicKey}`
										: kind === 'callback'
											? `${publicSiteUrl}/page-callback/${item.publicKey}`
											: kind === 'timer'
												? `${publicSiteUrl}/page-timer/${item.publicKey}`
												: kind === 'stop-offer'
													? `${publicSiteUrl}/page-stop-offer/${item.publicKey}`
													: kind === 'online-consultant'
														? `${publicSiteUrl}/page-online-consultant/${item.publicKey}`
														: `${publicSiteUrl}/page-calculator/${item.publicKey}`

							const leadsUrl =
								kind === 'wheel'
									? `/wheels/${item.id}/leads`
									: kind === 'quiz'
										? `/quizzes/${item.id}/leads`
										: kind === 'callback'
											? `/callbacks/${item.id}/leads`
											: kind === 'timer'
												? `/timers/${item.id}/leads`
												: kind === 'stop-offer'
													? `/stop-offers/${item.id}/leads`
													: kind === 'online-consultant'
														? `/online-consultants/${item.id}/leads`
														: `/calculators/${item.id}/leads`

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
											} else if (kind === 'timer') {
												toggleTimerMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											} else if (kind === 'stop-offer') {
												toggleStopOfferMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											} else if (kind === 'online-consultant') {
												toggleOnlineConsultantMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											} else {
												toggleCalculatorMutation.mutate({
													id: item.id,
													isActive: !item.isActive
												})
											}
										}}
										aria-label={
											item.isActive
												? 'Отключить виджет'
												: 'Включить виджет'
										}
										data-tooltip={
											item.isActive
												? 'Отключить виджет. Он пропадёт на всех сайтах, где установлен.'
												: 'Включить виджет. Он снова появится на всех сайтах, где установлен.'
										}
									>
										<span className={styles.toggleThumb} />
									</button>

									<div className={styles.widgetInfo}>
										<div className={styles.widgetNameLine}>
											<span className={styles.widgetName}>
												{item.name}
											</span>
											<span className={styles.widgetTypeBadge}>
												{kind === 'wheel'
													? 'Колесо'
													: kind === 'quiz'
														? 'Квиз'
														: kind === 'callback'
															? 'Звонок'
															: kind === 'timer'
																? 'Таймер'
																: kind === 'stop-offer'
																	? 'Стоп-оффер'
																	: kind === 'online-consultant'
																		? 'Онлайн-консультант'
																		: 'Калькулятор'}
											</span>
										</div>
										<div className={styles.widgetMeta}>
											<span
												className={`${styles.widgetStatus} ${widgetStatus.className}`}
												title={widgetStatus.description}
											>
												{widgetStatus.label}
											</span>
											{publicationStatus && (
												<span
													className={`${styles.widgetStatus} ${publicationStatus.className}`}
													title={publicationStatus.description}
												>
													{publicationStatus.label}
												</span>
											)}
											<span
												className={`${styles.widgetDomain} ${!item.installDomain ? styles.widgetDomainEmpty : ''}`}
												data-tooltip={
													item.installDomain
														? 'Это домен, указанный в настройках виджета.'
														: 'Нужно добавить домен, где будет работать виджет.'
												}
											>
												<span className={styles.widgetDomainText}>
													{item.installDomain
														? `Домен настроен: ${item.installDomain}`
														: 'Домен не добавлен'}
												</span>
											</span>
										</div>
									</div>

									<div className={styles.actions}>
										<a
											href={pageUrl}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.actionBtn}
											title="Открыть прямой предпросмотр виджета"
										>
											<ExternalLinkIcon size={17} /> предпросмотр
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
											onClick={() =>
												router.push(`/cabinet/widgets/${kind}/${item.id}`)
											}
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
														} else if (kind === 'timer') {
															deleteTimerMutation.mutate(item.id)
														} else if (kind === 'stop-offer') {
															deleteStopOfferMutation.mutate(item.id)
														} else if (kind === 'online-consultant') {
															deleteOnlineConsultantMutation.mutate(
																item.id
															)
														} else {
															deleteCalculatorMutation.mutate(item.id)
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
					creatingTypeId={
						createMutation.isPending ? createMutation.variables : null
					}
				/>
			)}
		</div>
	)
}

export default CabinetWidgets
