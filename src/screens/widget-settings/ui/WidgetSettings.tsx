'use client'

import type { Subscription } from '@/entities/subscription'
import {
	calculatorService,
	callbackService,
	countdownTimerService,
	onlineConsultantService,
	quizService,
	stopOfferService,
	widgetService
} from '@/entities/site-widget'
import type {
	Calculator,
	Callback,
	CountdownTimer,
	OnlineConsultant,
	Quiz,
	StopOffer,
	Widget
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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
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

	const closeSettings = () => {
		router.push('/cabinet?tab=widgets')
	}

	const handleSaved = () => {
		void queryClient.invalidateQueries({
			queryKey: [source.ownerQueryKey]
		})
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

	const editor = previewPortalTarget
		? renderWidgetEditor({
				selection,
				canUseCustomButtonImage,
				previewPortalTarget,
				onClose: closeSettings,
				onSaved: handleSaved
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
					Изменения сразу отображаются в предпросмотре слева.
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
	onClose: () => void
	onSaved: () => void
}

const renderWidgetEditor = ({
	selection,
	canUseCustomButtonImage,
	previewPortalTarget,
	onClose,
	onSaved
}: WidgetEditorRendererProps) => {
	switch (selection.type) {
		case 'wheel':
			return (
				<WheelSettingsModal
					widget={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'quiz':
			return (
				<QuizSettingsModal
					quiz={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'callback':
			return (
				<CallbackSettingsModal
					callback={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'timer':
			return (
				<CountdownTimerSettingsModal
					timer={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'stop-offer':
			return (
				<StopOfferSettingsModal
					stopOffer={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'online-consultant':
			return (
				<OnlineConsultantSettingsModal
					onlineConsultant={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
					presentation="page"
					previewPortalTarget={previewPortalTarget}
				/>
			)
		case 'calculator':
			return (
				<CalculatorSettingsModal
					calculator={selection.entity}
					canUseCustomButtonImage={canUseCustomButtonImage}
					onClose={onClose}
					onSaved={onSaved}
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
