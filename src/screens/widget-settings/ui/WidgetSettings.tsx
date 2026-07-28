'use client'

import type { Subscription } from '@/entities/subscription'
import {
	calculatorService,
	callbackService,
	countdownTimerService,
	onlineConsultantService,
	quizService,
	stopOfferService,
	widgetExperienceService,
	widgetService
} from '@/entities/site-widget'
import type {
	Calculator,
	Callback,
	CountdownTimer,
	OnlineConsultant,
	Quiz,
	StopOffer,
	Widget,
	WidgetLifecycleState
} from '@/entities/site-widget'
import { useAuthStore } from '@/entities/user'
import {
	CalculatorSettingsModal,
	CallbackSettingsModal,
	CountdownTimerSettingsModal,
	OnlineConsultantSettingsModal,
	QuizSettingsModal,
	StopOfferSettingsModal,
	WheelSettingsModal
} from '@/features/edit-widget-settings'
import { errorCatch } from '@/shared/api'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import WidgetExperiencePanel from './WidgetExperiencePanel'
import styles from './WidgetSettings.module.scss'

const WIDGET_SETTINGS_TYPES = [
	'wheel',
	'quiz',
	'callback',
	'timer',
	'stop-offer',
	'online-consultant',
	'calculator'
] as const

export type WidgetSettingsType = (typeof WIDGET_SETTINGS_TYPES)[number]

type WidgetSettingsSelection =
	| {
			type: 'wheel'
			entity: Widget
			subscription: Subscription | null
	  }
	| {
			type: 'quiz'
			entity: Quiz
			subscription: Subscription | null
	  }
	| {
			type: 'callback'
			entity: Callback
			subscription: Subscription | null
	  }
	| {
			type: 'timer'
			entity: CountdownTimer
			subscription: Subscription | null
	  }
	| {
			type: 'stop-offer'
			entity: StopOffer
			subscription: Subscription | null
	  }
	| {
			type: 'online-consultant'
			entity: OnlineConsultant
			subscription: Subscription | null
	  }
	| {
			type: 'calculator'
			entity: Calculator
			subscription: Subscription | null
	  }

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
				? { type: 'wheel', entity, subscription: data.subscription }
				: null
		}
	},
	quiz: {
		ownerQueryKey: 'quizzes',
		load: async id => {
			const data = await quizService.getMyQuizzes()
			const entity = data.quizzes.find(quiz => quiz.id === id)

			return entity
				? { type: 'quiz', entity, subscription: data.subscription }
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
						subscription: data.subscription
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
				? { type: 'timer', entity, subscription: data.subscription }
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
						subscription: data.subscription
					}
				: null
		}
	},
	'online-consultant': {
		ownerQueryKey: 'online-consultants',
		load: async id => {
			const data = await onlineConsultantService.getMyOnlineConsultants()
			const entity = data.onlineConsultants.find(
				consultant => consultant.id === id
			)

			return entity
				? {
						type: 'online-consultant',
						entity,
						subscription: data.subscription
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
						subscription: data.subscription
					}
				: null
		}
	}
}

const WIDGET_TYPE_LABELS: Record<WidgetSettingsType, string> = {
	wheel: 'Колесо фортуны',
	quiz: 'Квиз',
	callback: 'Обратный звонок',
	timer: 'Таймер',
	'stop-offer': 'Стоп-оффер',
	'online-consultant': 'Онлайн-консультант',
	calculator: 'Калькулятор стоимости'
}

const TWO_COLUMN_SETTINGS_MEDIA_QUERY = '(min-width: 1101px)'

interface WidgetSettingsProps {
	type: WidgetSettingsType
	id: string
}

const WidgetSettings = ({ type, id }: WidgetSettingsProps) => {
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
	const [isCheckingInstallation, setIsCheckingInstallation] =
		useState(false)
	const installationCheckIdRef = useRef(0)
	const installationToastIdRef = useRef<string | null>(null)
	const previewColumnRef = useRef<HTMLElement | null>(null)
	const editorColumnRef = useRef<HTMLElement | null>(null)
	const source = WIDGET_SETTINGS_SOURCES[type]
	const settingsQueryKey = [
		source.ownerQueryKey,
		'settings-page',
		id
	] as const
	const {
		data: selection,
		error,
		isError,
		isFetching,
		isPending,
		refetch
	} = useQuery({
		queryKey: settingsQueryKey,
		queryFn: () => source.load(id),
		enabled: isAuthResolved && auth
	})
	const canUseAnalytics =
		selection?.subscription?.plan === 'HARD' &&
		selection.subscription.status === 'ACTIVE'
	const lifecycleQueryKey = ['widget-settings', type, id] as const
	const lifecycleQuery = useQuery({
		queryKey: lifecycleQueryKey,
		queryFn: () => widgetExperienceService.getLifecycle(type, id),
		enabled: isAuthResolved && auth
	})
	const runtimeStatusQuery = useQuery({
		queryKey: ['widget-runtime-status', type, id],
		queryFn: () => widgetExperienceService.getRuntimeStatus(type, id),
		enabled: isAuthResolved && auth,
		retry: 1
	})
	const analyticsQuery = useQuery({
		queryKey: ['widget-runtime-analytics', type, id, 30],
		queryFn: () => widgetExperienceService.getAnalytics(type, id, 30),
		enabled: isAuthResolved && Boolean(auth) && canUseAnalytics,
		retry: 1
	})
	const versionsQuery = useQuery({
		queryKey: ['widget-settings-versions', type, id, versionsPage],
		queryFn: () =>
			widgetExperienceService.getVersions(type, id, versionsPage, 10),
		enabled: isAuthResolved && auth,
		placeholderData: previous => previous
	})

	const refreshWidgetQueries = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: [source.ownerQueryKey] }),
			queryClient.invalidateQueries({ queryKey: lifecycleQueryKey }),
			queryClient.invalidateQueries({
				queryKey: ['widget-settings-versions', type, id]
			}),
			queryClient.invalidateQueries({
				queryKey: ['widget-runtime-status', type, id]
			}),
			queryClient.invalidateQueries({
				queryKey: ['widget-runtime-analytics', type, id]
			})
		])

	const publishMutation = useMutation({
		mutationFn: () => {
			if (!lifecycleQuery.data) {
				throw new Error('Состояние черновика ещё не загружено')
			}

			return widgetExperienceService.publish(
				type,
				id,
				lifecycleQuery.data.draftRevision
			)
		},
		onMutate: () => toast.loading('Публикуем виджет…'),
		onSuccess: async (published, _, toastId) => {
			queryClient.setQueryData(lifecycleQueryKey, published)
			await refreshWidgetQueries()
			toast.success('Новая версия опубликована', { id: toastId })
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

			return widgetExperienceService.discardDraft(
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
		mutationFn: () => widgetExperienceService.clone(type, id),
		onMutate: () => toast.loading('Создаём независимую копию…'),
		onSuccess: async (cloned, _, toastId) => {
			await queryClient.invalidateQueries({
				queryKey: [source.ownerQueryKey]
			})
			toast.success(
				cloned.warning
					? `Копия создана. ${cloned.warning}`
					: 'Копия виджета создана',
				{ id: toastId, duration: cloned.warning ? 6500 : 3000 }
			)
			router.push(`/cabinet/widgets/${cloned.type}/${cloned.id}`)
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

			return widgetExperienceService.restoreVersion(
				type,
				id,
				version,
				lifecycleQuery.data.draftRevision
			)
		},
		onMutate: version =>
			toast.loading(`Восстанавливаем версию ${version} в черновик…`),
		onSuccess: async (restored, _, toastId) => {
			queryClient.setQueryData(lifecycleQueryKey, restored)
			setEditorResetKey(current => current + 1)
			await refreshWidgetQueries()
			toast.success('Версия восстановлена в черновик', { id: toastId })
		},
		onError: (mutationError, _, toastId) => {
			if ((mutationError as any)?.response?.status === 409) {
				void handleRevisionConflict()
			}
			toast.error(
				errorCatch(mutationError) || 'Не удалось восстановить версию',
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

	useEffect(() => {
		const previewColumn = previewColumnRef.current
		const editorColumn = editorColumnRef.current

		if (!previewPortalTarget || !previewColumn || !editorColumn) return

		const twoColumnSettings = window.matchMedia(
			TWO_COLUMN_SETTINGS_MEDIA_QUERY
		)

		const syncPreviewHeight = () => {
			if (!twoColumnSettings.matches) {
				previewColumn.style.removeProperty('height')
				previewPortalTarget.dataset.constrainPreviewHeight = 'false'
				return
			}

			const editorHeight = editorColumn.getBoundingClientRect().height

			if (editorHeight > 0) {
				previewColumn.style.height = `${editorHeight}px`
				previewPortalTarget.dataset.constrainPreviewHeight = 'true'
			}
		}

		syncPreviewHeight()
		window.addEventListener('resize', syncPreviewHeight)
		twoColumnSettings.addEventListener('change', syncPreviewHeight)

		const resizeObserver =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(syncPreviewHeight)

		resizeObserver?.observe(editorColumn)

		return () => {
			window.removeEventListener('resize', syncPreviewHeight)
			twoColumnSettings.removeEventListener('change', syncPreviewHeight)
			resizeObserver?.disconnect()
			previewColumn.style.removeProperty('height')
			delete previewPortalTarget.dataset.constrainPreviewHeight
		}
	}, [previewPortalTarget])

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
		router.push('/cabinet?tab=widgets')
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
		void Promise.all([
			queryClient.invalidateQueries({
				queryKey: [source.ownerQueryKey]
			}),
			queryClient.invalidateQueries({
				queryKey: lifecycleQueryKey
			})
		])
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
		selection?.subscription?.plan === 'HARD' &&
		selection.subscription.status === 'ACTIVE'
	const isLoading = !isAuthResolved || !auth || isPending

	if (isLoading) {
		return (
			<WidgetSettingsState>
				<div className={styles.loadingGrid} aria-label="Загрузка настроек">
					<div className={styles.previewSkeleton}>
						<SkeletonLoader count={1} className="h-full w-full" />
					</div>
					<div className={styles.editorSkeleton}>
						<SkeletonLoader count={1} className="h-full w-full" />
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
				onRevisionConflict: handleRevisionConflict
			})
		: null

	return (
		<div className={styles.page}>
			<header className={styles.pageHeader}>
				<p className={styles.eyebrow}>Настройки виджета</p>
				<h1 className={styles.pageTitle}>
					{selection.entity.name || WIDGET_TYPE_LABELS[type]}
				</h1>
				<p className={styles.pageDescription}>
					Изменения сразу видны в предпросмотре и не попадут на сайт до
					публикации.
				</p>
			</header>

			<div className={styles.workspace}>
				<aside
					ref={previewColumnRef}
					className={styles.previewColumn}
					aria-label="Предпросмотр виджета"
				>
					<div
						ref={setPreviewPortalTarget}
						className={styles.previewPortalTarget}
					/>
				</aside>

				<section
					ref={editorColumnRef}
					className={styles.editorColumn}
					aria-label="Параметры виджета"
				>
					<WidgetExperiencePanel
						lifecycle={lifecycleQuery.data}
						runtimeStatus={runtimeStatusQuery.data}
						analytics={analyticsQuery.data}
						canUseAnalytics={canUseAnalytics}
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
	onRevisionConflict: () => Promise<number | null>
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
	onRevisionConflict
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
					onRevisionConflict={onRevisionConflict}
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
					onRevisionConflict={onRevisionConflict}
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
					onRevisionConflict={onRevisionConflict}
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
					onRevisionConflict={onRevisionConflict}
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
					onRevisionConflict={onRevisionConflict}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'online-consultant':
			return (
				<OnlineConsultantSettingsModal
					key={editorResetKey}
					onlineConsultant={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					onDirtyChange={onDirtyChange}
					onRevisionConflict={onRevisionConflict}
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
					onRevisionConflict={onRevisionConflict}
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
