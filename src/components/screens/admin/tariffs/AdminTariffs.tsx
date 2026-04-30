'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import { revalidateTariffPrices } from '@/services/tariff-prices/tariff-prices.actions'
import tariffPricesService from '@/services/tariff-prices/tariff-prices.service'
import {
	DEFAULT_TARIFF_PRICE_MAP,
	PAID_PLANS,
	TARIFF_BILLING_PERIODS,
	createTariffPriceMap,
	tariffPriceMapToInput,
	type PaidPlan,
	type TariffPriceMap
} from '@/services/tariff-prices/tariff-prices.types'
import type { BillingPeriod } from '@/services/widget/widget.types'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminTariffs.module.scss'

type TariffDraft = Record<PaidPlan, Record<BillingPeriod, string>>

const PLAN_LABELS: Record<PaidPlan, string> = {
	EASY: 'Easy',
	HARD: 'Hard'
}

const PERIOD_LABELS: Record<BillingPeriod, string> = {
	MONTHLY: 'Сумма списания за месяц',
	YEARLY: 'Сумма списания за год'
}

const formatRub = (value: number) =>
	new Intl.NumberFormat('ru-RU').format(value)

const createDraftFromMap = (priceMap: TariffPriceMap): TariffDraft => ({
	EASY: {
		MONTHLY: String(priceMap.EASY.MONTHLY),
		YEARLY: String(priceMap.EASY.YEARLY)
	},
	HARD: {
		MONTHLY: String(priceMap.HARD.MONTHLY),
		YEARLY: String(priceMap.HARD.YEARLY)
	}
})

const DEFAULT_TARIFF_DRAFT = createDraftFromMap(DEFAULT_TARIFF_PRICE_MAP)

const createPriceMapFromDraft = (draft: TariffDraft): TariffPriceMap => ({
	EASY: {
		MONTHLY: Number(draft.EASY.MONTHLY),
		YEARLY: Number(draft.EASY.YEARLY)
	},
	HARD: {
		MONTHLY: Number(draft.HARD.MONTHLY),
		YEARLY: Number(draft.HARD.YEARLY)
	}
})

const isValidDraft = (draft: TariffDraft) =>
	PAID_PLANS.every(plan =>
		TARIFF_BILLING_PERIODS.every(period => {
			const amount = Number(draft[plan][period])
			return Number.isInteger(amount) && amount > 0 && amount <= 10000000
		})
	)

const AdminTariffs: NextPage = () => {
	const queryClient = useQueryClient()
	const router = useRouter()

	const { data: prices, isLoading } = useQuery({
		queryKey: ['tariff-prices'],
		queryFn: tariffPricesService.get
	})

	const currentDraft = useMemo(
		() => createDraftFromMap(createTariffPriceMap(prices)),
		[prices]
	)
	const [draft, setDraft] = useState<TariffDraft>(
		createDraftFromMap(DEFAULT_TARIFF_PRICE_MAP)
	)

	useEffect(() => {
		if (prices) {
			setDraft(currentDraft)
		}
	}, [currentDraft, prices])

	const mutation = useMutation({
		mutationFn: tariffPricesService.update,
		onSuccess: async updatedPrices => {
			await queryClient.invalidateQueries({ queryKey: ['tariff-prices'] })
			await revalidateTariffPrices()
			setDraft(createDraftFromMap(createTariffPriceMap(updatedPrices)))
			router.refresh()
		}
	})

	const isDirty = JSON.stringify(draft) !== JSON.stringify(currentDraft)
	const isDefaultDraft =
		JSON.stringify(draft) === JSON.stringify(DEFAULT_TARIFF_DRAFT)
	const canSave = isDirty && isValidDraft(draft) && !mutation.isPending

	const updateAmount = (
		plan: PaidPlan,
		period: BillingPeriod,
		value: string
	) => {
		setDraft(prev => ({
			...prev,
			[plan]: {
				...prev[plan],
				[period]: value
			}
		}))
	}

	const savePrices = () => {
		if (!isValidDraft(draft)) {
			toast.error('Укажи целые суммы от 1 до 10 000 000')
			return
		}

		const promise = mutation.mutateAsync(
			tariffPriceMapToInput(createPriceMapFromDraft(draft))
		)

		toast.promise(promise, {
			loading: 'Сохраняем цены тарифов...',
			success: 'Цены тарифов сохранены',
			error: (error: any) =>
				error?.response?.data?.message || 'Ошибка сохранения цен'
		})
	}

	const resetToDefault = () => {
		setDraft(DEFAULT_TARIFF_DRAFT)
		toast.success('Дефолтные цены подставлены в форму')
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				title="Цены тарифов"
				description="Эти суммы используются при создании платежа в ЮKassa и отображаются на странице оплаты."
				risk="high"
				riskText="Изменение цен влияет на реальные новые платежи. Уже созданные платежи сохраняют свою сумму."
				text="Тарифы"
			/>

			<div className={styles.section}>
				<p className={styles.sectionHint}>
					Вводи полную сумму списания в рублях. Для годовой оплаты значение
					“₽/мес” считается автоматически: годовая сумма / 12.
				</p>
				{isLoading ? (
					<>
						{PAID_PLANS.map(plan => (
							<div key={plan} className={styles.tariffCard}>
								<SkeletonLoader count={1} className="h-[24px] w-24 mb-4" />
								<SkeletonLoader count={2} className="h-[42px] mb-3" />
							</div>
						))}
					</>
				) : (
					<>
						<div className={styles.tariffGrid}>
							{PAID_PLANS.map(plan => {
								const yearlyAmount = Number(draft[plan].YEARLY) || 0
								const monthlyFromYear = Math.round(yearlyAmount / 12)

								return (
									<div key={plan} className={styles.tariffCard}>
										<div className={styles.cardHead}>
											<h3 className={styles.cardTitle}>
												{PLAN_LABELS[plan]}
											</h3>
											<p className={styles.cardHint}>
												Редактирование реальных платежных сумм
											</p>
										</div>

										{TARIFF_BILLING_PERIODS.map(period => (
											<label key={period} className={styles.field}>
												<span className={styles.fieldLabel}>
													{PERIOD_LABELS[period]}
												</span>
												<input
													type="number"
													min={1}
													max={10000000}
													step={1}
													inputMode="numeric"
													className={styles.input}
													value={draft[plan][period]}
													onChange={e =>
														updateAmount(plan, period, e.target.value)
													}
												/>
											</label>
										))}

										<div className={styles.previewBox}>
											<p className={styles.previewTitle}>
												Как увидит пользователь
											</p>
											<div className={styles.previewRow}>
												<span>Ежемесячно</span>
												<strong>
													{formatRub(Number(draft[plan].MONTHLY) || 0)}{' '}
													₽/мес
												</strong>
											</div>
											<div className={styles.previewRow}>
												<span>За год</span>
												<strong>
													{formatRub(monthlyFromYear)} ₽/мес,{' '}
													{formatRub(yearlyAmount)} ₽/год
												</strong>
											</div>
										</div>
									</div>
								)
							})}
						</div>

						<div className={styles.actions}>
							<button
								type="button"
								className={styles.saveBtn}
								onClick={savePrices}
								disabled={!canSave}
							>
								{mutation.isPending ? 'Сохраняем...' : 'Сохранить тарифы'}
							</button>

							{isDirty && (
								<button
									type="button"
									className={styles.cancelBtn}
									onClick={() => setDraft(currentDraft)}
									disabled={mutation.isPending}
								>
									Отменить изменения
								</button>
							)}

							<button
								type="button"
								className={styles.defaultBtn}
								onClick={resetToDefault}
								disabled={mutation.isPending || isDefaultDraft}
							>
								Подставить дефолтные цены
							</button>
						</div>
					</>
				)}
			</div>
		</section>
	)
}

export default AdminTariffs
