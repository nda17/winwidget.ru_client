'use client'

import subscriptionService from '@/services/subscription/subscription.service'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'
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
	const [period, setPeriod] = useState<BillingPeriod>('MONTHLY')

	const { data: subscription, isLoading: subLoading } = useQuery({
		queryKey: ['subscription'],
		queryFn: subscriptionService.getMySubscription
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
		<div className={styles.page}>
			<h1 className={styles.title}>Оплата</h1>

			{subscription && (
				<div className={styles.currentPlan}>
					<span>
						Текущий тариф: <strong>{planLabel[subscription.plan]}</strong>
					</span>
					{subscription.plan !== 'TRIAL' && subscription.expiresAt && (
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
			)}

			{/* Trial info */}
			<div className={styles.trialCard}>
				<div className={styles.trialTitle}>Тест-драйв</div>
				<div className={styles.trialDesc}>Бесплатно при регистрации</div>
				<ul className={styles.features}>
					<li>1 виджет</li>
					<li>До 10 заявок</li>
					<li>7 дней</li>
				</ul>
			</div>

			{/* Period toggle */}
			<div className={styles.periodToggle}>
				<button
					className={`${styles.periodBtn} ${!isYearly ? styles.periodActive : ''}`}
					onClick={() => setPeriod('MONTHLY')}
				>
					Ежемесячно
				</button>
				<button
					className={`${styles.periodBtn} ${isYearly ? styles.periodActive : ''}`}
					onClick={() => setPeriod('YEARLY')}
				>
					За год
					<span className={styles.discount}>−60%</span>
				</button>
			</div>

			<div className={styles.plans}>
				{PLANS.map(plan => {
					const price = isYearly ? plan.yearly : plan.monthly
					const isCurrentPlan =
						currentPlan === plan.key &&
						(!currentPeriod || currentPeriod === period) &&
						isActive

					return (
						<div key={plan.key} className={styles.planCard}>
							<div
								className={styles.planName}
								style={{ color: plan.color }}
							>
								{plan.name}
							</div>

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
								className={styles.buyBtn}
								style={{ background: plan.color }}
								disabled={payMutation.isPending || isCurrentPlan}
								onClick={() =>
									payMutation.mutate({
										plan: plan.key,
										billingPeriod: period
									})
								}
							>
								{isCurrentPlan ? 'Активен' : 'Подключить'}
							</button>
						</div>
					)
				})}
			</div>

			<p className={styles.note}>
				После оплаты подписка активируется автоматически. Оплата через
				ЮKassa.
			</p>

			{isActive && currentPlan !== 'TRIAL' && (
				<p className={styles.noteCarryover}>
					При смене или продлении тарифа оставшиеся дни текущей подписки
					переносятся на новый период.
				</p>
			)}
		</div>
	)
}

export default Pricing
