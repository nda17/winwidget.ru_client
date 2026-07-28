'use client'

import { errorCatch } from '@/shared/api'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	adminPaymentsService,
	AdminPaymentNullablePeriodFilter,
	AdminPaymentNullablePlanFilter,
	AdminPaymentStatus,
	IAdminPaymentFilters,
	IAdminCheckPaymentResult,
	IAdminPayment
} from '@/features/manage-payments'
import type { BillingPeriod, Plan } from '@/entities/subscription'
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
import styles from './AdminPayments.module.scss'

const PLAN_LABELS: Record<Plan, string> = {
	TRIAL: 'Trial',
	EASY: 'Easy',
	HARD: 'Hard'
}

const PERIOD_LABELS: Record<BillingPeriod, string> = {
	MONTHLY: 'Месяц',
	YEARLY: 'Год'
}

const STATUS_LABELS: Record<AdminPaymentStatus, string> = {
	PENDING: 'Ожидает',
	SUCCEEDED: 'Оплачен',
	CANCELLED: 'Отменён',
	EXPIRED: 'Срок истёк'
}

type StatusFilter = AdminPaymentStatus | 'ALL'
type PaymentPlanFilter = AdminPaymentNullablePlanFilter | 'ALL'
type PaymentPeriodFilter = AdminPaymentNullablePeriodFilter | 'ALL'

interface PaymentFilterDraft {
	status: StatusFilter
	plan: PaymentPlanFilter
	billingPeriod: PaymentPeriodFilter
	createdFrom: string
	createdTo: string
	search: string
}

const STATUS_FILTER_OPTIONS: Array<{
	value: StatusFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все' },
	{ value: 'PENDING', label: STATUS_LABELS.PENDING },
	{ value: 'SUCCEEDED', label: STATUS_LABELS.SUCCEEDED },
	{ value: 'CANCELLED', label: STATUS_LABELS.CANCELLED },
	{ value: 'EXPIRED', label: STATUS_LABELS.EXPIRED }
]

const PLAN_FILTER_OPTIONS: Array<{
	value: PaymentPlanFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все тарифы' },
	{ value: 'TRIAL', label: PLAN_LABELS.TRIAL },
	{ value: 'EASY', label: PLAN_LABELS.EASY },
	{ value: 'HARD', label: PLAN_LABELS.HARD },
	{ value: 'NONE', label: 'Без тарифа' }
]

const PERIOD_FILTER_OPTIONS: Array<{
	value: PaymentPeriodFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все периоды' },
	{ value: 'MONTHLY', label: PERIOD_LABELS.MONTHLY },
	{ value: 'YEARLY', label: PERIOD_LABELS.YEARLY },
	{ value: 'NONE', label: 'Без периода' }
]

const DEFAULT_PAYMENT_FILTERS: PaymentFilterDraft = {
	status: 'ALL',
	plan: 'ALL',
	billingPeriod: 'ALL',
	createdFrom: '',
	createdTo: '',
	search: ''
}

const normalizePaymentFilters = (
	draft: PaymentFilterDraft
): IAdminPaymentFilters => ({
	status: draft.status === 'ALL' ? undefined : draft.status,
	plan: draft.plan === 'ALL' ? undefined : draft.plan,
	billingPeriod:
		draft.billingPeriod === 'ALL' ? undefined : draft.billingPeriod,
	createdFrom: draft.createdFrom || undefined,
	createdTo: draft.createdTo || undefined,
	search: draft.search.trim() || undefined
})

const hasActiveFilters = (filters: IAdminPaymentFilters) =>
	Object.values(filters).some(Boolean)

const formatDate = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(new Date(value))

const formatAmount = (value: string) => {
	const amount = Number(value)

	if (Number.isNaN(amount)) {
		return `${value} ₽`
	}

	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB'
	}).format(amount)
}

const getUserName = (payment: IAdminPayment) =>
	payment.user.name ||
	payment.user.email ||
	payment.user.phone ||
	payment.user.id

const isActiveCheck = (payment: IAdminPayment, activePaymentId?: string) =>
	activePaymentId === payment.id || activePaymentId === payment.yookassaId

const getPaymentReference = (payment: IAdminPayment) =>
	payment.yookassaId ?? payment.id

const AdminPayments: NextPage = () => {
	const queryClient = useQueryClient()
	const auth = useAuthStore(state => state.auth)
	const [currentPage, setCurrentPage] = useState(1)
	const [filterDraft, setFilterDraft] = useState(DEFAULT_PAYMENT_FILTERS)
	const [filters, setFilters] = useState<IAdminPaymentFilters>({})
	const [paymentId, setPaymentId] = useState('')
	const [lastResult, setLastResult] =
		useState<IAdminCheckPaymentResult | null>(null)
	const itemQuantity = 20

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ['admin-payments', currentPage, itemQuantity, filters],
		queryFn: () =>
			adminPaymentsService.getPayments(currentPage, itemQuantity, filters),
		enabled: auth
	})

	const totalPages = data?.totalPages ?? 1
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)
	const emptyListText = !hasActiveFilters(filters)
		? 'Платежей пока нет'
		: 'Платежей с такими фильтрами нет'

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const checkPaymentMutation = useMutation({
		mutationKey: ['admin-check-payment'],
		mutationFn: adminPaymentsService.checkPayment,
		onSuccess: result => {
			setLastResult(result)
			queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
			setPaymentId('')
		}
	})

	const activePaymentId = checkPaymentMutation.isPending
		? checkPaymentMutation.variables
		: undefined

	const runCheck = (id: string) => {
		const normalizedId = id.trim()

		if (!normalizedId) {
			toast.error('Укажите ID платежа')
			return
		}

		const promise = checkPaymentMutation.mutateAsync(normalizedId)

		toast.promise(promise, {
			loading: 'Проверяем платёж...',
			success: result => result.message,
			error: error => `Ошибка проверки: ${errorCatch(error)}`
		})
	}

	const handleManualCheck = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		runCheck(paymentId)
	}

	const applyFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setFilters(normalizePaymentFilters(filterDraft))
		setCurrentPage(1)
		toast.success('Фильтры платежей применены')
	}

	const resetFilters = () => {
		setFilterDraft(DEFAULT_PAYMENT_FILTERS)
		setFilters({})
		setCurrentPage(1)
		toast.success('Фильтры платежей сброшены')
	}

	const prevPage = () => setCurrentPage(p => Math.max(1, p - 1))
	const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)

	const renderPaymentLink = (payment: IAdminPayment) => (
		<div className={styles.paymentRef}>
			<span className={styles.paymentId}>
				{getPaymentReference(payment)}
			</span>
			{payment.confirmationUrl && (
				<a
					className={styles.paymentLink}
					href={payment.confirmationUrl}
					target="_blank"
					rel="noreferrer"
				>
					Ссылка оплаты
				</a>
			)}
		</div>
	)

	const renderCheckButton = (payment: IAdminPayment) => {
		const checking = isActiveCheck(payment, activePaymentId)

		return (
			<button
				type="button"
				className={styles.checkBtn}
				onClick={() => runCheck(getPaymentReference(payment))}
				disabled={checkPaymentMutation.isPending}
			>
				{checking ? 'Проверка..' : 'Проверить'}
			</button>
		)
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Платежи"
				title="Ручная проверка платежа"
				description="Проверяет один платёж в YooKassa по внутреннему ID или YooKassa ID и синхронизирует локальный статус. Ручная проверка нужна не для обычного сценария, а как админский аварийный инструмент: сверить конкретный платёж с источником правды YooKassa и дотянуть локальную базу. Она не должна быть ежедневной кнопкой, но полезна, когда пользователь пишет: «Я оплатил, а тариф не включился»."
				risk="high"
				riskText="Если YooKassa вернёт успешную оплату, проверка может активировать или продлить подписку пользователя."
			/>

			<form className={styles.card} onSubmit={handleManualCheck}>
				<div className={styles.field}>
					<label htmlFor="payment-id" className={styles.label}>
						ID платежа
					</label>
					<p className={styles.hint}>
						Можно вставить внутренний ID записи или ID платежа YooKassa
					</p>
					<input
						id="payment-id"
						name="payment-id"
						className={styles.input}
						value={paymentId}
						onChange={event => setPaymentId(event.target.value)}
						placeholder="Например: 2e8f..."
					/>
				</div>
				<button
					type="submit"
					className={styles.primaryBtn}
					disabled={checkPaymentMutation.isPending}
				>
					{checkPaymentMutation.isPending
						? 'Проверяем...'
						: 'Проверить платёж'}
				</button>
			</form>

			{lastResult && (
				<div className={styles.resultCard}>
					<p className={styles.resultTitle}>Последняя проверка</p>
					<div className={styles.resultGrid}>
						<div>
							<span className={styles.resultLabel}>Локальный статус</span>
							<span className={styles.resultValue}>
								{STATUS_LABELS[lastResult.payment.status]}
							</span>
						</div>
						<div>
							<span className={styles.resultLabel}>YooKassa</span>
							<span className={styles.resultValue}>
								{lastResult.providerStatus}
							</span>
						</div>
						<div>
							<span className={styles.resultLabel}>Платёж</span>
							<span className={styles.resultValue}>
								{getPaymentReference(lastResult.payment)}
							</span>
						</div>
						<div>
							<span className={styles.resultLabel}>Дата проверки</span>
							<span className={styles.resultValue}>
								{formatDate(lastResult.checkedAt)}
							</span>
						</div>
					</div>
					<p className={styles.resultMessage}>{lastResult.message}</p>
				</div>
			)}

			<AdminSectionHeading
				text="Список платежей YooKassa"
				title="Список платежей YooKassa"
				description="Показывает платежи пользователей: статус, тариф, период, сумму, дату и ID платежа."
				risk="medium"
				riskText="Кнопка проверки в строке синхронизирует выбранный платёж с YooKassa и может изменить доступ пользователя к тарифу."
			/>
			<form className={styles.filters} onSubmit={applyFilters}>
				<div className={styles['filter-grid']}>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Статус</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.status}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									status: event.target.value as StatusFilter
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
						<span className={styles['filter-label']}>Тариф</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.plan}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									plan: event.target.value as PaymentPlanFilter
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
						<span className={styles['filter-label']}>Период</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.billingPeriod}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									billingPeriod: event.target.value as PaymentPeriodFilter
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
							placeholder="ID, YooKassa, контакт"
						/>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Дата с</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={filterDraft.createdFrom}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									createdFrom: event.target.value
								}))
							}
						/>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Дата по</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={filterDraft.createdTo}
							onChange={event =>
								setFilterDraft(prev => ({
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
							<p className={styles['meta-title']}>Платежи</p>
							<p className={styles['meta-subtitle']}>
								Всего записей: {data.total}
							</p>
						</div>
						<div className={styles['list-controls']}>
							<p className={styles['meta-subtitle']}>
								{isFetching
									? 'Обновляем...'
									: `Страница ${data.page} из ${data.totalPages}`}
							</p>
						</div>
					</div>

					{data.items.length ? (
						<>
							<div className={styles['mobile-list']}>
								{data.items.map(payment => (
									<div key={payment.id} className={styles.paymentCard}>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Статус</span>
											<span
												className={clsx(
													styles.status,
													styles[`status-${payment.status.toLowerCase()}`]
												)}
											>
												{STATUS_LABELS[payment.status]}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>
												Пользователь
											</span>
											<span className={styles.cardValue}>
												{getUserName(payment)}
												{payment.user.email && (
													<span className={styles.cardExtra}>
														{payment.user.email}
													</span>
												)}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Тариф</span>
											<span
												className={clsx(
													styles.badge,
													payment.plan &&
														styles[`badge-${payment.plan.toLowerCase()}`]
												)}
											>
												{payment.plan ? PLAN_LABELS[payment.plan] : '—'}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Период</span>
											<span className={styles.cardValue}>
												{payment.billingPeriod
													? PERIOD_LABELS[payment.billingPeriod]
													: '—'}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Сумма</span>
											<span className={styles.cardValue}>
												{formatAmount(payment.amount)}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>Дата</span>
											<span className={styles.cardValue}>
												{formatDate(
													payment.succeededAt ?? payment.createdAt
												)}
											</span>
										</div>
										<div className={styles.cardRow}>
											<span className={styles.cardLabel}>ID / ссылка</span>
											<span className={styles.cardValue}>
												{renderPaymentLink(payment)}
											</span>
										</div>
										{renderCheckButton(payment)}
									</div>
								))}
							</div>

							<div className={styles['table-scroll']}>
								<table className={styles.table}>
									<caption className="srOnly">
										Список платежей YooKassa пользователей
									</caption>
									<thead>
										<tr>
											<th scope="col">Статус</th>
											<th scope="col">Пользователь</th>
											<th scope="col">Тариф</th>
											<th scope="col">Период</th>
											<th scope="col">Сумма</th>
											<th scope="col">Дата</th>
											<th scope="col">ID / ссылка</th>
											<th scope="col">Действия</th>
										</tr>
									</thead>
									<tbody>
										{data.items.map(payment => (
											<tr key={payment.id}>
												<td>
													<span
														className={clsx(
															styles.status,
															styles[
																`status-${payment.status.toLowerCase()}`
															]
														)}
													>
														{STATUS_LABELS[payment.status]}
													</span>
												</td>
												<td>
													<div className={styles.userCell}>
														<span>{getUserName(payment)}</span>
														<span className={styles.userContact}>
															{payment.user.email ||
																payment.user.phone ||
																payment.user.id}
														</span>
													</div>
												</td>
												<td>
													<span
														className={clsx(
															styles.badge,
															payment.plan &&
																styles[
																	`badge-${payment.plan.toLowerCase()}`
																]
														)}
													>
														{payment.plan
															? PLAN_LABELS[payment.plan]
															: '—'}
													</span>
												</td>
												<td>
													{payment.billingPeriod
														? PERIOD_LABELS[payment.billingPeriod]
														: '—'}
												</td>
												<td>{formatAmount(payment.amount)}</td>
												<td>
													{formatDate(
														payment.succeededAt ?? payment.createdAt
													)}
												</td>
												<td>{renderPaymentLink(payment)}</td>
												<td>{renderCheckButton(payment)}</td>
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
					<p className={styles['meta-subtitle']}>Платежей пока нет</p>
				</div>
			)}
		</section>
	)
}

export default AdminPayments
