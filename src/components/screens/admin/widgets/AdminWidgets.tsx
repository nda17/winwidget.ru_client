'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import adminWidgetsService, {
	AdminWidgetActiveFilter,
	AdminWidgetPlanFilter,
	AdminWidgetType,
	IAdminWidgetMonitoringFilters,
	IAdminWidgetMonitoringItem
} from '@/services/admin-widgets/admin-widgets.service'
import { Plan, SubscriptionStatus } from '@/services/widget/widget.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { NextPage } from 'next'
import { FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminWidgets.module.scss'

const TYPE_LABELS: Record<AdminWidgetType, string> = {
	WHEEL: 'Колесо',
	QUIZ: 'Квиз',
	CALLBACK: 'Обратный звонок',
	TIMER: 'Таймер',
	STOP_OFFER: 'Стоп-оффер',
	ONLINE_CONSULTANT: 'Онлайн-консультант'
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
	{ value: 'ONLINE_CONSULTANT', label: TYPE_LABELS.ONLINE_CONSULTANT }
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

const AdminWidgets: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const [currentPage, setCurrentPage] = useState(1)
	const [filterDraft, setFilterDraft] = useState(DEFAULT_FILTERS)
	const [filters, setFilters] = useState<IAdminWidgetMonitoringFilters>({})
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
				title="Мониторинг виджетов"
				description="Показывает все реальные виджеты пользователей по типам: владелец, активность, последняя заявка, количество заявок и тариф владельца."
				risk="low"
				riskText="Раздел только читает данные и помогает быстро найти проблемный или неактивный виджет."
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
								{data.items.map(item => (
									<div className={styles.widgetCard} key={item.id}>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Тип</span>
											<span className={styles.cardValue}>
												{TYPE_LABELS[item.type]}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Название</span>
											<span className={styles.cardValue}>{item.name}</span>
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
									</div>
								))}
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
										</tr>
									</thead>
									<tbody>
										{data.items.map(item => (
											<tr key={item.id}>
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
												<td>{formatOptionalDateTime(item.lastLeadAt)}</td>
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
											</tr>
										))}
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
		</section>
	)
}

export default AdminWidgets
