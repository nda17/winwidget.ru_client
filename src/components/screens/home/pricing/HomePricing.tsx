'use client'

import { PUBLIC_PAGES } from '@/config/pages/public.config'
import Link from 'next/link'
import { useState } from 'react'
import styles from './HomePricing.module.scss'

type BillingPeriod = 'monthly' | 'yearly'

interface PlanPricing {
	price: string
	priceNote: string | null
	yearlyTotal?: string
}

const PLANS = [
	{
		key: 'TRIAL',
		badge: null,
		title: 'Тест-драйв',
		subtitle: '1 виджет / 7 дней',
		features: [
			'1 виджет',
			'До 10 заявок',
			'Тестовый период - 7 дней',
			'Демонстрация работы всего функционала, доступного на платных тарифах'
		],
		monthly: { price: 'Бесплатно', priceNote: null },
		yearly: { price: 'Бесплатно', priceNote: null },
		star: false,
		popular: false
	},
	{
		key: 'EASY',
		badge: 'Выбор клиентов',
		title: 'Easy',
		subtitle: '1 виджет',
		features: [
			'100 заявок в месяц',
			'Хранение всех заявок в личном кабинете',
			'Email уведомления / Telegram',
			'Установка виджетов на сайт, открытие по прямой ссылке, QR-коду',
			'Интеграции с amoCRM, Bitrix24, Яндекс Метрика, VK Ретаргетинг, Roistat, по Webhook'
		],

		monthly: { price: '990 ₽', priceNote: 'в месяц' },
		yearly: {
			price: '390 ₽',
			priceNote: 'в месяц',
			yearlyTotal: '4 680 ₽/год'
		},
		star: true,
		popular: true
	},
	{
		key: 'HARD',
		badge: null,
		title: 'Hard',
		subtitle: '10 любых виджетов',
		features: [
			'Безлимитные заявки',
			'Хранение всех заявок в личном кабинете',
			'Установка виджетов на сайт, открытие по прямой ссылке, QR-коду',
			'Email уведомления / Telegram',
			'Аналитика бонусов',
			'Интеграции с amoCRM, Bitrix24, Яндекс Метрика, VK Ретаргетинг, Roistat, по Webhook',
			'Выгрузка заявок в Exсel, PDF, CSV'
		],
		monthly: { price: '1 690 ₽', priceNote: 'в месяц' },
		yearly: {
			price: '790 ₽',
			priceNote: 'в месяц',
			yearlyTotal: '9 480 ₽/год'
		},
		star: false,
		popular: false
	}
]

const HomePricing = () => {
	const [billing, setBilling] = useState<BillingPeriod>('monthly')

	return (
		<section id="pricing" className={styles.section}>
			<h2 className={styles.title}>Выберите удобный тариф</h2>

			<div className={styles.toggle}>
				<button
					className={`${styles.toggleBtn} ${billing === 'monthly' ? styles.toggleBtnActive : ''}`}
					onClick={() => setBilling('monthly')}
				>
					Ежемесячно
				</button>
				<button
					className={`${styles.toggleBtn} ${billing === 'yearly' ? styles.toggleBtnActive : ''}`}
					onClick={() => setBilling('yearly')}
				>
					За год
					<span className={styles.toggleDiscount}>−60%</span>
				</button>
			</div>

			<div className={styles.gridLayout}>
				{PLANS.map(plan => {
					const pricing: PlanPricing =
						billing === 'yearly' ? plan.yearly : plan.monthly
					return (
						<div
							key={plan.key}
							className={`${styles.card} ${plan.popular ? styles.cardPopular : ''}`}
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
									<Link
										href={PUBLIC_PAGES.REGISTER}
										className={styles.btn}
									>
										Попробовать
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
