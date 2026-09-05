'use client'

import type {
	Plan,
	Subscription,
	SubscriptionStatus
} from '@/entities/subscription'
import {
	calculatorService,
	callbackService,
	countdownTimerService,
	aiConsultantService,
	quizService,
	stopOfferService,
	widgetExperienceService,
	widgetService
} from '@/entities/site-widget'
import type {
	Calculator,
	Callback,
	CountdownTimer,
	AiConsultant,
	Quiz,
	StopOffer,
	Widget,
	WidgetLifecycleState
} from '@/entities/site-widget'
import { useAuthStore, type UserStatus } from '@/entities/user'
import {
	CalculatorSettingsModal,
	CallbackSettingsModal,
	CountdownTimerSettingsModal,
	AiConsultantSettingsModal,
	QuizSettingsModal,
	StopOfferSettingsModal,
	WheelSettingsModal
} from '@/features/edit-widget-settings'
import {
	adminWidgetsService,
	type AdminWidgetDetails,
	type AdminWidgetType
} from '@/features/manage-widgets'
import { errorCatch } from '@/shared/api'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useZoneRouter as useRouter } from '@/shared/lib/navigation/useZoneRouter'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import WidgetExperiencePanel from './WidgetExperiencePanel'
import styles from './WidgetSettings.module.scss'

const WIDGET_SETTINGS_TYPES = [
	'wheel',
	'quiz',
	'callback',
	'timer',
	'stop-offer',
	'ai-consultant',
	'calculator'
] as const
const DESKTOP_SETTINGS_MEDIA_QUERY = '(min-width: 1101px)'

export type WidgetSettingsType = (typeof WIDGET_SETTINGS_TYPES)[number]

interface WidgetSettingsAccess {
	ownerPlan: Plan | null
	subscriptionStatus: SubscriptionStatus | null
	ownerStatus?: UserStatus
}

type WidgetSettingsSelection = WidgetSettingsAccess &
	(
		| {
				type: 'wheel'
				entity: Widget
		  }
		| {
				type: 'quiz'
				entity: Quiz
		  }
		| {
				type: 'callback'
				entity: Callback
		  }
		| {
				type: 'timer'
				entity: CountdownTimer
		  }
		| {
				type: 'stop-offer'
				entity: StopOffer
		  }
		| {
				type: 'ai-consultant'
				entity: AiConsultant
		  }
		| {
				type: 'calculator'
				entity: Calculator
		  }
	)

const getSubscriptionAccess = (
	subscription: Subscription | null
): WidgetSettingsAccess => ({
	ownerPlan: subscription?.plan ?? null,
	subscriptionStatus: subscription?.status ?? null
})

interface WidgetSettingsSource {
	ownerQueryKey: string
	load: (id: string) => Promise<WidgetSettingsSelection | null>
}

const WIDGET_SETTINGS_SOURCES: Record<
	WidgetSettingsType,
	WidgetSettingsSource
> = {
	wheel: {
		ownerQueryKey: 'widgets',
		load: async id => {
			const data = await widgetService.getMyWidgets()
			const entity = data.widgets.find(widget => widget.id === id)

			return entity
				? {
						type: 'wheel',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	},
	quiz: {
		ownerQueryKey: 'quizzes',
		load: async id => {
			const data = await quizService.getMyQuizzes()
			const entity = data.quizzes.find(quiz => quiz.id === id)

			return entity
				? {
						type: 'quiz',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	},
	callback: {
		ownerQueryKey: 'callbacks',
		load: async id => {
			const data = await callbackService.getMyCallbacks()
			const entity = data.callbacks.find(callback => callback.id === id)

			return entity
				? {
						type: 'callback',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	},
	timer: {
		ownerQueryKey: 'countdown-timers',
		load: async id => {
			const data = await countdownTimerService.getMyCountdownTimers()
			const entity = data.countdownTimers.find(timer => timer.id === id)

			return entity
				? {
						type: 'timer',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	},
	'stop-offer': {
		ownerQueryKey: 'stop-offers',
		load: async id => {
			const data = await stopOfferService.getMyStopOffers()
			const entity = data.stopOffers.find(stopOffer => stopOffer.id === id)

			return entity
				? {
						type: 'stop-offer',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	},
	'ai-consultant': {
		ownerQueryKey: 'ai-consultants',
		load: async id => {
			const data = await aiConsultantService.getMyAiConsultants()
			const entity = data.aiConsultants.find(
				consultant => consultant.id === id
			)

			return entity
				? {
						type: 'ai-consultant',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	},
	calculator: {
		ownerQueryKey: 'calculators',
		load: async id => {
			const data = await calculatorService.getMyCalculators()
			const entity = data.calculators.find(
				calculator => calculator.id === id
			)

			return entity
				? {
						type: 'calculator',
						entity,
						...getSubscriptionAccess(data.subscription)
					}
				: null
		}
	}
}

const ADMIN_WIDGET_TYPE_BY_SETTINGS_TYPE: Record<
	WidgetSettingsType,
	AdminWidgetType
> = {
	wheel: 'WHEEL',
	quiz: 'QUIZ',
	callback: 'CALLBACK',
	timer: 'TIMER',
	'stop-offer': 'STOP_OFFER',
	'ai-consultant': 'AI_CONSULTANT',
	calculator: 'CALCULATOR'
}

const toAdminSelection = (
	details: AdminWidgetDetails
): WidgetSettingsSelection => {
	const access = {
		ownerPlan: details.ownerPlan,
		subscriptionStatus: details.subscriptionStatus,
		ownerStatus: details.ownerStatus
	}

	switch (details.type) {
		case 'WHEEL':
			return { type: 'wheel', entity: details.entity, ...access }
		case 'QUIZ':
			return { type: 'quiz', entity: details.entity, ...access }
		case 'CALLBACK':
			return { type: 'callback', entity: details.entity, ...access }
		case 'TIMER':
			return { type: 'timer', entity: details.entity, ...access }
		case 'STOP_OFFER':
			return { type: 'stop-offer', entity: details.entity, ...access }
		case 'AI_CONSULTANT':
			return {
				type: 'ai-consultant',
				entity: details.entity,
				...access
			}
		case 'CALCULATOR':
			return { type: 'calculator', entity: details.entity, ...access }
	}
}

interface WidgetSettingsProps {
	type: WidgetSettingsType
	id: string
	accessMode?: 'owner' | 'admin'
}

const WidgetSettings = ({
	type,
	id,
	accessMode = 'owner'
}: WidgetSettingsProps) => {
	const router = useRouter()
	const queryClient = useQueryClient()
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)
	const [previewPortalTarget, setPreviewPortalTarget] =
		useState<HTMLDivElement | null>(null)
	const [versionsPage, setVersionsPage] = useState(1)
	const [editorResetKey, setEditorResetKey] = useState(0)
	const [hasEditorUnsavedChanges, setHasEditorUnsavedChanges] =
		useState(false)
	const [hasReviewedMobilePreview, setHasReviewedMobilePreview] =
		useState(false)
	const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false)
	const [isCheckingInstallation, setIsCheckingInstallation] =
		useState(false)
	const installationCheckIdRef = useRef(0)
	const installationToastIdRef = useRef<string | null>(null)
	const previewColumnRef = useRef<HTMLElement | null>(null)
	const previewRestoreButtonRef = useRef<HTMLButtonElement | null>(null)
	const isAdminMode = accessMode === 'admin'
	const adminType = ADMIN_WIDGET_TYPE_BY_SETTINGS_TYPE[type]
	const source = WIDGET_SETTINGS_SOURCES[type]
	const handlePreviewDeviceChange = useCallback(
		(device: 'desktop' | 'mobile') => {
			if (device === 'mobile') setHasReviewedMobilePreview(true)
		},
		[]
	)
	const handlePreviewConfigChange = useCallback(() => {
		setHasReviewedMobilePreview(false)
	}, [])

	useEffect(() => {
		setHasReviewedMobilePreview(false)
		setIsPreviewCollapsed(false)
	}, [id, type])

	useEffect(() => {
		if (
			!isPreviewCollapsed ||
			!window.matchMedia(DESKTOP_SETTINGS_MEDIA_QUERY).matches
		) {
			return
		}

		const animationFrameId = window.requestAnimationFrame(() => {
			previewRestoreButtonRef.current?.focus()
		})

		return () => window.cancelAnimationFrame(animationFrameId)
	}, [isPreviewCollapsed])

	const settingsQueryKey = isAdminMode
		? (['admin-widget-settings-page', adminType, id] as const)
		: ([source.ownerQueryKey, 'settings-page', id] as const)
	const {
		data: selection,
		error,
		isError,
		isFetching,
		isPending,
		refetch
	} = useQuery({
		queryKey: settingsQueryKey,
		queryFn: () =>
			isAdminMode
				? adminWidgetsService.getById(adminType, id).then(toAdminSelection)
				: source.load(id),
		enabled: isAuthResolved && auth
	})
	const canUseAnalytics =
		selection?.ownerPlan === 'HARD' &&
		selection.subscriptionStatus === 'ACTIVE' &&
		selection.ownerStatus !== 'DEACTIVATED'
	const analyticsUnavailableMessage =
		selection?.ownerStatus === 'DEACTIVATED'
			? 'Аналитика недоступна, пока владелец деактивирован.'
			: 'Воронка доступна на активном тарифе Hard.'
	const lifecycleQueryKey = [
		isAdminMode ? 'admin-widget-settings' : 'widget-settings',
		type,
		id
	] as const
	const runtimeStatusQueryKey = [
		isAdminMode ? 'admin-widget-runtime-status' : 'widget-runtime-status',
		type,
		id
	] as const
	const analyticsQueryKey = [
		isAdminMode
			? 'admin-widget-runtime-analytics'
			: 'widget-runtime-analytics',
		type,
		id,
		30
	] as const
	const versionsQueryKey = [
		isAdminMode
			? 'admin-widget-settings-versions'
			: 'widget-settings-versions',
		type,
		id
	] as const
	const lifecycleQuery = useQuery({
		queryKey: lifecycleQueryKey,
		queryFn: () =>
			isAdminMode
				? adminWidgetsService
						.getById(adminType, id)
						.then(details => details.lifecycle)
				: widgetExperienceService.getLifecycle(type, id),
		enabled: isAuthResolved && auth
	})
	const runtimeStatusQuery = useQuery({
		queryKey: runtimeStatusQueryKey,
		queryFn: () =>
			isAdminMode
				? adminWidgetsService.getRuntimeStatus(adminType, id)
				: widgetExperienceService.getRuntimeStatus(type, id),
		enabled: isAuthResolved && auth,
		retry: 1
	})
	const analyticsQuery = useQuery({
		queryKey: analyticsQueryKey,
		queryFn: () =>
			isAdminMode
				? adminWidgetsService.getAnalytics(adminType, id, 30)
				: widgetExperienceService.getAnalytics(type, id, 30),
		enabled: isAuthResolved && Boolean(auth) && canUseAnalytics,
		retry: 1
	})
	const versionsQuery = useQuery({
		queryKey: [...versionsQueryKey, versionsPage],
		queryFn: () =>
			isAdminMode
				? adminWidgetsService.getVersions(adminType, id, versionsPage, 10)
				: widgetExperienceService.getVersions(type, id, versionsPage, 10),
		enabled: isAuthResolved && auth,
		placeholderData: previous => previous
	})

	const refreshWidgetQueries = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: isAdminMode
					? ['admin-widgets-monitoring']
					: [source.ownerQueryKey]
			}),
			queryClient.invalidateQueries({
				queryKey: settingsQueryKey,
				exact: true
			}),
			queryClient.invalidateQueries({ queryKey: lifecycleQueryKey }),
			queryClient.invalidateQueries({
				queryKey: versionsQueryKey
			}),
			queryClient.invalidateQueries({
				queryKey: runtimeStatusQueryKey
			}),
			queryClient.invalidateQueries({
				queryKey: analyticsQueryKey
			})
		])

	const publishMutation = useMutation({
		mutationFn: () => {
			if (!lifecycleQuery.data) {
				throw new Error('Состояние черновика ещё не загружено')
			}

			return isAdminMode
				? adminWidgetsService.publish(
						adminType,
						id,
						lifecycleQuery.data.draftRevision
					)
				: widgetExperienceService.publish(
						type,
						id,
						lifecycleQuery.data.draftRevision
					)
		},
		onMutate: () => toast.loading('Публикуем виджет…'),
		onSuccess: async (published, _, toastId) => {
			queryClient.setQueryData(lifecycleQueryKey, published)
			await refreshWidgetQueries()
			toast.success('Настройки виджета опубликованы', { id: toastId })
		},
		onError: (mutationError, _, toastId) => {
			if ((mutationError as any)?.response?.status === 409) {
				void handleRevisionConflict()
			}
			toast.error(
				errorCatch(mutationError) ||
					'Не удалось опубликовать виджет. Обновите страницу и повторите.',
				{ id: toastId }
			)
		}
	})

	const discardMutation = useMutation({
		mutationFn: () => {
			if (!lifecycleQuery.data) {
				throw new Error('Состояние черновика ещё не загружено')
			}

			return isAdminMode
				? adminWidgetsService.discardDraft(
						adminType,
						id,
						lifecycleQuery.data.draftRevision
					)
				: widgetExperienceService.discardDraft(
						type,
						id,
						lifecycleQuery.data.draftRevision
					)
		},
		onMutate: () => toast.loading('Возвращаем опубликованные настройки…'),
		onSuccess: async (discarded, _, toastId) => {
			queryClient.setQueryData(lifecycleQueryKey, discarded)
			setEditorResetKey(current => current + 1)
			await refreshWidgetQueries()
			toast.success('Изменения черновика отменены', { id: toastId })
		},
		onError: (mutationError, _, toastId) => {
			if ((mutationError as any)?.response?.status === 409) {
				void handleRevisionConflict()
			}
			toast.error(
				errorCatch(mutationError) || 'Не удалось отменить изменения',
				{ id: toastId }
			)
		}
	})

	const cloneMutation = useMutation({
		mutationFn: () =>
			isAdminMode
				? adminWidgetsService.clone(adminType, id)
				: widgetExperienceService.clone(type, id),
		onMutate: () => toast.loading('Создаём независимую копию…'),
		onSuccess: async (cloned, _, toastId) => {
			await queryClient.invalidateQueries({
				queryKey: isAdminMode
					? ['admin-widgets-monitoring']
					: [source.ownerQueryKey]
			})
			toast.success(
				cloned.warning
					? `Копия создана. ${cloned.warning}`
					: 'Копия виджета создана',
				{ id: toastId, duration: cloned.warning ? 6500 : 3000 }
			)
			router.push(
				isAdminMode
					? `/admin/widgets/${cloned.type}/${cloned.id}`
					: `/cabinet/widgets/${cloned.type}/${cloned.id}`
			)
		},
		onError: (mutationError, _, toastId) => {
			toast.error(
				errorCatch(mutationError) || 'Не удалось создать копию виджета',
				{ id: toastId }
			)
		}
	})

	const restoreMutation = useMutation({
		mutationFn: (version: number) => {
			if (!lifecycleQuery.data) {
				throw new Error('Состояние черновика ещё не загружено')
			}

			return isAdminMode
				? adminWidgetsService.restoreVersion(
						adminType,
						id,
						version,
						lifecycleQuery.data.draftRevision
					)
				: widgetExperienceService.restoreVersion(
						type,
						id,
						version,
						lifecycleQuery.data.draftRevision
					)
		},
		onMutate: () =>
			toast.loading('Восстанавливаем публикацию в черновик…'),
		onSuccess: async (restored, _, toastId) => {
			queryClient.setQueryData(lifecycleQueryKey, restored)
			setEditorResetKey(current => current + 1)
			await refreshWidgetQueries()
			toast.success('Публикация восстановлена в черновик', {
				id: toastId
			})
		},
		onError: (mutationError, _, toastId) => {
			if ((mutationError as any)?.response?.status === 409) {
				void handleRevisionConflict()
			}
			toast.error(
				errorCatch(mutationError) || 'Не удалось восстановить публикацию',
				{ id: toastId }
			)
		}
	})

	useEffect(() => {
		if (!isError) return

		toast.error(
			errorCatch(error) || 'Не удалось загрузить настройки виджета',
			{ id: `widget-settings-load-${type}-${id}` }
		)
	}, [error, id, isError, type])

	useEffect(
		() => () => {
			installationCheckIdRef.current += 1
			if (installationToastIdRef.current) {
				toast.dismiss(installationToastIdRef.current)
				installationToastIdRef.current = null
			}
		},
		[]
	)

	const closeSettings = () => {
		router.push(isAdminMode ? '/admin/widgets' : '/cabinet?tab=widgets')
	}

	const expandPreview = () => {
		setIsPreviewCollapsed(false)
		window.requestAnimationFrame(() => {
			previewColumnRef.current
				?.querySelector<HTMLButtonElement>(
					'[data-preview-collapse-toggle]'
				)
				?.focus()
		})
	}

	const handleSaved = (updated: WidgetSettingsSelection['entity']) => {
		queryClient.setQueryData<WidgetLifecycleState<unknown>>(
			lifecycleQueryKey,
			current =>
				current
					? {
							...current,
							name: updated.name,
							installDomain: updated.installDomain,
							config: updated.config,
							updatedAt: updated.updatedAt,
							draftRevision: updated.draftRevision,
							hasUnpublishedChanges: true,
							status:
								current.publishedVersion > 0
									? 'CHANGES_PENDING'
									: 'DRAFT_ONLY'
						}
					: current
		)
		void refreshWidgetQueries()
	}

	const handleCheckInstallation = async () => {
		const currentStatus = runtimeStatusQuery.data
		if (!currentStatus?.installation.domain) {
			toast.error('Сначала сохраните и опубликуйте домен установки')
			return
		}
		if (isCheckingInstallation || installationToastIdRef.current) return

		const checkId = installationCheckIdRef.current + 1
		installationCheckIdRef.current = checkId
		setIsCheckingInstallation(true)
		const toastId = toast.loading('Подготавливаем проверку установки…')
		installationToastIdRef.current = toastId

		try {
			const baselineResult = await runtimeStatusQuery.refetch()
			if (installationCheckIdRef.current !== checkId) {
				toast.dismiss(toastId)
				return
			}
			if (baselineResult.error || !baselineResult.data) {
				toast.error('Не удалось начать проверку установки', {
					id: toastId
				})
				return
			}

			const baselineLastSeenAt =
				baselineResult.data.installation.lastSeenAt
			const baselineLastSeenTimestamp = baselineLastSeenAt
				? new Date(baselineLastSeenAt).getTime()
				: 0
			let consecutivePollingErrors = 0

			toast.loading(
				'Откройте страницу сайта с виджетом. Ждём новый сигнал…',
				{ id: toastId }
			)

			for (let attempt = 0; attempt < 20; attempt += 1) {
				await new Promise(resolve => window.setTimeout(resolve, 3000))
				if (installationCheckIdRef.current !== checkId) {
					toast.dismiss(toastId)
					return
				}

				const result = await runtimeStatusQuery.refetch()
				if (result.error) {
					consecutivePollingErrors += 1
					if (consecutivePollingErrors >= 3) {
						throw result.error
					}
					continue
				}
				consecutivePollingErrors = 0
				const lastSeenAt = result.data?.installation.lastSeenAt
				const lastSeenTimestamp = lastSeenAt
					? new Date(lastSeenAt).getTime()
					: 0

				if (lastSeenTimestamp > baselineLastSeenTimestamp) {
					toast.success('Установка подтверждена новым сигналом', {
						id: toastId
					})
					return
				}
			}

			toast.error(
				'Новый сигнал не получен. Проверьте домен, код установки и откройте страницу ещё раз.',
				{ id: toastId, duration: 6500 }
			)
		} catch (checkError) {
			toast.error(
				errorCatch(checkError) || 'Не удалось проверить установку',
				{ id: toastId }
			)
		} finally {
			if (installationCheckIdRef.current === checkId) {
				setIsCheckingInstallation(false)
			}
			if (installationToastIdRef.current === toastId) {
				installationToastIdRef.current = null
			}
		}
	}

	const handleRetry = async () => {
		const toastId = toast.loading('Повторно загружаем настройки...')
		const result = await refetch()

		if (result.error) {
			toast.error(
				errorCatch(result.error) ||
					'Не удалось загрузить настройки виджета',
				{ id: toastId }
			)
			return
		}

		toast.success('Настройки загружены', { id: toastId })
	}

	const handleRevisionConflict = async () => {
		const [, lifecycleResult] = await Promise.all([
			refetch(),
			lifecycleQuery.refetch()
		])
		if (lifecycleResult.error || !lifecycleResult.data) {
			throw lifecycleResult.error || new Error('Черновик не загружен')
		}

		return lifecycleResult.data.draftRevision
	}

	const canUseCustomButtonImage =
		selection?.ownerPlan === 'HARD' &&
		selection.subscriptionStatus === 'ACTIVE'
	const isLoading = !isAuthResolved || !auth || isPending

	if (isLoading) {
		return (
			<WidgetSettingsState>
				<div
					className={styles.loadingGrid}
					aria-label="Загрузка настроек"
					aria-busy="true"
				>
					<div className={styles.previewSkeleton} aria-hidden="true">
						<div className={styles.skeletonPreviewHeader}>
							<div className={styles.skeletonStack}>
								<SkeletonLoader width="58%" height={12} />
								<SkeletonLoader
									width="42%"
									height={24}
									borderRadius={999}
								/>
							</div>
							<div className={styles.skeletonControlRow}>
								<SkeletonLoader width={68} height={30} />
								<SkeletonLoader width={68} height={30} />
								<SkeletonLoader width={76} height={30} />
							</div>
						</div>
						<div className={styles.skeletonPreviewCanvas}>
							<div className={styles.skeletonPreviewDevice}>
								<SkeletonLoader width="60%" height={16} />
								<SkeletonLoader width="84%" height={10} />
								<div className={styles.skeletonPreviewFields}>
									<SkeletonLoader height={34} />
									<SkeletonLoader height={34} />
								</div>
								<SkeletonLoader
									height={34}
									containerClassName={styles.skeletonPreviewButton}
								/>
							</div>
						</div>
						<SkeletonLoader width="68%" height={10} />
					</div>
					<div className={styles.editorSkeleton} aria-hidden="true">
						<div className={styles.skeletonEditorHeader}>
							<div className={styles.skeletonStack}>
								<SkeletonLoader width="46%" height={18} />
								<SkeletonLoader width="72%" height={10} />
							</div>
							<SkeletonLoader width={92} height={34} />
						</div>
						<div className={styles.skeletonTabs}>
							<SkeletonLoader width={74} height={28} />
							<SkeletonLoader width={88} height={28} />
							<SkeletonLoader width={70} height={28} />
						</div>
						{[0, 1, 2].map(groupIndex => (
							<div key={groupIndex} className={styles.skeletonFieldGroup}>
								<SkeletonLoader width="36%" height={13} />
								<div className={styles.skeletonFieldGrid}>
									{[0, 1].map(fieldIndex => (
										<div key={fieldIndex} className={styles.skeletonField}>
											<SkeletonLoader width="44%" height={9} />
											<SkeletonLoader height={36} />
										</div>
									))}
								</div>
							</div>
						))}
						<div className={styles.skeletonActions}>
							<SkeletonLoader width={112} height={38} />
							<SkeletonLoader width={92} height={38} />
						</div>
					</div>
				</div>
			</WidgetSettingsState>
		)
	}

	if (isError) {
		return (
			<WidgetSettingsState>
				<div className={styles.stateCard}>
					<h1 className={styles.stateTitle}>
						Не удалось загрузить настройки
					</h1>
					<p className={styles.stateText}>
						Проверьте подключение и попробуйте ещё раз.
					</p>
					<div className={styles.stateActions}>
						<button
							type="button"
							className={styles.primaryButton}
							onClick={() => void handleRetry()}
							disabled={isFetching}
						>
							{isFetching ? 'Загрузка...' : 'Повторить'}
						</button>
						<button
							type="button"
							className={styles.secondaryButton}
							onClick={closeSettings}
						>
							К списку виджетов
						</button>
					</div>
				</div>
			</WidgetSettingsState>
		)
	}

	if (!selection) {
		return (
			<WidgetSettingsState>
				<div className={styles.stateCard}>
					<h1 className={styles.stateTitle}>Виджет не найден</h1>
					<p className={styles.stateText}>
						Возможно, он был удалён или принадлежит другому пользователю.
					</p>
					<button
						type="button"
						className={styles.primaryButton}
						onClick={closeSettings}
					>
						К списку виджетов
					</button>
				</div>
			</WidgetSettingsState>
		)
	}

	const editorSelection = mergeLifecycleSelection(
		selection,
		lifecycleQuery.data
	)
	const editor = previewPortalTarget
		? renderWidgetEditor({
				selection: editorSelection,
				canUseCustomButtonImage,
				previewPortalTarget,
				editorResetKey,
				onClose: closeSettings,
				onSaved: handleSaved,
				onDirtyChange: setHasEditorUnsavedChanges,
				onPreviewDeviceChange: handlePreviewDeviceChange,
				onPreviewConfigChange: handlePreviewConfigChange,
				previewCollapsed: isPreviewCollapsed,
				onPreviewCollapsedChange: setIsPreviewCollapsed,
				onRevisionConflict: handleRevisionConflict,
				isAdminMode
			})
		: null

	return (
		<div
			className={`${styles.page} ${
				isPreviewCollapsed ? styles.pagePreviewCollapsed : ''
			}`}
		>
			<header className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Настройки виджета</h1>
			</header>

			<div className={styles.workspace}>
				<aside
					ref={previewColumnRef}
					id="widget-settings-preview"
					className={`${styles.previewColumn} ${
						isPreviewCollapsed ? styles.previewColumnCollapsed : ''
					}`}
					aria-label="Предпросмотр виджета"
				>
					<div
						ref={setPreviewPortalTarget}
						className={styles.previewPortalTarget}
					/>
				</aside>

				<section
					className={styles.editorColumn}
					aria-label="Параметры виджета"
				>
					{isPreviewCollapsed && (
						<div className={styles.previewRestoreBar}>
							<button
								ref={previewRestoreButtonRef}
								type="button"
								className={styles.previewRestoreButton}
								onClick={expandPreview}
								aria-controls="widget-settings-preview"
								aria-expanded="false"
							>
								Развернуть предпросмотр
							</button>
						</div>
					)}

					<WidgetExperiencePanel
						lifecycle={lifecycleQuery.data}
						runtimeStatus={runtimeStatusQuery.data}
						analytics={analyticsQuery.data}
						canUseAnalytics={canUseAnalytics}
						analyticsUnavailableMessage={analyticsUnavailableMessage}
						versions={versionsQuery.data}
						isRuntimeStatusError={runtimeStatusQuery.isError}
						isAnalyticsError={analyticsQuery.isError}
						isVersionsError={versionsQuery.isError}
						versionsPage={versionsPage}
						isLoading={lifecycleQuery.isPending}
						isPublishing={publishMutation.isPending}
						isDiscarding={discardMutation.isPending}
						isCloning={cloneMutation.isPending}
						isRestoring={restoreMutation.isPending}
						isCheckingInstallation={isCheckingInstallation}
						hasLocalChanges={hasEditorUnsavedChanges}
						hasReviewedMobilePreview={hasReviewedMobilePreview}
						onPublish={() => publishMutation.mutate()}
						onDiscard={() => discardMutation.mutate()}
						onClone={() => cloneMutation.mutate()}
						onRestore={version => restoreMutation.mutate(version)}
						onCheckInstallation={() => void handleCheckInstallation()}
						onVersionsPageChange={setVersionsPage}
					/>
					{editor}
				</section>
			</div>
		</div>
	)
}

interface WidgetEditorRendererProps {
	selection: WidgetSettingsSelection
	canUseCustomButtonImage: boolean
	previewPortalTarget: HTMLElement
	editorResetKey: number
	onClose: () => void
	onSaved: (updated: WidgetSettingsSelection['entity']) => void
	onDirtyChange: (hasUnsavedChanges: boolean) => void
	onPreviewDeviceChange: (device: 'desktop' | 'mobile') => void
	onPreviewConfigChange: () => void
	previewCollapsed: boolean
	onPreviewCollapsedChange: (isCollapsed: boolean) => void
	onRevisionConflict: () => Promise<number | null>
	isAdminMode: boolean
}

const mergeLifecycleSelection = (
	selection: WidgetSettingsSelection,
	lifecycle?: WidgetLifecycleState<unknown>
): WidgetSettingsSelection => {
	if (!lifecycle) return selection

	return {
		...selection,
		entity: {
			...selection.entity,
			name: lifecycle.name,
			publicKey: lifecycle.publicKey,
			isActive: lifecycle.isActive,
			installDomain: lifecycle.installDomain,
			config: lifecycle.config,
			draftRevision: lifecycle.draftRevision,
			createdAt: lifecycle.createdAt,
			updatedAt: lifecycle.updatedAt
		}
	} as unknown as WidgetSettingsSelection
}

const renderWidgetEditor = ({
	selection,
	canUseCustomButtonImage,
	previewPortalTarget,
	editorResetKey,
	onClose,
	onSaved,
	onDirtyChange,
	onPreviewDeviceChange,
	onPreviewConfigChange,
	previewCollapsed,
	onPreviewCollapsedChange,
	onRevisionConflict,
	isAdminMode
}: WidgetEditorRendererProps) => {
	switch (selection.type) {
		case 'wheel':
			return (
				<WheelSettingsModal
					key={editorResetKey}
					widget={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update('WHEEL', selection.entity.id, payload)
											.then(response => response.entity),
									uploadButtonImage: file =>
										adminWidgetsService
											.uploadButtonImage(
												'WHEEL',
												selection.entity.id,
												file
											)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'quiz':
			return (
				<QuizSettingsModal
					key={editorResetKey}
					quiz={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update('QUIZ', selection.entity.id, payload)
											.then(response => response.entity),
									uploadButtonImage: file =>
										adminWidgetsService
											.uploadButtonImage('QUIZ', selection.entity.id, file)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'callback':
			return (
				<CallbackSettingsModal
					key={editorResetKey}
					callback={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update('CALLBACK', selection.entity.id, payload)
											.then(response => response.entity),
									uploadButtonImage: file =>
										adminWidgetsService
											.uploadButtonImage(
												'CALLBACK',
												selection.entity.id,
												file
											)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'timer':
			return (
				<CountdownTimerSettingsModal
					key={editorResetKey}
					timer={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update('TIMER', selection.entity.id, payload)
											.then(response => response.entity),
									uploadButtonImage: file =>
										adminWidgetsService
											.uploadButtonImage(
												'TIMER',
												selection.entity.id,
												file
											)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'stop-offer':
			return (
				<StopOfferSettingsModal
					key={editorResetKey}
					stopOffer={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update('STOP_OFFER', selection.entity.id, payload)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'ai-consultant':
			return (
				<AiConsultantSettingsModal
					key={editorResetKey}
					aiConsultant={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update(
												'AI_CONSULTANT',
												selection.entity.id,
												payload
											)
											.then(response => response.entity),
									uploadButtonImage: file =>
										adminWidgetsService
											.uploadButtonImage(
												'AI_CONSULTANT',
												selection.entity.id,
												file
											)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'calculator':
			return (
				<CalculatorSettingsModal
					key={editorResetKey}
					calculator={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onPreviewDeviceChange={onPreviewDeviceChange}
					onPreviewConfigChange={onPreviewConfigChange}
					previewCollapsed={previewCollapsed}
					onPreviewCollapsedChange={onPreviewCollapsedChange}
					onRevisionConflict={onRevisionConflict}
					persistence={
						isAdminMode
							? {
									update: payload =>
										adminWidgetsService
											.update('CALCULATOR', selection.entity.id, payload)
											.then(response => response.entity),
									uploadButtonImage: file =>
										adminWidgetsService
											.uploadButtonImage(
												'CALCULATOR',
												selection.entity.id,
												file
											)
											.then(response => response.entity)
								}
							: undefined
					}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
	}
}

const WidgetSettingsState = ({
	children
}: {
	children: React.ReactNode
}) => <div className={styles.statePage}>{children}</div>

export default WidgetSettings
