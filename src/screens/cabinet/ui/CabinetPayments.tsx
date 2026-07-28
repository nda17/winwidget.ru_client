'use client'

import {
	type AutoRenewalStatus,
	type BillingPeriod,
	type IUserPayment,
	type PaymentStatus,
	type Plan,
	subscriptionService
} from '@/entities/subscription'
import { useAuthStore } from '@/entities/user'
import { errorCatch } from '@/shared/api'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './Cabinet.module.scss'

const PLAN_LABELS: Record<Plan, string> = {
	TRIAL: 'Тест-драйв',
	EASY: 'Easy',
	HARD: 'Hard'
}

const PERIOD_LABELS: Record<BillingPeriod, string> = {
	MONTHLY: 'Месяц',
	YEARLY: 'Год'
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	PENDING: 'Ожидает оплаты',
	SUCCEEDED: 'Оплачен',
	CANCELLED: 'Отменён',
	EXPIRED: 'Срок истёк'
}

const AUTO_RENEWAL_STATUS_LABELS: Record<AutoRenewalStatus, string> = {
	NEVER_CONSENTED: 'Не подключено',
	ACTIVE: 'Включено',
	USER_DISABLED: 'Отключено вами',
	ADMIN_PAUSED: 'Приостановлено',
	TECHNICAL_PAUSE: 'Временно приостановлено',
	REVOKED: 'Отозвано'
}

const formatDate = (value: string | null) =>
	value
		? `${new Intl.DateTimeFormat('ru-RU', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'Europe/Moscow'
			}).format(new Date(value))} МСК`
		: '—'

const formatAmount = (amount: string | null, currency = 'RUB') => {
	if (amount === null) return '—'

	const numericAmount = Number(amount)
	if (!Number.isFinite(numericAmount)) return `${amount} ${currency}`

	try {
		return new Intl.NumberFormat('ru-RU', {
			style: 'currency',
			currency,
			maximumFractionDigits: 2
		}).format(numericAmount)
	} catch {
		return `${amount} ${currency}`
	}
}

const getPaymentTypeLabel = (payment: IUserPayment) => {
	if (payment.kind === 'RECURRING') return 'Автосписание'
	if (payment.autoRenew) return 'Первичный с автопродлением'
	return 'Разовый'
}

const getPaymentStatusClassName = (status: PaymentStatus) => {
	switch (status) {
		case 'SUCCEEDED':
			return styles.paymentStatusSucceeded
		case 'PENDING':
			return styles.paymentStatusPending
		case 'EXPIRED':
			return styles.paymentStatusExpired
		default:
			return styles.paymentStatusCancelled
	}
}

const getAutoRenewalRetryReason = (errorCode: string | null) => {
	switch (errorCode) {
		case 'insufficient_funds':
			return 'На карте недостаточно средств'
		case 'issuer_unavailable':
			return 'Банк временно недоступен'
		default:
			return 'Предыдущее автоматическое списание не прошло'
	}
}

const hasDatePassed = (
	value: string,
	serverTime: string,
	serverTimeReceivedAt: number
) => {
	const date = Date.parse(value)
	const serverTimeAtResponse = Date.parse(serverTime)
	const elapsedSinceResponse =
		serverTimeReceivedAt > 0
			? Math.max(0, Date.now() - serverTimeReceivedAt)
			: 0
	const currentServerTime = serverTimeAtResponse + elapsedSinceResponse

	return (
		Number.isFinite(date) &&
		Number.isFinite(serverTimeAtResponse) &&
		date <= currentServerTime
	)
}

const CabinetPayments = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [currentPage, setCurrentPage] = useState(1)
	const [disableConfirmationOpen, setDisableConfirmationOpen] =
		useState(false)
	const [priceConfirmationOpen, setPriceConfirmationOpen] = useState(false)
	const itemQuantity = 10

	const autoRenewalQuery = useQuery({
		queryKey: ['auto-renewal'],
		queryFn: subscriptionService.getAutoRenewal,
		enabled: auth
	})

	const paymentsQuery = useQuery({
		queryKey: ['payment-history', currentPage, itemQuantity],
		queryFn: () =>
			subscriptionService.getMyPayments(currentPage, itemQuantity),
		enabled: auth,
		placeholderData: previousData => previousData
	})

	const totalPages = paymentsQuery.data?.totalPages ?? 1
	const listPage = Array.from(
		{ length: totalPages },
		(_, index) => index + 1
	)

	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages)
	}, [currentPage, totalPages])

	const disableAutoRenewalMutation = useMutation({
		mutationFn: subscriptionService.disableAutoRenewal,
		onMutate: () => toast.loading('Отключаем автопродление...'),
		onSuccess: async (result, _, toastId) => {
			setDisableConfirmationOpen(false)
			queryClient.setQueryData(['auto-renewal'], result)
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['subscription'] }),
				queryClient.invalidateQueries({ queryKey: ['payment-history'] })
			])
			toast.success(
				'Автопродление отключено. Оплаченный период сохранится.',
				{ id: toastId }
			)
		},
		onError: (error, _, toastId) => {
			toast.error(
				`Не удалось отключить автопродление: ${errorCatch(error)}`,
				{ id: toastId }
			)
		}
	})

	const confirmPriceMutation = useMutation({
		mutationFn: subscriptionService.confirmAutoRenewalPrice,
		onMutate: () =>
			toast.loading('Подтверждаем новую стоимость автопродления...'),
		onSuccess: async (result, _, toastId) => {
			setPriceConfirmationOpen(false)
			queryClient.setQueryData(['auto-renewal'], result.autoRenewal)
			await queryClient.invalidateQueries({
				queryKey: ['payment-history']
			})
			toast.success(result.message, { id: toastId })
		},
		onError: (error, _, toastId) => {
			toast.error(
				`Не удалось подтвердить новую стоимость: ${errorCatch(error)}`,
				{ id: toastId }
			)
		}
	})

	const retryAutoRenewal = async () => {
		const toastId = 'auto-renewal-retry'
		toast.loading('Обновляем статус автопродления...', { id: toastId })
		const result = await autoRenewalQuery.refetch()

		if (result.isError) {
			toast.error('Не удалось загрузить статус автопродления', {
				id: toastId
			})
			return
		}

		toast.success('Статус автопродления обновлён', { id: toastId })
	}

	const retryPaymentHistory = async () => {
		const toastId = 'payment-history-retry'
		toast.loading('Обновляем историю платежей...', { id: toastId })
		const result = await paymentsQuery.refetch()

		if (result.isError) {
			toast.error('Не удалось загрузить историю платежей', {
				id: toastId
			})
			return
		}

		toast.success('История платежей обновлена', { id: toastId })
	}

	const changeActivePage = (page: number) => {
		setCurrentPage(page)
		toast.success(`Открыта страница ${page}`, {
			id: 'payment-history-page'
		})
	}
	const prevPage = () => changeActivePage(Math.max(1, currentPage - 1))
	const nextPage = () =>
		changeActivePage(Math.min(totalPages, currentPage + 1))

	const autoRenewal = autoRenewalQuery.data
	const payments = paymentsQuery.data?.items ?? []
	const autoRenewalNeedsPriceConfirmation = Boolean(
		autoRenewal?.priceChange?.required
	)
	const scheduledRetry =
		autoRenewal?.retry?.active && autoRenewal.retry.nextRetryAt
			? autoRenewal.retry
			: null
	const scheduledRetryAt = scheduledRetry?.nextRetryAt ?? null
	const priceChangeChargeAt =
		scheduledRetryAt ?? autoRenewal?.nextChargeAt ?? null
	const priceChangeChargeDatePassed = Boolean(
		autoRenewal &&
		priceChangeChargeAt &&
		hasDatePassed(
			priceChangeChargeAt,
			autoRenewal.serverTime,
			autoRenewalQuery.dataUpdatedAt
		)
	)
	const scheduledRetryAmount =
		autoRenewal?.priceChange?.required &&
		autoRenewal.priceChange.newAmount !== null
			? autoRenewal.priceChange.newAmount
			: (autoRenewal?.amount ?? null)
	const scheduledRetryCurrency =
		autoRenewal?.priceChange?.required &&
		autoRenewal.priceChange.currency !== null
			? autoRenewal.priceChange.currency
			: (autoRenewal?.currency ?? 'RUB')
	const autoRenewalTitle = autoRenewalNeedsPriceConfirmation
		? 'Ожидает подтверждения новой цены'
		: scheduledRetry
			? 'Запланировано повторное списание'
			: autoRenewal
				? AUTO_RENEWAL_STATUS_LABELS[autoRenewal.status]
				: ''

	const renderReceipt = (payment: IUserPayment) =>
		payment.receipt?.url ? (
			<a
				className={styles.paymentReceiptLink}
				href={payment.receipt.url}
				target="_blank"
				rel="noopener noreferrer"
			>
				Открыть чек
			</a>
		) : payment.receipt?.status === 'canceled' ? (
			<span className={styles.paymentValueMuted}>Чек отменён</span>
		) : payment.receipt ? (
			<span className={styles.paymentValueMuted}>Ссылка недоступна</span>
		) : payment.status === 'SUCCEEDED' && payment.receiptSyncEligible ? (
			<span className={styles.paymentReceiptPending}>Формируется</span>
		) : payment.status === 'SUCCEEDED' ? (
			<span className={styles.paymentValueMuted}>
				Недоступен для старого платежа
			</span>
		) : (
			<span className={styles.paymentValueMuted}>—</span>
		)

	return (
		<>
			<section className={styles.section}>
				<div className={styles.paymentsSectionHeading}>
					<div>
						<h2 className={styles.paymentsTitle}>Автопродление</h2>
						<p className={styles.paymentsDescription}>
							Управляйте будущими автоматическими списаниями подписки.
						</p>
					</div>
				</div>

				{autoRenewalQuery.isLoading ? (
					<div className={styles.autoRenewalSkeleton} aria-hidden="true">
						<SkeletonLoader count={1} className="h-5 w-40" />
						<SkeletonLoader count={2} className="h-4 w-full" />
						<SkeletonLoader count={1} className="h-10 w-44" />
					</div>
				) : autoRenewalQuery.isError || !autoRenewal ? (
					<div className={styles.paymentsError} role="alert">
						<p>Не удалось загрузить статус автопродления.</p>
						<button
							type="button"
							className={styles.paymentRetryButton}
							onClick={() => void retryAutoRenewal()}
						>
							Повторить
						</button>
					</div>
				) : (
					<div className={styles.autoRenewalCard}>
						<div className={styles.autoRenewalHeader}>
							<div>
								<p className={styles.autoRenewalLabel}>Статус</p>
								<p className={styles.autoRenewalTitle}>
									{autoRenewalTitle}
								</p>
							</div>
							<span
								className={`${styles.autoRenewalBadge} ${
									autoRenewalNeedsPriceConfirmation || scheduledRetry
										? styles.autoRenewalBadgeRetry
										: autoRenewal.active
											? styles.autoRenewalBadgeActive
											: styles.autoRenewalBadgeInactive
								}`}
							>
								{autoRenewalNeedsPriceConfirmation
									? 'Нужно подтверждение'
									: scheduledRetry
										? 'Ожидает повтора'
										: autoRenewal.active
											? 'Активно'
											: 'Неактивно'}
							</span>
						</div>

						{autoRenewal.plan && (
							<dl className={styles.autoRenewalMeta}>
								<div>
									<dt>Тариф</dt>
									<dd>
										{autoRenewal.plan
											? PLAN_LABELS[autoRenewal.plan]
											: '—'}
									</dd>
								</div>
								<div>
									<dt>Период</dt>
									<dd>
										{autoRenewal.billingPeriod
											? PERIOD_LABELS[autoRenewal.billingPeriod]
											: '—'}
									</dd>
								</div>
								<div>
									<dt>
										{scheduledRetry
											? 'Повторное списание'
											: 'Следующее списание'}
									</dt>
									<dd>
										{formatDate(
											scheduledRetryAt ?? autoRenewal.nextChargeAt
										)}
									</dd>
								</div>
								<div>
									<dt>Сумма</dt>
									<dd>
										{formatAmount(
											autoRenewal.amount,
											autoRenewal.currency
										)}
									</dd>
								</div>
							</dl>
						)}

						{scheduledRetry && (
							<div className={styles.autoRenewalRetryCard} role="status">
								<div>
									<p className={styles.autoRenewalRetryTitle}>
										Повторная попытка списания
									</p>
									<p className={styles.autoRenewalRetryReason}>
										Причина:{' '}
										<strong>
											{getAutoRenewalRetryReason(
												scheduledRetry.lastErrorCode
											)}
										</strong>
									</p>
								</div>
								<dl className={styles.autoRenewalRetryMeta}>
									<div>
										<dt>Попытка</dt>
										<dd>
											{scheduledRetry.attempt} из{' '}
											{scheduledRetry.maxAttempts}
										</dd>
									</div>
									<div>
										<dt>
											{autoRenewalNeedsPriceConfirmation
												? 'После подтверждения'
												: 'Сумма'}
										</dt>
										<dd>
											{formatAmount(
												scheduledRetryAmount,
												scheduledRetryCurrency
											)}
										</dd>
									</div>
									<div>
										<dt>Дата и время</dt>
										<dd>{formatDate(scheduledRetryAt)}</dd>
									</div>
								</dl>
								<p className={styles.autoRenewalRetryWarning}>
									До успешного списания подписка на новый период не
									продлевается. Автопродление можно отключить до повторной
									попытки.
								</p>
							</div>
						)}

						{autoRenewal.disableReason && !autoRenewal.active && (
							<p className={styles.autoRenewalReason}>
								{autoRenewal.disableReason}
							</p>
						)}

						{autoRenewal.priceChange?.required && (
							<div className={styles.priceChangeCard}>
								<div>
									<p className={styles.priceChangeTitle}>
										Изменилась стоимость автопродления
									</p>
									<p className={styles.priceChangeText}>
										Новая сумма не будет списана без вашего явного
										подтверждения.
									</p>
								</div>
								<div className={styles.priceChangeAmounts}>
									<span>
										Было{' '}
										<strong>
											{formatAmount(
												autoRenewal.priceChange.previousAmount,
												autoRenewal.priceChange.currency ??
													autoRenewal.currency
											)}
										</strong>
									</span>
									<span aria-hidden="true">→</span>
									<span>
										Стало{' '}
										<strong>
											{formatAmount(
												autoRenewal.priceChange.newAmount,
												autoRenewal.priceChange.currency ??
													autoRenewal.currency
											)}
										</strong>
									</span>
								</div>
								{autoRenewal.priceChange.detectedAt && (
									<p className={styles.priceChangeDetectedAt}>
										Обнаружено:{' '}
										{formatDate(autoRenewal.priceChange.detectedAt)}
									</p>
								)}
								{priceChangeChargeDatePassed && (
									<p className={styles.priceChangeRetryWarning}>
										Расчётная дата списания уже наступила. После
										подтверждения новой стоимости списание может начаться
										сразу.
									</p>
								)}
								{autoRenewal.priceChange.canConfirm ? (
									<button
										type="button"
										className={styles.confirmPriceButton}
										onClick={() => setPriceConfirmationOpen(true)}
										disabled={confirmPriceMutation.isPending}
									>
										Подтвердить новую стоимость
									</button>
								) : (
									<p className={styles.priceChangeText}>
										Подтверждение недоступно. Для продолжения оформите
										подписку заново на странице оплаты.
									</p>
								)}
							</div>
						)}

						<div className={styles.autoRenewalActions}>
							{autoRenewal.canDisable && (
								<button
									type="button"
									className={styles.disableAutoRenewalButton}
									onClick={() => setDisableConfirmationOpen(true)}
									disabled={disableAutoRenewalMutation.isPending}
								>
									Отвязать карту и отключить автопродление
								</button>
							)}
							{!autoRenewal.active && autoRenewal.canEnableViaCheckout && (
								<Link
									href="/payment"
									className={styles.enableAutoRenewalLink}
								>
									Подключить при оплате
								</Link>
							)}
						</div>
					</div>
				)}
			</section>

			<section className={styles.section}>
				<div className={styles.paymentsSectionHeading}>
					<div>
						<h2 className={styles.paymentsTitle}>История платежей</h2>
						<p className={styles.paymentsDescription}>
							Все платежи и ссылки на зарегистрированные кассовые чеки у
							ОФД.
						</p>
					</div>
					{paymentsQuery.isFetching && !paymentsQuery.isLoading && (
						<span className={styles.paymentsUpdating} role="status">
							Обновляем…
						</span>
					)}
				</div>

				{paymentsQuery.isLoading ? (
					<div
						className={styles.paymentHistorySkeleton}
						aria-hidden="true"
					>
						<SkeletonLoader count={1} className="h-10 w-full mb-2" />
						<SkeletonLoader count={5} className="h-14 w-full mb-2" />
					</div>
				) : paymentsQuery.isError ? (
					<div className={styles.paymentsError} role="alert">
						<p>Не удалось загрузить историю платежей.</p>
						<button
							type="button"
							className={styles.paymentRetryButton}
							onClick={() => void retryPaymentHistory()}
						>
							Повторить
						</button>
					</div>
				) : payments.length === 0 ? (
					<div className={styles.paymentsEmpty}>
						<p className={styles.paymentsEmptyTitle}>Платежей пока нет</p>
						<p className={styles.paymentsEmptyText}>
							После первой оплаты здесь появятся её статус и чек.
						</p>
					</div>
				) : (
					<>
						<div className={styles.paymentsDesktop}>
							<table className={styles.paymentsTable}>
								<thead>
									<tr>
										<th>Дата</th>
										<th>Статус</th>
										<th>Тариф</th>
										<th>Период</th>
										<th>Сумма</th>
										<th>Тип</th>
										<th>Чек</th>
									</tr>
								</thead>
								<tbody>
									{payments.map(payment => (
										<tr key={payment.id}>
											<td>
												{formatDate(
													payment.succeededAt ?? payment.createdAt
												)}
											</td>
											<td>
												<span
													className={`${styles.paymentStatus} ${getPaymentStatusClassName(payment.status)}`}
												>
													{PAYMENT_STATUS_LABELS[payment.status]}
												</span>
											</td>
											<td>
												{payment.plan ? PLAN_LABELS[payment.plan] : '—'}
											</td>
											<td>
												{payment.billingPeriod
													? PERIOD_LABELS[payment.billingPeriod]
													: '—'}
											</td>
											<td>
												{formatAmount(payment.amount, payment.currency)}
											</td>
											<td>{getPaymentTypeLabel(payment)}</td>
											<td>{renderReceipt(payment)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className={styles.paymentsMobile}>
							{payments.map(payment => (
								<article
									key={payment.id}
									className={styles.paymentMobileCard}
								>
									<div className={styles.paymentMobileHeader}>
										<strong>
											{formatAmount(payment.amount, payment.currency)}
										</strong>
										<span
											className={`${styles.paymentStatus} ${getPaymentStatusClassName(payment.status)}`}
										>
											{PAYMENT_STATUS_LABELS[payment.status]}
										</span>
									</div>
									<dl className={styles.paymentMobileMeta}>
										<div>
											<dt>Дата</dt>
											<dd>
												{formatDate(
													payment.succeededAt ?? payment.createdAt
												)}
											</dd>
										</div>
										<div>
											<dt>Тариф и период</dt>
											<dd>
												{payment.plan ? PLAN_LABELS[payment.plan] : '—'}
												{' · '}
												{payment.billingPeriod
													? PERIOD_LABELS[payment.billingPeriod]
													: '—'}
											</dd>
										</div>
										<div>
											<dt>Тип платежа</dt>
											<dd>{getPaymentTypeLabel(payment)}</dd>
										</div>
										<div>
											<dt>Чек</dt>
											<dd>{renderReceipt(payment)}</dd>
										</div>
									</dl>
								</article>
							))}
						</div>

						{paymentsQuery.data &&
							paymentsQuery.data.total > itemQuantity && (
								<Pagination
									listPage={listPage}
									currentPage={currentPage}
									prevPage={prevPage}
									nextPage={nextPage}
									changeActivePage={changeActivePage}
								/>
							)}
					</>
				)}
			</section>

			{disableConfirmationOpen && autoRenewal && (
				<ConfirmDialog
					title="Отвязать карту и отключить автопродление?"
					message={
						scheduledRetry
							? `Сохранённая карта будет отвязана и больше не будет использоваться для автоматических списаний. Текущий оплаченный период сохранится. Запланированное повторное списание ${formatDate(
									scheduledRetryAt
								)} будет отменено.`
							: 'Сохранённая карта будет отвязана и больше не будет использоваться для автоматических списаний. Текущий оплаченный период сохранится.'
					}
					confirmLabel={
						disableAutoRenewalMutation.isPending
							? 'Отвязываем…'
							: 'Отвязать карту'
					}
					confirmDisabled={disableAutoRenewalMutation.isPending}
					onCancel={() => setDisableConfirmationOpen(false)}
					onConfirm={() => disableAutoRenewalMutation.mutate()}
				/>
			)}

			{priceConfirmationOpen && autoRenewal?.priceChange?.required && (
				<ConfirmDialog
					title="Подтвердить новую стоимость?"
					message={`Вы подтверждаете будущие автоматические списания по новой стоимости ${formatAmount(
						autoRenewal.priceChange.newAmount,
						autoRenewal.priceChange.currency ?? autoRenewal.currency
					)} за ${
						autoRenewal.billingPeriod === 'YEARLY' ? 'год' : 'месяц'
					}. Без подтверждения новая сумма списана не будет.${
						priceChangeChargeDatePassed
							? ' Расчётная дата списания уже наступила, поэтому после подтверждения списание может начаться сразу.'
							: ''
					}`}
					confirmLabel={
						confirmPriceMutation.isPending
							? 'Подтверждаем…'
							: 'Подтвердить'
					}
					confirmDisabled={confirmPriceMutation.isPending}
					onCancel={() => setPriceConfirmationOpen(false)}
					onConfirm={() => confirmPriceMutation.mutate()}
				/>
			)}
		</>
	)
}

export default CabinetPayments
