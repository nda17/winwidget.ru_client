'use client'

import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import subscriptionService, {
	type IPendingPayment
} from '@/services/subscription/subscription.service'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './Pricing.module.scss'

const PLANS = [
	{
		key: 'EASY' as Plan,
		name: 'Easy',
		monthly: 990,
		yearly: 390,
		yearlyTotal: 4680,
		widgets: 1,
		leads: '100 заявок / мес',
		color: '#4705fb'
	},
	{
		key: 'HARD' as Plan,
		name: 'Hard',
		monthly: 1690,
		yearly: 790,
		yearlyTotal: 9480,
		widgets: 10,
		leads: 'Безлимит',
		color: '#7b2fff'
	}
]

const billingPeriodLabel: Record<BillingPeriod, string> = {
	MONTHLY: 'месяц',
	YEARLY: 'год'
}

const PLAN_PRIORITY: Record<Plan, number> = {
	TRIAL: 0,
	EASY: 1,
	HARD: 2
}

const planLabel: Record<Plan, string> = {
	TRIAL: 'Тест-драйв',
	EASY: 'Easy',
	HARD: 'Hard'
}

const getPendingPaymentLabel = (pendingPayment: IPendingPayment) => {
	const planLabel =
		pendingPayment.plan === 'EASY'
			? 'Easy'
			: pendingPayment.plan === 'HARD'
				? 'Hard'
				: 'выбранный тариф'

	const periodLabel = pendingPayment.billingPeriod
		? billingPeriodLabel[pendingPayment.billingPeriod]
		: 'период'

	return `${planLabel} на ${periodLabel}`
}

const Pricing = () => {
	const auth = useAuthStore(state => state.auth)
	const [period, setPeriod] = useState<BillingPeriod>('YEARLY')

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
	const hasPendingPayment = Boolean(
		pendingPayment && pendingPayment.confirmationUrl
	)
	const pendingPaymentLabel = hasPendingPayment
		? getPendingPaymentLabel(pendingPayment)
		: null
	const currentPlanLabel = currentPlan ? planLabel[currentPlan] : null
	const isPendingDowngradeBlocked = Boolean(
		hasPendingPayment &&
		isActive &&
		currentPlan &&
		pendingPayment?.plan &&
		PLAN_PRIORITY[currentPlan] > PLAN_PRIORITY[pendingPayment.plan]
	)
	const isActionsDisabled =
		payMutation.isPending ||
		cancelPendingMutation.isPending ||
		pendingLoading

	return (
		<section className={styles.page} aria-labelledby="pricing-page-title">
			<h1 id="pricing-page-title" className={styles.title}>
				Оплата
			</h1>

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
						Текущий тариф: <strong>{planLabel[subscription.plan]}</strong>
					</span>
					{subscription.expiresAt && (
						<span>
							до{' '}
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
						{isActive ? 'Активен' : 'Истек'}
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
								? 'Этот платёж больше недоступен'
								: 'У вас есть незавершённый платёж'}
						</p>
						<p className={styles.pendingText}>
							{isPendingDowngradeBlocked ? (
								<>
									У вас активен тариф <strong>{currentPlanLabel}</strong>.
									Оплата более низкого тарифа{' '}
									<strong>{pendingPaymentLabel}</strong> недоступна до
									окончания текущей подписки. Можно отменить эту попытку.
								</>
							) : (
								<>
									Можно вернуться к оплате{' '}
									<strong>{pendingPaymentLabel}</strong> или отменить
									текущую попытку и создать новый платёж.
								</>
							)}
						</p>
					</div>
					<div className={styles.pendingActions}>
						{!isPendingDowngradeBlocked && (
							<a
								href={pendingPayment.confirmationUrl ?? undefined}
								className={styles.pendingResumeBtn}
							>
								Вернуться к оплате
							</a>
						)}
						<button
							type="button"
							className={styles.pendingCancelBtn}
							onClick={() => cancelPendingMutation.mutate()}
							disabled={cancelPendingMutation.isPending}
						>
							{cancelPendingMutation.isPending
								? 'Отменяем...'
								: 'Отменить платёж'}
						</button>
					</div>
				</div>
			) : null}

			{/* Period toggle */}
			<fieldset className={styles.periodGroup}>
				<legend className="srOnly">Период оплаты</legend>
				<div className={styles.periodToggle}>
					<button
						type="button"
						className={`${styles.periodBtn} ${!isYearly ? styles.periodActive : ''}`}
						onClick={() => setPeriod('MONTHLY')}
					>
						Ежемесячно
					</button>
					<button
						type="button"
						className={`${styles.periodBtn} ${isYearly ? styles.periodActive : ''}`}
						onClick={() => setPeriod('YEARLY')}
					>
						За год
						<span className={styles.discount}>−60%</span>
					</button>
				</div>
			</fieldset>

			<div className={styles.plans}>
				{PLANS.map(plan => {
					const price = isYearly ? plan.yearly : plan.monthly
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
								<span className={styles.price}>{price} ₽</span>
								<span className={styles.pricePer}>/мес</span>
							</div>

							{isYearly && (
								<p className={styles.yearlyNote}>
									{plan.yearlyTotal} ₽ / год
								</p>
							)}

							<ul className={styles.features}>
								<li>
									{plan.widgets}{' '}
									{plan.widgets === 1 ? 'виджет' : 'виджетов'}
								</li>
								<li>{plan.leads}</li>
								<li>Email уведомления</li>
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
									? 'Недоступно'
									: isCurrentPlan
										? 'Продлить'
										: 'Оплатить'}
							</button>

							{isDowngradeBlocked && currentPlanLabel && (
								<p className={styles.planRestriction}>
									Понижение недоступно, пока активен{' '}
									<strong>{currentPlanLabel}</strong>
								</p>
							)}
						</article>
					)
				})}
			</div>

			<p className={styles.note}>
				После оплаты подписка активируется автоматически. Оплата через
				ЮKassa.
			</p>

			{hasPendingPayment && (
				<p className={styles.notePending}>
					Пока есть незавершённый платёж, создание нового платежа
					недоступно.
				</p>
			)}

			{isActive && currentPlan !== 'TRIAL' && (
				<p className={styles.noteCarryover}>
					Оплачивать подписку можно сколько угодно раз — срок суммируется.
					При продлении текущего тарифа и переходе на более высокий
					оставшиеся дни переносятся на новый период.
				</p>
			)}
		</section>
	)
}

export default Pricing
