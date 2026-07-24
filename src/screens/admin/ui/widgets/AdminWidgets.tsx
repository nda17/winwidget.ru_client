'use client'

import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import { errorCatch } from '@/shared/api'
import {
	adminWidgetsService,
	AdminWidgetActiveFilter,
	AdminWidgetDetails,
	AdminWidgetPlanFilter,
	AdminWidgetType,
	IAdminWidgetMonitoringFilters,
	IAdminWidgetMonitoringItem
} from '@/features/manage-widgets'
import type { Plan, SubscriptionStatus } from '@/entities/subscription'
import { useAuthStore } from '@/entities/user'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import clsx from 'clsx'
import { NextPage } from 'next'
import { FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import AdminWidgetEditor from './AdminWidgetEditor'
import styles from './AdminWidgets.module.scss'

const TYPE_LABELS: Record<AdminWidgetType, string> = {
	WHEEL: 'Колесо',
	QUIZ: 'Квиз',
	CALLBACK: 'Обратный звонок',
	TIMER: 'Таймер',
	STOP_OFFER: 'Стоп-оффер',
	ONLINE_CONSULTANT: 'Онлайн-консультант',
	CALCULATOR: 'Калькулятор'
}

const PLAN_LABELS: Record<Plan, string> = {
	TRIAL: 'Trial',
	EASY: 'Easy',
	HARD: 'Hard'
}

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
	ACTIVE: 'Активна',
	EXPIRED: 'Истекла',
	CANCELLED: 'Отменена'
}

type WidgetTypeFilter = AdminWidgetType | 'ALL'
type WidgetActiveFilter = AdminWidgetActiveFilter | 'ALL'
type WidgetPlanFilter = AdminWidgetPlanFilter | 'ALL'

interface WidgetFilterDraft {
	type: WidgetTypeFilter
	isActive: WidgetActiveFilter
	plan: WidgetPlanFilter
	search: string
}

interface AdminWidgetEditorState {
	details: AdminWidgetDetails
	ownerPlan: Plan | null
	subscriptionStatus: SubscriptionStatus | null
}

const DEFAULT_FILTERS: WidgetFilterDraft = {
	type: 'ALL',
	isActive: 'ALL',
	plan: 'ALL',
	search: ''
}

const TYPE_FILTER_OPTIONS: Array<{
	value: WidgetTypeFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все типы' },
	{ value: 'WHEEL', label: TYPE_LABELS.WHEEL },
	{ value: 'QUIZ', label: TYPE_LABELS.QUIZ },
	{ value: 'CALLBACK', label: TYPE_LABELS.CALLBACK },
	{ value: 'TIMER', label: TYPE_LABELS.TIMER },
	{ value: 'STOP_OFFER', label: TYPE_LABELS.STOP_OFFER },
	{ value: 'ONLINE_CONSULTANT', label: TYPE_LABELS.ONLINE_CONSULTANT },
	{ value: 'CALCULATOR', label: TYPE_LABELS.CALCULATOR }
]

const ACTIVE_FILTER_OPTIONS: Array<{
	value: WidgetActiveFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все статусы' },
	{ value: 'true', label: 'Активные' },
	{ value: 'false', label: 'Отключённые' }
]

const PLAN_FILTER_OPTIONS: Array<{
	value: WidgetPlanFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все тарифы' },
	{ value: 'TRIAL', label: PLAN_LABELS.TRIAL },
	{ value: 'EASY', label: PLAN_LABELS.EASY },
	{ value: 'HARD', label: PLAN_LABELS.HARD },
	{ value: 'NONE', label: 'Без подписки' }
]

const normalizeFilters = (
	draft: WidgetFilterDraft
): IAdminWidgetMonitoringFilters => ({
	type: draft.type === 'ALL' ? undefined : draft.type,
	isActive: draft.isActive === 'ALL' ? undefined : draft.isActive,
	plan: draft.plan === 'ALL' ? undefined : draft.plan,
	search: draft.search.trim() || undefined
})

const hasActiveFilters = (filters: IAdminWidgetMonitoringFilters) =>
	Object.values(filters).some(Boolean)

const formatDateTime = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(new Date(value))

const formatOptionalDateTime = (value: string | null) =>
	value ? formatDateTime(value) : '—'

const formatOwner = (item: IAdminWidgetMonitoringItem) =>
	item.owner.name || item.owner.email || item.owner.phone || item.owner.id

const formatOwnerContact = (item: IAdminWidgetMonitoringItem) =>
	item.owner.email || item.owner.phone || item.owner.id

const getWidgetKey = (
	item: Pick<IAdminWidgetMonitoringItem, 'type' | 'id'>
) => `${item.type}:${item.id}`

const getDetailsQueryKey = (type: AdminWidgetType, id: string) =>
	['admin-widget-details', type, id] as const

const AdminWidgets: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [currentPage, setCurrentPage] = useState(1)
	const [filterDraft, setFilterDraft] = useState(DEFAULT_FILTERS)
	const [filters, setFilters] = useState<IAdminWidgetMonitoringFilters>({})
	const [editor, setEditor] = useState<AdminWidgetEditorState | null>(null)
	const [loadingEditorKey, setLoadingEditorKey] = useState<string | null>(
		null
	)
	const itemQuantity = 20

	const { data, isLoading, isFetching } = useQuery({
		queryKey: [
			'admin-widgets-monitoring',
			currentPage,
			itemQuantity,
			filters
		],
		queryFn: () =>
			adminWidgetsService.getMonitoring(
				currentPage,
				itemQuantity,
				filters
			),
		enabled: auth
	})

	const activityMutation = useMutation({
		mutationFn: ({
			item,
			isActive
		}: {
			item: IAdminWidgetMonitoringItem
			isActive: boolean
		}) =>
			adminWidgetsService.update(item.type, item.id, {
				isActive
			}),
		onMutate: ({ isActive }) =>
			toast.loading(
				isActive ? 'Включаем виджет...' : 'Отключаем виджет...'
			),
		onSuccess: (response, variables, toastId) => {
			queryClient.invalidateQueries({
				queryKey: ['admin-widgets-monitoring']
			})
			queryClient.invalidateQueries({
				queryKey: getDetailsQueryKey(
					variables.item.type,
					variables.item.id
				)
			})
			toast.success(
				response.entity.isActive ? 'Виджет включён' : 'Виджет отключён',
				{ id: toastId }
			)
		},
		onError: (error, _, toastId) => {
			toast.error(errorCatch(error) || 'Не удалось изменить статус', {
				id: toastId
			})
		}
	})

	const totalPages = data?.totalPages ?? 1
	const listPage = Array.from(
		{ length: totalPages },
		(_, index) => index + 1
	)
	const emptyListText = !hasActiveFilters(filters)
		? 'Виджетов пока нет'
		: 'Виджетов с такими фильтрами нет'

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const applyFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setFilters(normalizeFilters(filterDraft))
		setCurrentPage(1)
		toast.success('Фильтры виджетов применены')
	}

	const resetFilters = () => {
		setFilterDraft(DEFAULT_FILTERS)
		setFilters({})
		setCurrentPage(1)
		toast.success('Фильтры виджетов сброшены')
	}

	const prevPage = () => setCurrentPage(page => Math.max(1, page - 1))
	const nextPage = () =>
		setCurrentPage(page => Math.min(totalPages, page + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)

	const openEditor = async (item: IAdminWidgetMonitoringItem) => {
		if (loadingEditorKey) return

		const widgetKey = getWidgetKey(item)
		const toastId = toast.loading('Загружаем настройки виджета...')
		setLoadingEditorKey(widgetKey)

		try {
			const details = await queryClient.fetchQuery({
				queryKey: getDetailsQueryKey(item.type, item.id),
				queryFn: () => adminWidgetsService.getById(item.type, item.id)
			})
			setEditor({
				details,
				ownerPlan: item.ownerPlan,
				subscriptionStatus: item.subscriptionStatus
			})
			toast.dismiss(toastId)
		} catch (error) {
			toast.error(errorCatch(error) || 'Не удалось загрузить настройки', {
				id: toastId
			})
		} finally {
			setLoadingEditorKey(current =>
				current === widgetKey ? null : current
			)
		}
	}

	const handleEditorSaved = (details: AdminWidgetDetails) => {
		setEditor(current => {
			if (
				!current ||
				current.details.type !== details.type ||
				current.details.entity.id !== details.entity.id
			) {
				return current
			}

			return { ...current, details }
		})
		queryClient.setQueryData(
			getDetailsQueryKey(details.type, details.entity.id),
			details
		)
		queryClient.invalidateQueries({
			queryKey: ['admin-widgets-monitoring']
		})
	}

	const isActivityPending = (item: IAdminWidgetMonitoringItem) =>
		activityMutation.isPending &&
		activityMutation.variables?.item.type === item.type &&
		activityMutation.variables.item.id === item.id

	const renderPlan = (item: IAdminWidgetMonitoringItem) =>
		item.ownerPlan ? (
			<span
				className={clsx(
					styles.badge,
					styles[`badge-${item.ownerPlan.toLowerCase()}`]
				)}
			>
				{PLAN_LABELS[item.ownerPlan]}
			</span>
		) : (
			'—'
		)

	const renderStatus = (item: IAdminWidgetMonitoringItem) => (
		<span
			className={clsx(styles.status, {
				[styles['status-active']]: item.isActive,
				[styles['status-inactive']]: !item.isActive
			})}
		>
			{item.isActive ? 'Активен' : 'Отключён'}
		</span>
	)

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Виджеты"
				title="Мониторинг и редактирование виджетов"
				description="Показывает все виджеты пользователей и позволяет администраторам изменять их настройки и активность."
				risk="medium"
				riskText="Изменения сразу влияют на работающий виджет пользователя. Перед сохранением проверьте владельца, домен и интеграции."
			/>

			<form className={styles.filters} onSubmit={applyFilters}>
				<div className={styles['filter-grid']}>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Тип</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.type}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									type: event.target.value as WidgetTypeFilter
								}))
							}
						>
							{TYPE_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Активность</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.isActive}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									isActive: event.target.value as WidgetActiveFilter
								}))
							}
						>
							{ACTIVE_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Тариф</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.plan}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									plan: event.target.value as WidgetPlanFilter
								}))
							}
						>
							{PLAN_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Поиск</span>
						<input
							className={styles['filter-input']}
							value={filterDraft.search}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									search: event.target.value
								}))
							}
							placeholder="Название, домен, владелец, public key"
						/>
					</label>
				</div>
				<div className={styles['filter-actions']}>
					<button type="submit" className={styles['filter-apply']}>
						Применить
					</button>
					<button
						type="button"
						className={styles['filter-reset']}
						onClick={resetFilters}
					>
						Сбросить
					</button>
				</div>
			</form>

			{isLoading ? (
				<div className={styles.card}>
					{Array.from({ length: 6 }).map((_, index) => (
						<SkeletonLoader
							key={index}
							count={1}
							className={styles.skeletonRow}
						/>
					))}
				</div>
			) : data ? (
				<div className={styles['list-section']}>
					<div className={styles['list-meta']}>
						<div>
							<p className={styles['meta-title']}>Все виджеты</p>
							<p className={styles['meta-subtitle']}>
								Всего записей: {data.total}
							</p>
						</div>
						<p className={styles['meta-subtitle']}>
							{isFetching
								? 'Обновляем...'
								: `Страница ${data.page} из ${data.totalPages}`}
						</p>
					</div>

					{data.items.length ? (
						<>
							<div className={styles['mobile-list']}>
								{data.items.map(item => {
									const isEditorLoading =
										loadingEditorKey === getWidgetKey(item)
									const isStatusUpdating = isActivityPending(item)

									return (
										<div
											className={styles.widgetCard}
											key={getWidgetKey(item)}
										>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Тип</span>
												<span className={styles.cardValue}>
													{TYPE_LABELS[item.type]}
												</span>
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Название</span>
												<span className={styles.cardValue}>
													{item.name}
												</span>
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Владелец</span>
												<span className={styles.cardValue}>
													{formatOwner(item)}
													<span className={styles.cardExtra}>
														{formatOwnerContact(item)}
													</span>
												</span>
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Статус</span>
												{renderStatus(item)}
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Заявки</span>
												<span className={styles.cardValue}>
													{item.leadCount}
												</span>
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>
													Последняя заявка
												</span>
												<span className={styles.cardValue}>
													{formatOptionalDateTime(item.lastLeadAt)}
												</span>
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Тариф</span>
												<span className={styles.cardValue}>
													{renderPlan(item)}
												</span>
											</div>
											<div className={styles.cardRow}>
												<span className={styles.cardLabel}>Домен</span>
												<span className={styles.cardValue}>
													{item.installDomain || '—'}
												</span>
											</div>
											<div className={styles.cardActions}>
												<button
													type="button"
													className={styles.actionButton}
													onClick={() =>
														activityMutation.mutate({
															item,
															isActive: !item.isActive
														})
													}
													disabled={activityMutation.isPending}
												>
													{isStatusUpdating
														? 'Обновляем...'
														: item.isActive
															? 'Отключить'
															: 'Включить'}
												</button>
												<button
													type="button"
													className={styles.actionButtonPrimary}
													onClick={() => openEditor(item)}
													disabled={loadingEditorKey !== null}
												>
													{isEditorLoading
														? 'Загружаем...'
														: 'Редактировать'}
												</button>
											</div>
										</div>
									)
								})}
							</div>

							<div className={styles['table-scroll']}>
								<table className={styles.table}>
									<caption className="srOnly">
										Админский мониторинг всех виджетов
									</caption>
									<thead>
										<tr>
											<th scope="col">Тип</th>
											<th scope="col">Виджет</th>
											<th scope="col">Владелец</th>
											<th scope="col">Статус</th>
											<th scope="col">Заявки</th>
											<th scope="col">Последняя заявка</th>
											<th scope="col">Тариф</th>
											<th scope="col">Домен</th>
											<th scope="col">Действия</th>
										</tr>
									</thead>
									<tbody>
										{data.items.map(item => {
											const isEditorLoading =
												loadingEditorKey === getWidgetKey(item)
											const isStatusUpdating = isActivityPending(item)

											return (
												<tr key={getWidgetKey(item)}>
													<td>{TYPE_LABELS[item.type]}</td>
													<td>
														<div className={styles.widgetCell}>
															<span>{item.name}</span>
															<span className={styles.muted}>
																{item.publicKey}
															</span>
														</div>
													</td>
													<td>
														<div className={styles.widgetCell}>
															<span>{formatOwner(item)}</span>
															<span className={styles.muted}>
																{formatOwnerContact(item)}
															</span>
														</div>
													</td>
													<td>{renderStatus(item)}</td>
													<td>{item.leadCount}</td>
													<td>
														{formatOptionalDateTime(item.lastLeadAt)}
													</td>
													<td>
														<div className={styles.widgetCell}>
															{renderPlan(item)}
															{item.subscriptionStatus && (
																<span className={styles.muted}>
																	{
																		SUBSCRIPTION_STATUS_LABELS[
																			item.subscriptionStatus
																		]
																	}
																</span>
															)}
														</div>
													</td>
													<td>
														<span className={styles.domainValue}>
															{item.installDomain || '—'}
														</span>
													</td>
													<td>
														<div className={styles.tableActions}>
															<button
																type="button"
																className={styles.actionButton}
																onClick={() =>
																	activityMutation.mutate({
																		item,
																		isActive: !item.isActive
																	})
																}
																disabled={activityMutation.isPending}
															>
																{isStatusUpdating
																	? 'Обновляем...'
																	: item.isActive
																		? 'Отключить'
																		: 'Включить'}
															</button>
															<button
																type="button"
																className={styles.actionButtonPrimary}
																onClick={() => openEditor(item)}
																disabled={loadingEditorKey !== null}
															>
																{isEditorLoading
																	? 'Загружаем...'
																	: 'Редактировать'}
															</button>
														</div>
													</td>
												</tr>
											)
										})}
									</tbody>
								</table>
							</div>

							{data.total > itemQuantity && (
								<Pagination
									listPage={listPage}
									currentPage={currentPage}
									prevPage={prevPage}
									nextPage={nextPage}
									changeActivePage={changeActivePage}
								/>
							)}
						</>
					) : (
						<div className={styles.emptyState}>
							<p className={styles['meta-subtitle']}>{emptyListText}</p>
						</div>
					)}
				</div>
			) : (
				<div className={styles.card}>
					<p className={styles['meta-subtitle']}>Виджетов пока нет</p>
				</div>
			)}

			{editor && (
				<AdminWidgetEditor
					details={editor.details}
					ownerPlan={editor.ownerPlan}
					subscriptionStatus={editor.subscriptionStatus}
					onClose={() => setEditor(null)}
					onSaved={handleEditorSaved}
				/>
			)}
		</section>
	)
}

export default AdminWidgets
