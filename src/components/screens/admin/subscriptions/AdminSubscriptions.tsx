'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import useAdminSubscriptions from '@/hooks/useAdminSubscriptions'
import type {
	AdminSubscriptionPeriodFilter,
	AdminBonusAudience,
	IAdminSubscriptionFilters,
	IAdminSubscriptionHistoryFilters,
	IAdminSubscriptionHistory,
	SubscriptionHistoryAction
} from '@/services/subscription/subscription.service'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'
import clsx from 'clsx'
import { NextPage } from 'next'
import { FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminSubscriptions.module.scss'

const PLAN_LABELS: Record<Plan, string> = {
	TRIAL: 'Trial',
	EASY: 'Easy',
	HARD: 'Hard'
}

const PERIOD_LABELS: Record<BillingPeriod, string> = {
	MONTHLY: 'Месяц',
	YEARLY: 'Год'
}

const STATUS_LABELS = {
	ACTIVE: 'Активна',
	EXPIRED: 'Истекла',
	CANCELLED: 'Отменена'
}

const HISTORY_ACTION_LABELS: Record<SubscriptionHistoryAction, string> = {
	BONUS_DAYS: 'Бонусные дни'
}

const BONUS_AUDIENCE_LABELS: Record<AdminBonusAudience, string> = {
	SINGLE: 'Один пользователь',
	ACTIVE_SUBSCRIPTION: 'Активные пользователи',
	INACTIVE_SUBSCRIPTION: 'Неактивные пользователи',
	ALL: 'Все пользователи'
}

const BONUS_AUDIENCE_HISTORY_LABELS: Record<AdminBonusAudience, string> = {
	SINGLE: 'Выбранный пользователь',
	ACTIVE_SUBSCRIPTION: 'Все активные пользователи',
	INACTIVE_SUBSCRIPTION: 'Все неактивные пользователи',
	ALL: 'Все пользователи'
}

const BONUS_AUDIENCE_DESCRIPTIONS: Record<AdminBonusAudience, string> = {
	SINGLE: 'Начисление одному выбранному пользователю',
	ACTIVE_SUBSCRIPTION:
		'Все, у кого на текущий момент есть действующая подписка',
	INACTIVE_SUBSCRIPTION:
		'Все, у кого на текущий момент нет действующей подписки',
	ALL: 'Все пользователи в базе данных независимо от подписки'
}

const BONUS_DAYS_HINTS: Record<AdminBonusAudience, string> = {
	SINGLE:
		'Если подписка активна — дни добавятся к текущей дате окончания. Если истекла или отменена — срок начнётся с сегодняшнего дня',
	ACTIVE_SUBSCRIPTION:
		'Дни добавятся к текущей дате окончания всем пользователям с действующей подпиской',
	INACTIVE_SUBSCRIPTION:
		'Пользователям без действующей подписки срок начнётся с сегодняшнего дня. Если подписки не было — будет создана TRIAL-подписка',
	ALL: 'Активным пользователям дни добавятся к текущей дате окончания, остальным срок начнётся с сегодняшнего дня'
}

type SubscriptionPlanFilter = Plan | 'ALL'
type SubscriptionStatusFilter =
	| NonNullable<IAdminSubscriptionFilters['status']>
	| 'ALL'
type SubscriptionPeriodFilter = AdminSubscriptionPeriodFilter | 'ALL'
type SubscriptionHistoryAudienceFilter = AdminBonusAudience | 'ANY'

interface SubscriptionFilterDraft {
	plan: SubscriptionPlanFilter
	status: SubscriptionStatusFilter
	billingPeriod: SubscriptionPeriodFilter
	expiresFrom: string
	expiresTo: string
}

interface SubscriptionHistoryFilterDraft {
	audience: SubscriptionHistoryAudienceFilter
	adminId: string
	createdFrom: string
	createdTo: string
}

const DEFAULT_SUBSCRIPTION_FILTERS: SubscriptionFilterDraft = {
	plan: 'ALL',
	status: 'ALL',
	billingPeriod: 'ALL',
	expiresFrom: '',
	expiresTo: ''
}

const DEFAULT_HISTORY_FILTERS: SubscriptionHistoryFilterDraft = {
	audience: 'ANY',
	adminId: '',
	createdFrom: '',
	createdTo: ''
}

const normalizeBonusDaysInput = (value: string) => {
	if (value.trim() === '') return ''
	const days = Number(value)
	if (!Number.isFinite(days)) return ''

	return String(Math.min(3650, Math.max(1, Math.trunc(days))))
}

const PLAN_FILTER_OPTIONS: Array<{
	value: SubscriptionPlanFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все тарифы' },
	{ value: 'TRIAL', label: PLAN_LABELS.TRIAL },
	{ value: 'EASY', label: PLAN_LABELS.EASY },
	{ value: 'HARD', label: PLAN_LABELS.HARD }
]

const STATUS_FILTER_OPTIONS: Array<{
	value: SubscriptionStatusFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все статусы' },
	{ value: 'ACTIVE', label: STATUS_LABELS.ACTIVE },
	{ value: 'EXPIRED', label: STATUS_LABELS.EXPIRED },
	{ value: 'CANCELLED', label: STATUS_LABELS.CANCELLED }
]

const PERIOD_FILTER_OPTIONS: Array<{
	value: SubscriptionPeriodFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все периоды' },
	{ value: 'MONTHLY', label: PERIOD_LABELS.MONTHLY },
	{ value: 'YEARLY', label: PERIOD_LABELS.YEARLY },
	{ value: 'NONE', label: 'Без периода' }
]

const HISTORY_AUDIENCE_FILTER_OPTIONS: Array<{
	value: SubscriptionHistoryAudienceFilter
	label: string
}> = [
	{ value: 'ANY', label: 'Все аудитории' },
	{ value: 'SINGLE', label: BONUS_AUDIENCE_LABELS.SINGLE },
	{
		value: 'ACTIVE_SUBSCRIPTION',
		label: BONUS_AUDIENCE_LABELS.ACTIVE_SUBSCRIPTION
	},
	{
		value: 'INACTIVE_SUBSCRIPTION',
		label: BONUS_AUDIENCE_LABELS.INACTIVE_SUBSCRIPTION
	},
	{ value: 'ALL', label: BONUS_AUDIENCE_LABELS.ALL }
]

const normalizeSubscriptionFilters = (
	draft: SubscriptionFilterDraft
): IAdminSubscriptionFilters => ({
	plan: draft.plan === 'ALL' ? undefined : draft.plan,
	status: draft.status === 'ALL' ? undefined : draft.status,
	billingPeriod:
		draft.billingPeriod === 'ALL' ? undefined : draft.billingPeriod,
	expiresFrom: draft.expiresFrom || undefined,
	expiresTo: draft.expiresTo || undefined
})

const normalizeHistoryFilters = (
	draft: SubscriptionHistoryFilterDraft
): IAdminSubscriptionHistoryFilters => ({
	audience: draft.audience === 'ANY' ? undefined : draft.audience,
	adminId: draft.adminId.trim() || undefined,
	createdFrom: draft.createdFrom || undefined,
	createdTo: draft.createdTo || undefined
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU')

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
	dateStyle: 'short',
	timeStyle: 'short'
})

const formatDate = (value?: string | null) =>
	value ? dateFormatter.format(new Date(value)) : '—'

const formatDateTime = (value?: string | null) =>
	value ? dateTimeFormatter.format(new Date(value)) : '—'

const formatUserLabel = (
	user?: { id: string; name: string | null; email: string | null } | null
) => user?.name || user?.email || user?.id || '—'

const formatUserName = (
	user?: { id: string; name: string | null; email: string | null } | null
) => user?.name || (user?.email ? 'Без имени' : user?.id) || '—'

const isMassBonusHistory = (item: IAdminSubscriptionHistory) =>
	Boolean(item.targetAudience && item.targetAudience !== 'SINGLE')

const formatHistoryTargetName = (item: IAdminSubscriptionHistory) =>
	isMassBonusHistory(item)
		? item.targetLabel ||
			BONUS_AUDIENCE_HISTORY_LABELS[
				item.targetAudience as AdminBonusAudience
			]
		: formatUserName(item.user)

const formatHistoryTargetDetails = (item: IAdminSubscriptionHistory) =>
	isMassBonusHistory(item)
		? `Затронуто: ${item.affectedUsersCount ?? 0}`
		: item.user?.email || ''

const AdminSubscriptions: NextPage = () => {
	const [currentPage, setCurrentPage] = useState(1)
	const [historyCurrentPage, setHistoryCurrentPage] = useState(1)
	const [subscriptionFilterDraft, setSubscriptionFilterDraft] = useState(
		DEFAULT_SUBSCRIPTION_FILTERS
	)
	const [historyFilterDraft, setHistoryFilterDraft] = useState(
		DEFAULT_HISTORY_FILTERS
	)
	const [subscriptionFilters, setSubscriptionFilters] =
		useState<IAdminSubscriptionFilters>({})
	const [historyFilters, setHistoryFilters] =
		useState<IAdminSubscriptionHistoryFilters>({})
	const itemQuantity = 15
	const historyItemQuantity = 10
	const {
		subscriptions,
		subscriptionHistory,
		isLoading,
		isHistoryLoading,
		userSearch,
		setUserSearch,
		userSearchResults,
		selectedUserId,
		selectedUserName,
		selectUser,
		bonusUserSearch,
		setBonusUserSearch,
		bonusUserSearchResults,
		bonusSelectedUserId,
		bonusSelectedUserName,
		selectBonusUser,
		bonusAudience,
		setBonusAudience,
		plan,
		setPlan,
		billingPeriod,
		setBillingPeriod,
		startsAt,
		setStartsAt,
		isActivating,
		handleActivate,
		bonusDays,
		setBonusDays,
		isExtendingDays,
		handleExtendDays,
		bonusConfirm,
		confirmExtendDays,
		dismissExtendDays,
		extendIfActive,
		setExtendIfActive,
		cancel,
		cancelTargetId,
		confirmCancel,
		dismissCancel
	} = useAdminSubscriptions({
		subscriptionPage: currentPage,
		subscriptionLimit: itemQuantity,
		historyPage: historyCurrentPage,
		historyLimit: historyItemQuantity,
		subscriptionFilters,
		historyFilters,
		onSubscriptionSuccess: () => setCurrentPage(1),
		onBonusSuccess: () => setHistoryCurrentPage(1)
	})

	const activePage = subscriptions?.items ?? []
	const totalItems = subscriptions?.total ?? 0
	const totalPages = subscriptions?.totalPages ?? currentPage
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)
	const activeHistoryPage = subscriptionHistory?.items ?? []
	const historyTotalItems = subscriptionHistory?.total ?? 0
	const historyTotalPages =
		subscriptionHistory?.totalPages ?? historyCurrentPage
	const historyListPage = Array.from(
		{ length: historyTotalPages },
		(_, i) => i + 1
	)

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	useEffect(() => {
		if (historyCurrentPage > historyTotalPages) {
			setHistoryCurrentPage(historyTotalPages)
		}
	}, [historyCurrentPage, historyTotalPages])

	const prevPage = () => setCurrentPage(p => Math.max(1, p - 1))
	const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)
	const prevHistoryPage = () =>
		setHistoryCurrentPage(p => Math.max(1, p - 1))
	const nextHistoryPage = () =>
		setHistoryCurrentPage(p => Math.min(historyTotalPages, p + 1))
	const changeActiveHistoryPage = (page: number) =>
		setHistoryCurrentPage(page)

	const applySubscriptionFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setSubscriptionFilters(
			normalizeSubscriptionFilters(subscriptionFilterDraft)
		)
		setCurrentPage(1)
		toast.success('Фильтры подписок применены')
	}

	const resetSubscriptionFilters = () => {
		setSubscriptionFilterDraft(DEFAULT_SUBSCRIPTION_FILTERS)
		setSubscriptionFilters({})
		setCurrentPage(1)
		toast.success('Фильтры подписок сброшены')
	}

	const applyHistoryFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setHistoryFilters(normalizeHistoryFilters(historyFilterDraft))
		setHistoryCurrentPage(1)
		toast.success('Фильтры истории применены')
	}

	const resetHistoryFilters = () => {
		setHistoryFilterDraft(DEFAULT_HISTORY_FILTERS)
		setHistoryFilters({})
		setHistoryCurrentPage(1)
		toast.success('Фильтры истории сброшены')
	}

	return (
		<section className={styles.wrapper}>
			{cancelTargetId && (
				<ConfirmDialog
					title="Отменить подписку?"
					message="Это действие необратимо — пользователь потеряет доступ к тарифу."
					confirmLabel="Да, отменить"
					cancelLabel="Назад"
					onConfirm={confirmCancel}
					onCancel={dismissCancel}
				/>
			)}
			{bonusConfirm && (
				<ConfirmDialog
					title="Начислить бонусные дни?"
					message={`Будет начислено ${bonusConfirm.days} дн. ${
						bonusConfirm.audience === 'SINGLE'
							? `Пользователь: ${bonusSelectedUserName}.`
							: `Аудитория: ${BONUS_AUDIENCE_HISTORY_LABELS[bonusConfirm.audience]}.`
					} Действие сразу изменит подписки.`}
					confirmLabel="Начислить"
					cancelLabel="Назад"
					onConfirm={confirmExtendDays}
					onCancel={dismissExtendDays}
				/>
			)}
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Ручная активация подписки"
				title="Ручная активация подписки"
				description="Позволяет администратору выдать тариф пользователю, заменить срок подписки или суммировать новый период с активной подпиской."
				risk="high"
				riskText="Неверный пользователь, тариф или период сразу повлияют на доступ к сервису и лимиты. Перед активацией проверь выбранный аккаунт."
			/>

			{/* ── Activation form ────────────────────────────────────── */}
			<div className={styles.card}>
				{/* User search */}
				<div className={styles.field}>
					<label htmlFor="user-search" className={styles.label}>
						Пользователь
					</label>
					<p className={styles.hint}>
						Найдите пользователя по имени, email или телефону
					</p>
					{selectedUserId ? (
						<div className={styles.selectedUser}>
							<span>{selectedUserName}</span>
							<button
								type="button"
								className={styles.clearBtn}
								onClick={() => selectUser('', '')}
							>
								✕
							</button>
						</div>
					) : (
						<div className={styles.searchWrap}>
							<input
								id="user-search"
								name="user-search"
								className={styles.input}
								placeholder="Поиск по имени, email, телефону"
								value={userSearch}
								onChange={setUserSearch}
							/>
							{userSearchResults && userSearchResults.length > 0 && (
								<ul className={styles.dropdown}>
									{userSearchResults.map(u => (
										<li key={u.id}>
											<button
												type="button"
												className={styles.dropdownItem}
												onClick={() =>
													selectUser(
														u.id,
														`${u.name || 'Без имени'} (${u.email || u.phone || u.id})`
													)
												}
											>
												<span className={styles.dropdownName}>
													{u.name || 'Без имени'}
												</span>
												<span className={styles.dropdownEmail}>
													{u.email || u.phone || u.id}
												</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					)}
				</div>

				{/* Plan */}
				<div className={styles.field}>
					<label htmlFor="plan" className={styles.label}>
						Тариф
					</label>
					<p className={styles.hint}>
						Trial — 7 дней бесплатно. Easy и Hard — платные тарифы с
						расширенными лимитами
					</p>
					<select
						id="plan"
						name="plan"
						className={styles.select}
						value={plan}
						onChange={e => setPlan(e.target.value as Plan)}
					>
						{(Object.keys(PLAN_LABELS) as Plan[]).map(p => (
							<option key={p} value={p}>
								{PLAN_LABELS[p]}
							</option>
						))}
					</select>
				</div>

				{/* Billing period — hidden for TRIAL */}
				{plan !== 'TRIAL' && (
					<div className={styles.field}>
						<label htmlFor="billing-period" className={styles.label}>
							Период
						</label>
						<p className={styles.hint}>
							Определяет на сколько продлится подписка — на месяц или на
							год
						</p>
						<select
							id="billing-period"
							name="billing-period"
							className={styles.select}
							value={billingPeriod}
							onChange={e =>
								setBillingPeriod(e.target.value as BillingPeriod)
							}
						>
							{(Object.keys(PERIOD_LABELS) as BillingPeriod[]).map(p => (
								<option key={p} value={p}>
									{PERIOD_LABELS[p]}
								</option>
							))}
						</select>
					</div>
				)}

				{/* Start date — only relevant when not extending */}
				{!extendIfActive && (
					<div className={styles.field}>
						<label htmlFor="starts-at" className={styles.label}>
							Дата начала
						</label>
						<p className={styles.hint}>
							Используется как точка отсчёта при полной замене подписки.
							Можно поставить задним числом
						</p>
						<input
							id="starts-at"
							name="starts-at"
							type="date"
							className={styles.input}
							value={startsAt}
							onChange={e => setStartsAt(e.target.value)}
						/>
					</div>
				)}

				{/* Extend toggle */}
				<div className={styles.checkboxField}>
					<label
						htmlFor="extend-if-active"
						className={styles.checkboxLabel}
					>
						<input
							id="extend-if-active"
							name="extend-if-active"
							type="checkbox"
							className={styles.checkbox}
							checked={extendIfActive}
							onChange={e => setExtendIfActive(e.target.checked)}
						/>
						Суммировать с активной подпиской
					</label>
					<p className={styles.hint}>
						Если включено и у пользователя есть активная подписка — новый
						период прибавится к текущей дате окончания. Если выключено —
						подписка будет полностью заменена
					</p>
				</div>

				<button
					className={styles.activateBtn}
					onClick={handleActivate}
					disabled={isActivating || !selectedUserId}
				>
					{isActivating ? 'Активация...' : 'Активировать'}
				</button>
			</div>

			<AdminSectionHeading
				text="Бонусное продление"
				title="Бонусное продление подписки"
				description="Добавляет пользователю только дополнительные дни. Тариф, период оплаты и лимиты подписки не меняются."
				risk="high"
				riskText="Начисление сразу меняет дату окончания подписки. Проверь пользователя и количество дней перед сохранением."
			/>
			<div className={styles.card}>
				<div className={styles.field}>
					<p className={styles.label}>Кому начислить</p>
					<p className={styles.hint}>
						{BONUS_AUDIENCE_DESCRIPTIONS[bonusAudience]}
					</p>
					<div className={styles.audienceOptions}>
						{(
							Object.keys(BONUS_AUDIENCE_LABELS) as AdminBonusAudience[]
						).map(audience => (
							<button
								key={audience}
								type="button"
								className={clsx(
									styles.optionBtn,
									bonusAudience === audience && styles.optionBtnActive
								)}
								onClick={() => setBonusAudience(audience)}
							>
								{BONUS_AUDIENCE_LABELS[audience]}
							</button>
						))}
					</div>
				</div>

				{bonusAudience === 'SINGLE' && (
					<div className={styles.field}>
						<label htmlFor="bonus-user-search" className={styles.label}>
							Пользователь
						</label>
						<p className={styles.hint}>
							Найдите пользователя, которому нужно добавить дни
						</p>
						{bonusSelectedUserId ? (
							<div className={styles.selectedUser}>
								<span>{bonusSelectedUserName}</span>
								<button
									type="button"
									className={styles.clearBtn}
									onClick={() => selectBonusUser('', '')}
								>
									✕
								</button>
							</div>
						) : (
							<div className={styles.searchWrap}>
								<input
									id="bonus-user-search"
									name="bonus-user-search"
									className={styles.input}
									placeholder="Поиск по имени, email, телефону"
									value={bonusUserSearch}
									onChange={setBonusUserSearch}
								/>
								{bonusUserSearchResults &&
									bonusUserSearchResults.length > 0 && (
										<ul className={styles.dropdown}>
											{bonusUserSearchResults.map(u => (
												<li key={u.id}>
													<button
														type="button"
														className={styles.dropdownItem}
														onClick={() =>
															selectBonusUser(
																u.id,
																`${u.name || 'Без имени'} (${u.email || u.phone || u.id})`
															)
														}
													>
														<span className={styles.dropdownName}>
															{u.name || 'Без имени'}
														</span>
														<span className={styles.dropdownEmail}>
															{u.email || u.phone || u.id}
														</span>
													</button>
												</li>
											))}
										</ul>
									)}
							</div>
						)}
					</div>
				)}

				<div className={styles.field}>
					<label htmlFor="bonus-days" className={styles.label}>
						Количество дней
					</label>
					<p className={styles.hint}>{BONUS_DAYS_HINTS[bonusAudience]}</p>
					<input
						id="bonus-days"
						name="bonus-days"
						type="number"
						min={1}
						max={3650}
						step={1}
						className={styles.input}
						placeholder="Например: 14"
						value={bonusDays}
						onChange={e =>
							setBonusDays(normalizeBonusDaysInput(e.target.value))
						}
					/>
				</div>

				<button
					className={styles.bonusBtn}
					onClick={handleExtendDays}
					disabled={
						isExtendingDays ||
						(bonusAudience === 'SINGLE' && !bonusSelectedUserId)
					}
				>
					{isExtendingDays ? 'Начисление...' : 'Начислить бонусные дни'}
				</button>
			</div>

			<AdminSectionHeading
				text="История бонусных начислений"
				title="История бонусных начислений"
				description="Фиксирует дату начисления, пользователя или аудиторию, количество дней, администратора и изменение даты окончания подписки."
				risk="low"
				riskText="Блок только показывает уже выполненные начисления и не меняет данные подписок."
			/>
			<form className={styles.filters} onSubmit={applyHistoryFilters}>
				<div className={styles['filter-grid']}>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Аудитория</span>
						<select
							className={styles['filter-input']}
							value={historyFilterDraft.audience}
							onChange={event =>
								setHistoryFilterDraft(prev => ({
									...prev,
									audience: event.target
										.value as SubscriptionHistoryAudienceFilter
								}))
							}
						>
							{HISTORY_AUDIENCE_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>ID админа</span>
						<input
							className={styles['filter-input']}
							value={historyFilterDraft.adminId}
							onChange={event =>
								setHistoryFilterDraft(prev => ({
									...prev,
									adminId: event.target.value
								}))
							}
							placeholder="ID администратора"
						/>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Начислено с</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={historyFilterDraft.createdFrom}
							onChange={event =>
								setHistoryFilterDraft(prev => ({
									...prev,
									createdFrom: event.target.value
								}))
							}
						/>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Начислено по</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={historyFilterDraft.createdTo}
							onChange={event =>
								setHistoryFilterDraft(prev => ({
									...prev,
									createdTo: event.target.value
								}))
							}
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
						onClick={resetHistoryFilters}
					>
						Сбросить
					</button>
				</div>
			</form>
			{isHistoryLoading ? (
				<div className={styles.card}>
					{Array.from({ length: 3 }).map((_, i) => (
						<SkeletonLoader
							key={i}
							count={1}
							className={styles.skeletonRow}
						/>
					))}
				</div>
			) : historyTotalItems ? (
				<div className={styles['list-section']}>
					<div className={styles['list-meta']}>
						<div>
							<p className={styles['meta-title']}>История</p>
							<p className={styles['meta-subtitle']}>
								Всего записей: {historyTotalItems}
							</p>
						</div>
						<p className={styles['meta-subtitle']}>
							Показано {activeHistoryPage.length} из {historyTotalItems}
						</p>
					</div>

					<div className={styles['mobile-list']}>
						{activeHistoryPage.map(item => (
							<div key={item.id} className={styles['sub-card']}>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Дата</span>
									<span className={styles['card-value']}>
										{formatDateTime(item.createdAt)}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>
										Пользователь
									</span>
									<span className={styles['card-value']}>
										{formatHistoryTargetName(item)}
										{formatHistoryTargetDetails(item) && (
											<span className={styles['card-email']}>
												{formatHistoryTargetDetails(item)}
											</span>
										)}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Действие</span>
									<span className={styles.historyAction}>
										{HISTORY_ACTION_LABELS[item.action]}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Дней</span>
									<span className={styles['card-value']}>
										{item.days ?? '—'}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>
										Кто начислил
									</span>
									<span className={styles['card-value']}>
										{item.admin
											? formatUserLabel(item.admin)
											: 'Админ удалён'}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Было</span>
									<span className={styles['card-value']}>
										{formatDate(item.oldExpiresAt)}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Стало</span>
									<span className={styles['card-value']}>
										{formatDate(item.newExpiresAt)}
									</span>
								</div>
							</div>
						))}
					</div>

					<div className={styles['table-scroll']}>
						<table className={styles.table}>
							<caption className="srOnly">
								История бонусных начислений подписок
							</caption>
							<thead>
								<tr>
									<th scope="col">Дата</th>
									<th scope="col">Пользователь</th>
									<th scope="col">Действие</th>
									<th scope="col">Дней</th>
									<th scope="col">Кто начислил</th>
									<th scope="col">Было</th>
									<th scope="col">Стало</th>
								</tr>
							</thead>
							<tbody>
								{activeHistoryPage.map(item => (
									<tr key={item.id}>
										<td>{formatDateTime(item.createdAt)}</td>
										<td>
											<span className={styles.historyUser}>
												{formatHistoryTargetName(item)}
											</span>
											{formatHistoryTargetDetails(item) && (
												<span className={styles.historyEmail}>
													{formatHistoryTargetDetails(item)}
												</span>
											)}
										</td>
										<td>
											<span className={styles.historyAction}>
												{HISTORY_ACTION_LABELS[item.action]}
											</span>
										</td>
										<td>{item.days ?? '—'}</td>
										<td>
											{item.admin
												? formatUserLabel(item.admin)
												: 'Админ удалён'}
										</td>
										<td>{formatDate(item.oldExpiresAt)}</td>
										<td>{formatDate(item.newExpiresAt)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{historyTotalItems > historyItemQuantity && (
						<Pagination
							listPage={historyListPage}
							currentPage={historyCurrentPage}
							prevPage={prevHistoryPage}
							nextPage={nextHistoryPage}
							changeActivePage={changeActiveHistoryPage}
						/>
					)}
				</div>
			) : (
				<div className={styles.card}>
					<p className={styles['meta-subtitle']}>
						Истории начислений пока нет
					</p>
				</div>
			)}

			{/* ── Subscriptions table ────────────────────────────────── */}
			<AdminSectionHeading
				text="Все подписки"
				title="Список подписок"
				description="Показывает текущие и архивные подписки пользователей, сроки, тарифы, статусы и количество лидов за период."
				risk="high"
				riskText="Кнопка отмены снимает активный доступ пользователя к тарифу. Используй её только когда отмена точно нужна."
			/>
			<form className={styles.filters} onSubmit={applySubscriptionFilters}>
				<div className={styles['filter-grid']}>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Тариф</span>
						<select
							className={styles['filter-input']}
							value={subscriptionFilterDraft.plan}
							onChange={event =>
								setSubscriptionFilterDraft(prev => ({
									...prev,
									plan: event.target.value as SubscriptionPlanFilter
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
						<span className={styles['filter-label']}>Статус</span>
						<select
							className={styles['filter-input']}
							value={subscriptionFilterDraft.status}
							onChange={event =>
								setSubscriptionFilterDraft(prev => ({
									...prev,
									status: event.target.value as SubscriptionStatusFilter
								}))
							}
						>
							{STATUS_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Период</span>
						<select
							className={styles['filter-input']}
							value={subscriptionFilterDraft.billingPeriod}
							onChange={event =>
								setSubscriptionFilterDraft(prev => ({
									...prev,
									billingPeriod: event.target
										.value as SubscriptionPeriodFilter
								}))
							}
						>
							{PERIOD_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Окончание с</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={subscriptionFilterDraft.expiresFrom}
							onChange={event =>
								setSubscriptionFilterDraft(prev => ({
									...prev,
									expiresFrom: event.target.value
								}))
							}
						/>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Окончание по</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={subscriptionFilterDraft.expiresTo}
							onChange={event =>
								setSubscriptionFilterDraft(prev => ({
									...prev,
									expiresTo: event.target.value
								}))
							}
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
						onClick={resetSubscriptionFilters}
					>
						Сбросить
					</button>
				</div>
			</form>
			{isLoading ? (
				<div className={styles.card}>
					{Array.from({ length: 5 }).map((_, i) => (
						<SkeletonLoader
							key={i}
							count={1}
							className={styles.skeletonRow}
						/>
					))}
				</div>
			) : totalItems ? (
				<div className={styles['list-section']}>
					<div className={styles['list-meta']}>
						<div>
							<p className={styles['meta-title']}>Подписки</p>
							<p className={styles['meta-subtitle']}>
								Всего записей: {totalItems}
							</p>
						</div>
						<p className={styles['meta-subtitle']}>
							Показано {activePage.length} из {totalItems}
						</p>
					</div>

					{/* Mobile cards */}
					<div className={styles['mobile-list']}>
						{activePage.map(sub => (
							<div key={sub.id} className={styles['sub-card']}>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>
										Пользователь
									</span>
									<span className={styles['card-value']}>
										{sub.user?.name || 'Без имени'}
										{sub.user?.email && (
											<span className={styles['card-email']}>
												{sub.user.email}
											</span>
										)}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Тариф</span>
									<span
										className={clsx(
											styles.badge,
											styles[`badge-${sub.plan.toLowerCase()}`]
										)}
									>
										{PLAN_LABELS[sub.plan]}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Период</span>
									<span className={styles['card-value']}>
										{sub.billingPeriod
											? PERIOD_LABELS[sub.billingPeriod]
											: '—'}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>Статус</span>
									<span
										className={clsx(
											styles.status,
											styles[`status-${sub.status.toLowerCase()}`]
										)}
									>
										{STATUS_LABELS[sub.status]}
									</span>
								</div>
								<div className={styles['card-row']}>
									<span className={styles['card-label']}>
										Действует до
									</span>
									<span className={styles['card-value']}>
										{sub.expiresAt ? sub.expiresAt.slice(0, 10) : '—'}
									</span>
								</div>
								{sub.status === 'ACTIVE' && (
									<button
										className={styles.cancelBtn}
										onClick={() => cancel(sub.userId)}
									>
										Отменить
									</button>
								)}
							</div>
						))}
					</div>

					{/* Desktop table */}
					<div className={styles['table-scroll']}>
						<table className={styles.table}>
							<caption className="srOnly">
								Список активных и архивных подписок пользователей
							</caption>
							<thead>
								<tr>
									<th scope="col">Пользователь</th>
									<th scope="col">Email</th>
									<th scope="col">Тариф</th>
									<th scope="col">Период</th>
									<th scope="col">Статус</th>
									<th scope="col">Начало</th>
									<th scope="col">Окончание</th>
									<th scope="col">Лиды</th>
									<th scope="col">Действия</th>
								</tr>
							</thead>
							<tbody>
								{activePage.map(sub => (
									<tr key={sub.id}>
										<td>{sub.user?.name || 'Без имени'}</td>
										<td>{sub.user?.email || '—'}</td>
										<td>
											<span
												className={clsx(
													styles.badge,
													styles[`badge-${sub.plan.toLowerCase()}`]
												)}
											>
												{PLAN_LABELS[sub.plan]}
											</span>
										</td>
										<td>
											{sub.billingPeriod
												? PERIOD_LABELS[sub.billingPeriod]
												: '—'}
										</td>
										<td>
											<span
												className={clsx(
													styles.status,
													styles[`status-${sub.status.toLowerCase()}`]
												)}
											>
												{STATUS_LABELS[sub.status]}
											</span>
										</td>
										<td>{sub.startsAt?.slice(0, 10) ?? '—'}</td>
										<td>{sub.expiresAt?.slice(0, 10) ?? '—'}</td>
										<td>{sub.leadsThisPeriod}</td>
										<td>
											{sub.status === 'ACTIVE' && (
												<button
													className={styles.cancelBtn}
													onClick={() => cancel(sub.userId)}
												>
													Отменить
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{totalItems > itemQuantity && (
						<Pagination
							listPage={listPage}
							currentPage={currentPage}
							prevPage={prevPage}
							nextPage={nextPage}
							changeActivePage={changeActivePage}
						/>
					)}
				</div>
			) : (
				<div className={styles.card}>
					<p className={styles['meta-subtitle']}>Подписок пока нет</p>
				</div>
			)}
		</section>
	)
}

export default AdminSubscriptions
