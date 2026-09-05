'use client'

import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import type {
	HomePagePlanPrice,
	HomePagePricingContent
} from '@/entities/home-page-content'
import { tariffPricesService } from '@/entities/subscription'
import {
	createTariffPriceMap,
	type PaidPlan,
	type TariffPrice
} from '@/entities/subscription'
import { useAuthStore } from '@/entities/user'
import { useQuery } from '@tanstack/react-query'
import Link from '@/shared/lib/navigation/ZoneLink'
import { useState } from 'react'
import styles from './HomePricing.module.scss'

type BillingPeriod = 'monthly' | 'yearly'

interface Props {
	content: HomePagePricingContent
	tariffPrices?: TariffPrice[] | null
}

const isPaidPlan = (plan: string): plan is PaidPlan =>
	plan === 'EASY' || plan === 'HARD'

const formatRub = (value: number) =>
	new Intl.NumberFormat('ru-RU').format(value)

const HomePricing = ({ content, tariffPrices = null }: Props) => {
	const [billing, setBilling] = useState<BillingPeriod>('yearly')
	const auth = useAuthStore(state => state.auth)
	const ctaHref = auth ? PUBLIC_PAGES.PAYMENT : PUBLIC_PAGES.REGISTER
	const { data: actualTariffPrices = tariffPrices } = useQuery({
		queryKey: ['tariff-prices'],
		queryFn: tariffPricesService.get,
		initialData: tariffPrices ?? undefined
	})
	const tariffPriceMap = createTariffPriceMap(actualTariffPrices)

	const getPlanPricing = (
		planKey: string,
		fallback: HomePagePlanPrice
	) => {
		if (!isPaidPlan(planKey)) {
			return fallback
		}

		const planPrices = tariffPriceMap[planKey]

		if (billing === 'yearly') {
			return {
				price: `${formatRub(Math.round(planPrices.YEARLY / 12))} ₽`,
				priceNote: fallback.priceNote,
				yearlyTotal: `${formatRub(planPrices.YEARLY)} ₽/год`
			}
		}

		return {
			price: `${formatRub(planPrices.MONTHLY)} ₽`,
			priceNote: fallback.priceNote
		}
	}

	return (
		<section id="pricing" className={styles.section}>
			<h2 className={styles.title}>{content.title}</h2>

			<div className={styles.toggle}>
				<button
					className={`${styles.toggleBtn} ${billing === 'monthly' ? styles.toggleBtnActive : ''}`}
					onClick={() => setBilling('monthly')}
				>
					{content.monthlyToggleText}
				</button>
				<button
					className={`${styles.toggleBtn} ${billing === 'yearly' ? styles.toggleBtnActive : ''}`}
					onClick={() => setBilling('yearly')}
				>
					{content.yearlyToggleText}
					{content.discountText && (
						<span className={styles.toggleDiscount}>
							{content.discountText}
						</span>
					)}
				</button>
			</div>

			<div className={styles.gridLayout}>
				{content.plans.map(plan => {
					const fallbackPricing: HomePagePlanPrice =
						billing === 'yearly' ? plan.yearly : plan.monthly
					const pricing = getPlanPricing(plan.key, fallbackPricing)

					return (
						<div
							key={plan.key}
							className={`${styles.card} ${plan.popular ? styles.cardPopular : ''} ${billing === 'yearly' ? styles.cardYearly : ''}`}
						>
							{plan.star && <span className={styles.iconStar}></span>}
							{plan.badge && (
								<span className={styles.badge}>{plan.badge}</span>
							)}
							<div className={styles.cardInner}>
								<div>
									<p className={styles.subtitle}>{plan.subtitle}</p>
									<h3 className={styles.planTitle}>{plan.title}</h3>
									<ul className={styles.features}>
										{plan.features.map(f => (
											<li key={f}>{f}</li>
										))}
									</ul>
								</div>
								<div className={styles.bottom}>
									<div className={styles.priceWrap}>
										<span className={styles.price}>{pricing.price}</span>
										{pricing.priceNote && (
											<span className={styles.priceNote}>
												{pricing.priceNote}
											</span>
										)}
									</div>
									{'yearlyTotal' in pricing && pricing.yearlyTotal && (
										<span className={styles.yearlyTotal}>
											{pricing.yearlyTotal}
										</span>
									)}
									<Link href={ctaHref} className={styles.btn}>
										{content.buttonText}
									</Link>
								</div>
							</div>
						</div>
					)
				})}
			</div>
		</section>
	)
}

export default HomePricing
