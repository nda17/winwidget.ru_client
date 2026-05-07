'use client'

import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import subscriptionService, {
	type IPendingPayment
} from '@/services/subscription/subscription.service'
import type {
	HomePagePricingContent,
	HomePagePricingPlan
} from '@/services/home-page-content/home-page-content.types'
import tariffPricesService from '@/services/tariff-prices/tariff-prices.service'
import {
	createTariffPriceMap,
	type TariffPrice
} from '@/services/tariff-prices/tariff-prices.types'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './Pricing.module.scss'

const PLAN_PRIORITY: Record<Plan, number> = {
	TRIAL: 0,
	EASY: 1,
	HARD: 2
}

type PaidPlan = Extract<Plan, 'EASY' | 'HARD'>

const PLAN_COLORS: Record<PaidPlan, string> = {
	EASY: '#4705fb',
	HARD: '#7b2fff'
}

const PLAN_TITLE_FALLBACK: Record<Plan, string> = {
	TRIAL: 'Тест-драйв',
	EASY: 'Easy',
	HARD: 'Hard'
}

const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = {
	MONTHLY: 'месяц',
	YEARLY: 'год'
}

const PAYMENT_COPY = {
	title: 'Оплата',
	paymentDisabledNotice: 'Оплата временно недоступна. Попробуйте позже.',
	currentPlanText: 'Текущий тариф:',
	currentPlanUntilText: 'до',
	activeStatusText: 'Активен',
	expiredStatusText: 'Истек',
	pendingPaymentTitle: 'У вас есть незавершённый платёж',
	pendingPaymentUnavailableTitle: 'Этот платёж больше недоступен',
	pendingPaymentText:
		'Можно вернуться к оплате {payment} или отменить текущую попытку и создать новый платёж.',
	pendingPaymentUnavailableText:
		'У вас активен тариф {currentPlan}. Оплата более низкого тарифа {payment} недоступна до окончания текущей подписки. Можно отменить эту попытку.',
	pendingPaymentResumeButtonText: 'Вернуться к оплате',
	pendingPaymentCancelButtonText: 'Отменить платёж',
	pendingPaymentCancelLoadingText: 'Отменяем...',
	periodLegendText: 'Период оплаты',
	pricePerMonthText: '/мес',
	yearlyTotalText: '{amount} ₽ / год',
	unavailableButtonText: 'Недоступно',
	renewButtonText: 'Продлить',
	payButtonText: 'Оплатить',
	downgradeRestrictionText:
		'Понижение недоступно, пока активен {currentPlan}',
	paymentNote:
		'После оплаты подписка активируется автоматически. Оплата через ЮKassa.',
	pendingPaymentNote:
		'Пока есть незавершённый платёж, создание нового платежа недоступно.',
	carryoverNote:
		'Оплачивать подписку можно сколько угодно раз — срок суммируется. При продлении текущего тарифа и переходе на более высокий оставшиеся дни переносятся на новый период.'
}

const formatRub = (value: number) =>
	new Intl.NumberFormat('ru-RU').format(value)

const isPaidPlan = (plan: string): plan is PaidPlan =>
	plan === 'EASY' || plan === 'HARD'

const isPaidPricingPlan = (
	plan: HomePagePricingPlan
): plan is HomePagePricingPlan & { key: PaidPlan } => isPaidPlan(plan.key)

const formatText = (
	template: string,
	values: Record<string, string>
): string =>
	Object.entries(values).reduce(
		(text, [key, value]) => text.split(`{${key}}`).join(value),
		template
	)

const renderTemplate = (
	template: string,
	values: Record<string, ReactNode>
): ReactNode[] => {
	const result: ReactNode[] = []
	const pattern = /\{([a-zA-Z0-9_]+)\}/g
	let lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(template)) !== null) {
		if (match.index > lastIndex) {
			result.push(template.slice(lastIndex, match.index))
		}

		const value = values[match[1]]
		result.push(value ?? match[0])
		lastIndex = pattern.lastIndex
	}

	if (lastIndex < template.length) {
		result.push(template.slice(lastIndex))
	}

	return result
}

const getPendingPaymentLabel = (
	pendingPayment: IPendingPayment,
	planLabel: Record<Plan, string>
) => {
	const paymentPlanLabel =
		pendingPayment.plan && planLabel[pendingPayment.plan]
			? planLabel[pendingPayment.plan]
			: 'выбранный тариф'

	const periodLabel = pendingPayment.billingPeriod
		? BILLING_PERIOD_LABEL[pendingPayment.billingPeriod]
		: 'период'

	return `${paymentPlanLabel} на ${periodLabel}`
}

interface PricingProps {
	pricingContent: HomePagePricingContent
	paymentEnabled?: boolean
	tariffPrices?: TariffPrice[] | null
}

const Pricing = ({
	pricingContent,
	paymentEnabled = true,
	tariffPrices = null
}: PricingProps) => {
	const auth = useAuthStore(state => state.auth)
	const [period, setPeriod] = useState<BillingPeriod>('YEARLY')

	const { data: actualTariffPrices = tariffPrices } = useQuery({
		queryKey: ['tariff-prices'],
		queryFn: tariffPricesService.get,
		initialData: tariffPrices ?? undefined
	})
	const tariffPriceMap = createTariffPriceMap(actualTariffPrices)
	const paidPlans = pricingContent.plans.filter(isPaidPricingPlan)
	const planLabel: Record<Plan, string> = {
		TRIAL: PLAN_TITLE_FALLBACK.TRIAL,
		EASY:
			paidPlans.find(plan => plan.key === 'EASY')?.title ??
			PLAN_TITLE_FALLBACK.EASY,
		HARD:
			paidPlans.find(plan => plan.key === 'HARD')?.title ??
			PLAN_TITLE_FALLBACK.HARD
	}

	const { data: subscription, isLoading: subLoading } = useQuery({
		queryKey: ['subscription'],
		queryFn: subscriptionService.getMySubscription,
		enabled: auth
	})

	const {
		data: pendingPayment,
		isLoading: pendingLoading,
		refetch
	} = useQuery({
		queryKey: ['pending-payment'],
		queryFn: subscriptionService.getPendingPayment,
		enabled: auth
	})

	const payMutation = useMutation({
		mutationFn: ({
			plan,
			billingPeriod
		}: {
			plan: Plan
			billingPeriod: BillingPeriod
		}) => subscriptionService.createPayment(plan, billingPeriod),
		onMutate: () =>
			toast.loading('Создаём платёж, пожалуйста подождите...'),
		onSuccess: ({ confirmationUrl }, _, toastId) => {
			toast.dismiss(toastId)
			window.location.href = confirmationUrl
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка оплаты', {
				id: toastId
			})
		}
	})

	const cancelPendingMutation = useMutation({
		mutationFn: subscriptionService.cancelPendingPayment,
		onMutate: () => toast.loading('Отменяем незавершённый платёж...'),
		onSuccess: async (result, _, toastId) => {
			await refetch()
			toast.success(result.message, {
				id: toastId
			})
		},
		onError: (e: any, _, toastId) => {
			toast.error(
				e?.response?.data?.message || 'Не удалось отменить платёж',
				{
					id: toastId
				}
			)
		}
	})

	const isYearly = period === 'YEARLY'

	const currentPlan = subscription?.plan
	const currentPeriod = subscription?.billingPeriod
	const isActive = subscription?.status === 'ACTIVE'
	const activePendingPayment = pendingPayment?.confirmationUrl
		? pendingPayment
		: null
	const hasPendingPayment = Boolean(activePendingPayment)
	const pendingPaymentLabel = activePendingPayment
		? getPendingPaymentLabel(activePendingPayment, planLabel)
		: null
	const currentPlanLabel = currentPlan ? planLabel[currentPlan] : null
	const isPendingDowngradeBlocked = Boolean(
		hasPendingPayment &&
		isActive &&
		currentPlan &&
		activePendingPayment?.plan &&
		PLAN_PRIORITY[currentPlan] > PLAN_PRIORITY[activePendingPayment.plan]
	)
	const isActionsDisabled =
		!paymentEnabled ||
		payMutation.isPending ||
		cancelPendingMutation.isPending ||
		pendingLoading

	return (
		<section className={styles.page} aria-labelledby="pricing-page-title">
			<h1 id="pricing-page-title" className={styles.title}>
				{PAYMENT_COPY.title}
			</h1>

			{!paymentEnabled && (
				<div className={styles.paymentDisabledNotice}>
					{PAYMENT_COPY.paymentDisabledNotice}
				</div>
			)}

			{auth && subLoading ? (
				<div className={styles.currentPlan} aria-hidden="true">
					<SkeletonLoader
						height={18}
						width={220}
						containerClassName={styles.currentPlanSkeletonLine}
					/>
					<SkeletonLoader
						height={18}
						width={90}
						containerClassName={styles.currentPlanSkeletonLine}
					/>
					<SkeletonLoader
						height={24}
						width={74}
						borderRadius={999}
						containerClassName={styles.currentPlanSkeletonBadge}
					/>
				</div>
			) : subscription ? (
				<div className={styles.currentPlan}>
					<span>
						{PAYMENT_COPY.currentPlanText}{' '}
						<strong>{planLabel[subscription.plan]}</strong>
					</span>
					{subscription.expiresAt && (
						<span>
							{PAYMENT_COPY.currentPlanUntilText}{' '}
							{new Date(subscription.expiresAt).toLocaleDateString(
								'ru-RU'
							)}
						</span>
					)}
					<span
						className={
							isActive ? styles.statusActive : styles.statusExpired
						}
					>
						{isActive
							? PAYMENT_COPY.activeStatusText
							: PAYMENT_COPY.expiredStatusText}
					</span>
				</div>
			) : null}

			{auth && pendingLoading ? (
				<div
					className={`${styles.pendingNotice} ${styles.pendingNoticeSkeleton}`}
					aria-hidden="true"
				>
					<div className={styles.pendingCopy}>
						<SkeletonLoader
							height={16}
							width={210}
							containerClassName={styles.pendingSkeletonLine}
						/>
						<SkeletonLoader
							height={14}
							width={280}
							containerClassName={styles.pendingSkeletonLine}
						/>
					</div>
					<div className={styles.pendingSkeletonActions}>
						<SkeletonLoader
							height={40}
							width={170}
							borderRadius={14}
							containerClassName={styles.pendingSkeletonButton}
						/>
					</div>
				</div>
			) : hasPendingPayment ? (
				<div className={styles.pendingNotice}>
					<div className={styles.pendingCopy}>
						<p className={styles.pendingTitle}>
							{isPendingDowngradeBlocked
								? PAYMENT_COPY.pendingPaymentUnavailableTitle
								: PAYMENT_COPY.pendingPaymentTitle}
						</p>
						<p className={styles.pendingText}>
							{isPendingDowngradeBlocked ? (
								<>
									{renderTemplate(
										PAYMENT_COPY.pendingPaymentUnavailableText,
										{
											currentPlan: (
												<strong key="currentPlan">
													{currentPlanLabel}
												</strong>
											),
											payment: (
												<strong key="payment">
													{pendingPaymentLabel}
												</strong>
											)
										}
									)}
								</>
							) : (
								<>
									{renderTemplate(PAYMENT_COPY.pendingPaymentText, {
										payment: (
											<strong key="payment">{pendingPaymentLabel}</strong>
										)
									})}
								</>
							)}
						</p>
					</div>
					<div className={styles.pendingActions}>
						{!isPendingDowngradeBlocked && (
							<a
								href={activePendingPayment?.confirmationUrl ?? undefined}
								className={styles.pendingResumeBtn}
							>
								{PAYMENT_COPY.pendingPaymentResumeButtonText}
							</a>
						)}
						<button
							type="button"
							className={styles.pendingCancelBtn}
							onClick={() => cancelPendingMutation.mutate()}
							disabled={cancelPendingMutation.isPending}
						>
							{cancelPendingMutation.isPending
								? PAYMENT_COPY.pendingPaymentCancelLoadingText
								: PAYMENT_COPY.pendingPaymentCancelButtonText}
						</button>
					</div>
				</div>
			) : null}

			{/* Period toggle */}
			<fieldset className={styles.periodGroup}>
				<legend className="srOnly">{PAYMENT_COPY.periodLegendText}</legend>
				<div className={styles.periodToggle}>
					<button
						type="button"
						className={`${styles.periodBtn} ${!isYearly ? styles.periodActive : ''}`}
						onClick={() => setPeriod('MONTHLY')}
					>
						{pricingContent.monthlyToggleText}
					</button>
					<button
						type="button"
						className={`${styles.periodBtn} ${isYearly ? styles.periodActive : ''}`}
						onClick={() => setPeriod('YEARLY')}
					>
						{pricingContent.yearlyToggleText}
						{pricingContent.discountText && (
							<span className={styles.discount}>
								{pricingContent.discountText}
							</span>
						)}
					</button>
				</div>
			</fieldset>

			<div className={styles.plans}>
				{paidPlans.map(plan => {
					const planPrices = tariffPriceMap[plan.key]
					const price = isYearly
						? Math.round(planPrices.YEARLY / 12)
						: planPrices.MONTHLY
					const isDowngradeBlocked = Boolean(
						isActive &&
						currentPlan &&
						PLAN_PRIORITY[currentPlan] > PLAN_PRIORITY[plan.key]
					)
					const isCurrentPlan =
						currentPlan === plan.key &&
						(!currentPeriod || currentPeriod === period) &&
						isActive
					const titleId = `plan-${plan.key.toLowerCase()}-title`

					return (
						<article
							key={plan.key}
							className={styles.planCard}
							aria-labelledby={titleId}
						>
							<h2
								id={titleId}
								className={styles.planName}
								style={{ color: PLAN_COLORS[plan.key] }}
							>
								{plan.title}
							</h2>
							{plan.subtitle && (
								<p className={styles.planSubtitle}>{plan.subtitle}</p>
							)}

							<div className={styles.priceBlock}>
								<span className={styles.price}>{formatRub(price)} ₽</span>
								<span className={styles.pricePer}>
									{PAYMENT_COPY.pricePerMonthText}
								</span>
							</div>

							{isYearly && (
								<p className={styles.yearlyNote}>
									{formatText(PAYMENT_COPY.yearlyTotalText, {
										amount: formatRub(planPrices.YEARLY)
									})}
								</p>
							)}

							<ul className={styles.features}>
								{plan.features.map(feature => (
									<li key={feature}>{feature}</li>
								))}
							</ul>

							<button
								type="button"
								className={styles.buyBtn}
								style={{ background: PLAN_COLORS[plan.key] }}
								disabled={
									isActionsDisabled ||
									hasPendingPayment ||
									isDowngradeBlocked
								}
								onClick={() =>
									payMutation.mutate({
										plan: plan.key,
										billingPeriod: period
									})
								}
							>
								{isDowngradeBlocked
									? PAYMENT_COPY.unavailableButtonText
									: isCurrentPlan
										? PAYMENT_COPY.renewButtonText
										: PAYMENT_COPY.payButtonText}
							</button>

							{isDowngradeBlocked && currentPlanLabel && (
								<p className={styles.planRestriction}>
									{renderTemplate(PAYMENT_COPY.downgradeRestrictionText, {
										currentPlan: (
											<strong key="currentPlan">{currentPlanLabel}</strong>
										)
									})}
								</p>
							)}
						</article>
					)
				})}
			</div>

			{PAYMENT_COPY.paymentNote && (
				<p className={styles.note}>{PAYMENT_COPY.paymentNote}</p>
			)}

			{hasPendingPayment && PAYMENT_COPY.pendingPaymentNote && (
				<p className={styles.notePending}>
					{PAYMENT_COPY.pendingPaymentNote}
				</p>
			)}

			{isActive &&
				currentPlan !== 'TRIAL' &&
				PAYMENT_COPY.carryoverNote && (
					<p className={styles.noteCarryover}>
						{PAYMENT_COPY.carryoverNote}
					</p>
				)}
		</section>
	)
}

export default Pricing
