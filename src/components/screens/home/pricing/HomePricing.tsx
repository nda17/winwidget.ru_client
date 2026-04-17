'use client'

import { PUBLIC_PAGES } from '@/config/pages/public.config'
import Link from 'next/link'
import { useState } from 'react'
import styles from './HomePricing.module.scss'

const StarDecor = () => (
	<svg
		width="126"
		height="109"
		viewBox="0 0 126 109"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={styles.star}
	>
		<path
			d="M61.1488 67.9753C60.6424 69.0667 60.6826 70.3508 61.2533 71.4077L69.3621 85.9299C70.0483 87.1611 69.9812 88.6973 69.1917 89.8607C68.4333 91.0445 67.0908 91.6633 65.7428 91.4609L49.8081 89.2627C49.2522 89.181 48.6867 89.2389 48.1522 89.4246L47.3329 89.7367C47.0642 89.8892 46.8191 90.09 46.6158 90.332L35.7809 102.768C35.24 103.368 34.5333 103.776 33.7557 103.933C31.8426 104.261 30.027 102.934 29.6646 100.942L26.9339 84.371C26.7167 83.1687 25.9548 82.1524 24.8908 81.645L10.1178 74.7445C8.88195 74.1665 8.0797 72.8972 8.05944 71.4838C8.02819 70.0782 8.74366 68.7712 9.92058 68.0901L24.151 60.0881C25.2508 59.5295 26.001 58.4204 26.1403 57.1503L27.8135 40.4408C27.8605 40.0649 27.9617 39.697 28.1206 39.3573L28.3156 39.0325C28.4004 38.814 28.5162 38.616 28.6591 38.4363L28.9445 38.1844L29.3813 37.7674L30.654 37.2825C31.8337 36.9727 33.0823 37.3025 33.9755 38.1649L45.6092 49.7335C46.4532 50.5824 47.6435 50.9415 48.7894 50.7019L64.6088 47.2562C65.9446 46.9621 67.3253 47.4741 68.1862 48.578C69.0241 49.6942 69.1673 51.2146 68.5546 52.4825L61.1488 67.9753Z"
			fill="url(#paint0_linear)"
		/>
		<g opacity="0.5" filter="url(#filter0_f)">
			<path
				d="M47.2156 59.5718C40.2968 59.5718 34.6816 65.4421 34.6816 72.6722C34.6816 79.905 40.2968 85.7727 47.2156 85.7727C54.1468 85.7727 59.7495 79.905 59.7495 72.6722C59.7495 65.4421 54.1468 59.5718 47.2156 59.5718Z"
				fill="#FF3D22"
			/>
		</g>
		<path
			d="M87.0284 10.0686L87.0796 10.0851C88.6958 10.7009 89.8992 12.1193 90.2867 13.8538L94.6316 34.6885C94.9081 36.0516 95.8053 37.1743 97.0146 37.7078L115.995 45.8675C117.78 46.6304 118.995 48.3682 119.163 50.3497C119.296 52.3413 118.32 54.2254 116.648 55.1978L98.3046 65.9663C97.1688 66.6515 96.4207 67.8843 96.3102 69.2623L94.9334 90.5687C94.8035 92.5557 93.5757 94.2858 91.7776 94.9952C89.9941 95.7521 87.9521 95.3638 86.5281 94.0122L71.2753 79.8339C70.8619 79.4421 70.3792 79.1484 69.8536 78.9598L68.6119 78.6196C68.2928 78.5901 67.9696 78.6149 67.661 78.6989L47.7832 83.7041C46.5526 83.9436 45.4968 83.8224 44.5356 83.3913C42.0305 82.1812 40.9362 79.1367 42.0092 76.5408L50.4397 57.0788C50.9688 55.7968 50.8688 54.3311 50.1796 53.1483L39.3559 34.8941C38.3519 33.2001 38.3787 31.0663 39.4172 29.4097C40.4357 27.7582 42.2525 26.82 44.148 26.9989L64.57 29.1867C65.9508 29.3943 67.3275 28.8581 68.2353 27.7539L81.3841 11.438C81.7283 11.0311 82.1256 10.6843 82.5737 10.4159L83.0187 10.2067C83.2874 10.0258 83.5746 9.89148 83.8766 9.80008L84.4367 9.73014L85.2608 9.61447L87.0284 10.0686Z"
			fill="#FFAC95"
			fillOpacity="0.4"
			stroke="url(#paint1_linear)"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<defs>
			<filter
				id="filter0_f"
				x="14.6816"
				y="39.5718"
				width="65.0679"
				height="66.2012"
				filterUnits="userSpaceOnUse"
				colorInterpolationFilters="sRGB"
			>
				<feFlood floodOpacity="0" result="BackgroundImageFix" />
				<feBlend
					mode="normal"
					in="SourceGraphic"
					in2="BackgroundImageFix"
					result="shape"
				/>
				<feGaussianBlur
					stdDeviation="10"
					result="effect1_foregroundBlur"
				/>
			</filter>
			<linearGradient
				id="paint0_linear"
				x1="12.2223"
				y1="62.8885"
				x2="81.3533"
				y2="124.859"
				gradientUnits="userSpaceOnUse"
			>
				<stop stopColor="#FFA78F" />
				<stop offset="1" stopColor="#F23E2C" />
			</linearGradient>
			<linearGradient
				id="paint1_linear"
				x1="57.1387"
				y1="12.4845"
				x2="91.5015"
				y2="88.5208"
				gradientUnits="userSpaceOnUse"
			>
				<stop stopColor="white" stopOpacity="0.25" />
				<stop offset="1" stopColor="white" stopOpacity="0" />
			</linearGradient>
		</defs>
	</svg>
)

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

			<div className={styles.grid}>
				{PLANS.map(plan => {
					const pricing: PlanPricing =
						billing === 'yearly' ? plan.yearly : plan.monthly
					return (
						<div
							key={plan.key}
							className={`${styles.card} ${plan.popular ? styles.cardPopular : ''}`}
						>
							{plan.star && <StarDecor />}
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
