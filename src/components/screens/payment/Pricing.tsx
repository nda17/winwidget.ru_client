'use client'

import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import subscriptionService from '@/services/subscription/subscription.service'
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

const Pricing = () => {
	const auth = useAuthStore(state => state.auth)
	const [period, setPeriod] = useState<BillingPeriod>('YEARLY')

	const { data: subscription, isLoading: subLoading } = useQuery({
		queryKey: ['subscription'],
		queryFn: subscriptionService.getMySubscription,
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

	const isYearly = period === 'YEARLY'

	const planLabel: Record<string, string> = {
		TRIAL: 'Тест-драйв',
		EASY: 'Easy',
		HARD: 'Hard'
	}

	const currentPlan = subscription?.plan
	const currentPeriod = subscription?.billingPeriod
	const isActive = subscription?.status === 'ACTIVE'

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
						{isActive ? 'Активна' : 'Истекла'}
					</span>
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
								disabled={payMutation.isPending}
								onClick={() =>
									payMutation.mutate({
										plan: plan.key,
										billingPeriod: period
									})
								}
							>
								{isCurrentPlan ? 'Продлить' : 'Подключить'}
							</button>
						</article>
					)
				})}
			</div>

			<p className={styles.note}>
				После оплаты подписка активируется автоматически. Оплата через
				ЮKassa.
			</p>

			{isActive && currentPlan !== 'TRIAL' && (
				<p className={styles.noteCarryover}>
					Оплачивать подписку можно сколько угодно раз — срок суммируется.
					При смене тарифа оставшиеся дни переносятся на новый период.
				</p>
			)}
		</section>
	)
}

export default Pricing
