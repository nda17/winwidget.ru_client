'use client'

import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import subscriptionService, {
	type IPendingPayment
} from '@/services/subscription/subscription.service'
import type { HomePagePaymentContent } from '@/services/home-page-content/home-page-content.types'
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

const formatRub = (value: number) =>
	new Intl.NumberFormat('ru-RU').format(value)

const isPaidPlan = (plan: string): plan is PaidPlan =>
	plan === 'EASY' || plan === 'HARD'

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
	content: HomePagePaymentContent,
	planLabel: Record<Plan, string>,
	billingPeriodLabel: Record<BillingPeriod, string>
) => {
	const paymentPlanLabel =
		pendingPayment.plan && planLabel[pendingPayment.plan]
			? planLabel[pendingPayment.plan]
			: content.pendingPaymentFallbackPlanText

	const periodLabel = pendingPayment.billingPeriod
		? billingPeriodLabel[pendingPayment.billingPeriod]
		: content.pendingPaymentFallbackPeriodText

	return formatText(content.pendingPaymentLabelText, {
		plan: paymentPlanLabel,
		period: periodLabel
	})
}

interface PricingProps {
	content: HomePagePaymentContent
	paymentEnabled?: boolean
	tariffPrices?: TariffPrice[] | null
}

const Pricing = ({
	content,
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
	const paidPlans = content.plans.filter(
		(
			plan
		): plan is HomePagePaymentContent['plans'][number] & {
			key: PaidPlan
		} => isPaidPlan(plan.key)
	)
	const planLabel: Record<Plan, string> = {
		TRIAL: content.trialPlanLabel,
		EASY:
			paidPlans.find(plan => plan.key === 'EASY')?.name ??
			content.pendingPaymentFallbackPlanText,
		HARD:
			paidPlans.find(plan => plan.key === 'HARD')?.name ??
			content.pendingPaymentFallbackPlanText
	}
	const billingPeriodLabel: Record<BillingPeriod, string> = {
		MONTHLY: content.monthlyPeriodText,
		YEARLY: content.yearlyPeriodText
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
		onMutate: () => toast.loading(content.createPaymentLoadingText),
		onSuccess: ({ confirmationUrl }, _, toastId) => {
			toast.dismiss(toastId)
			window.location.href = confirmationUrl
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || content.paymentErrorText, {
				id: toastId
			})
		}
	})

	const cancelPendingMutation = useMutation({
		mutationFn: subscriptionService.cancelPendingPayment,
		onMutate: () => toast.loading(content.cancelPaymentLoadingText),
		onSuccess: async (result, _, toastId) => {
			await refetch()
			toast.success(result.message, {
				id: toastId
			})
		},
		onError: (e: any, _, toastId) => {
			toast.error(
				e?.response?.data?.message || content.cancelPaymentErrorText,
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
		? getPendingPaymentLabel(
				activePendingPayment,
				content,
				planLabel,
				billingPeriodLabel
			)
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
				{content.title}
			</h1>

			{!paymentEnabled && (
				<div className={styles.paymentDisabledNotice}>
					{content.paymentDisabledNotice}
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
						{content.currentPlanText}{' '}
						<strong>{planLabel[subscription.plan]}</strong>
					</span>
					{subscription.expiresAt && (
						<span>
							{content.currentPlanUntilText}{' '}
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
							? content.activeStatusText
							: content.expiredStatusText}
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
								? content.pendingPaymentUnavailableTitle
								: content.pendingPaymentTitle}
						</p>
						<p className={styles.pendingText}>
							{isPendingDowngradeBlocked ? (
								<>
									{renderTemplate(content.pendingPaymentUnavailableText, {
										currentPlan: (
											<strong key="currentPlan">{currentPlanLabel}</strong>
										),
										payment: (
											<strong key="payment">{pendingPaymentLabel}</strong>
										)
									})}
								</>
							) : (
								<>
									{renderTemplate(content.pendingPaymentText, {
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
								{content.pendingPaymentResumeButtonText}
							</a>
						)}
						<button
							type="button"
							className={styles.pendingCancelBtn}
							onClick={() => cancelPendingMutation.mutate()}
							disabled={cancelPendingMutation.isPending}
						>
							{cancelPendingMutation.isPending
								? content.pendingPaymentCancelLoadingText
								: content.pendingPaymentCancelButtonText}
						</button>
					</div>
				</div>
			) : null}

			{/* Period toggle */}
			<fieldset className={styles.periodGroup}>
				<legend className="srOnly">{content.periodLegendText}</legend>
				<div className={styles.periodToggle}>
					<button
						type="button"
						className={`${styles.periodBtn} ${!isYearly ? styles.periodActive : ''}`}
						onClick={() => setPeriod('MONTHLY')}
					>
						{content.monthlyToggleText}
					</button>
					<button
						type="button"
						className={`${styles.periodBtn} ${isYearly ? styles.periodActive : ''}`}
						onClick={() => setPeriod('YEARLY')}
					>
						{content.yearlyToggleText}
						{content.discountText && (
							<span className={styles.discount}>
								{content.discountText}
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
								style={{ color: plan.color }}
							>
								{plan.name}
							</h2>

							<div className={styles.priceBlock}>
								<span className={styles.price}>{formatRub(price)} ₽</span>
								<span className={styles.pricePer}>
									{content.pricePerMonthText}
								</span>
							</div>

							{isYearly && (
								<p className={styles.yearlyNote}>
									{formatText(content.yearlyTotalText, {
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
								style={{ background: plan.color }}
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
									? content.unavailableButtonText
									: isCurrentPlan
										? content.renewButtonText
										: content.payButtonText}
							</button>

							{isDowngradeBlocked && currentPlanLabel && (
								<p className={styles.planRestriction}>
									{renderTemplate(content.downgradeRestrictionText, {
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

			{content.paymentNote && (
				<p className={styles.note}>{content.paymentNote}</p>
			)}

			{hasPendingPayment && content.pendingPaymentNote && (
				<p className={styles.notePending}>{content.pendingPaymentNote}</p>
			)}

			{isActive && currentPlan !== 'TRIAL' && content.carryoverNote && (
				<p className={styles.noteCarryover}>{content.carryoverNote}</p>
			)}
		</section>
	)
}

export default Pricing
