'use client'

import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import affiliateService, {
	AdminAffiliateFilters,
	AffiliateReferral,
	AffiliateReferralStatus
} from '@/services/affiliate/affiliate.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminAffiliate.module.scss'

const STATUS_LABELS: Record<AffiliateReferralStatus, string> = {
	REGISTERED: 'Зарегистрирован',
	REWARD_PENDING: 'Ожидает выплату',
	CANCELLED: 'Аннулирован',
	PAID: 'Выплачен'
}

type StatusFilter = AffiliateReferralStatus | 'ALL'

interface FilterDraft {
	status: StatusFilter
	search: string
}

const DEFAULT_FILTERS: FilterDraft = {
	status: 'ALL',
	search: ''
}

const STATUS_FILTER_OPTIONS: Array<{
	value: StatusFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все статусы' },
	...Object.entries(STATUS_LABELS).map(([value, label]) => ({
		value: value as AffiliateReferralStatus,
		label
	}))
]

const normalizeFilters = (draft: FilterDraft): AdminAffiliateFilters => ({
	status: draft.status === 'ALL' ? undefined : draft.status,
	search: draft.search.trim() || undefined
})

const formatMoney = (value: number | null) =>
	value === null
		? '—'
		: new Intl.NumberFormat('ru-RU', {
				style: 'currency',
				currency: 'RUB',
				maximumFractionDigits: 0
			}).format(value)

const formatDate = (value: string | null) =>
	value
		? new Intl.DateTimeFormat('ru-RU', {
				dateStyle: 'short',
				timeStyle: 'short'
			}).format(new Date(value))
		: '—'

const formatUser = (user: AffiliateReferral['referrer']) =>
	user.name || user.email || user.phone || user.id

const formatContact = (user: AffiliateReferral['referrer']) =>
	user.email || user.phone || user.id

const AdminAffiliate: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [currentPage, setCurrentPage] = useState(1)
	const [filterDraft, setFilterDraft] = useState(DEFAULT_FILTERS)
	const [filters, setFilters] = useState<AdminAffiliateFilters>({})
	const [cashbackPercent, setCashbackPercent] = useState(10)
	const itemQuantity = 20

	const { data: settings, isLoading: isSettingsLoading } = useQuery({
		queryKey: ['admin-affiliate-settings'],
		queryFn: affiliateService.adminGetSettings,
		enabled: auth
	})

	const { data, isLoading, isFetching } = useQuery({
		queryKey: [
			'admin-affiliate-referrals',
			currentPage,
			itemQuantity,
			filters
		],
		queryFn: () =>
			affiliateService.adminGetReferrals(
				currentPage,
				itemQuantity,
				filters
			),
		enabled: auth
	})

	useEffect(() => {
		if (settings) {
			setCashbackPercent(settings.cashbackPercent)
		}
	}, [settings])

	const settingsMutation = useMutation({
		mutationFn: affiliateService.adminUpdateSettings,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['admin-affiliate-settings']
			})
			queryClient.invalidateQueries({
				queryKey: ['affiliate-public-settings']
			})
		}
	})

	const totalPages = data?.totalPages ?? 1
	const listPage = Array.from(
		{ length: totalPages },
		(_, index) => index + 1
	)

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const updateSettings = (
		payload: Parameters<typeof affiliateService.adminUpdateSettings>[0]
	) => {
		const promise = settingsMutation.mutateAsync(payload)

		toast.promise(promise, {
			loading: 'Сохраняем партнёрскую программу...',
			success: 'Настройки партнёрской программы сохранены',
			error: 'Не удалось сохранить настройки партнёрки'
		})
	}

	const savePercent = () => {
		updateSettings({ cashbackPercent })
	}

	const applyFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setFilters(normalizeFilters(filterDraft))
		setCurrentPage(1)
		toast.success('Фильтры партнёрки применены')
	}

	const resetFilters = () => {
		setFilterDraft(DEFAULT_FILTERS)
		setFilters({})
		setCurrentPage(1)
		toast.success('Фильтры партнёрки сброшены')
	}

	const prevPage = () => setCurrentPage(page => Math.max(1, page - 1))
	const nextPage = () =>
		setCurrentPage(page => Math.min(totalPages, page + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Партнёрская программа"
				title="Настройки партнёрской программы"
				description="Управляет видимостью партнёрки на главной и в личном кабинете, а также процентом кэшбека от первой оплаты нового клиента."
				risk="medium"
				riskText="Процент применяется к новым успешным оплатам после изменения настройки. Уже созданные начисления сохраняют процент, который действовал в момент оплаты."
			/>

			<div className={styles.settingsCard}>
				{isSettingsLoading ? (
					<SkeletonLoader count={2} className="h-[48px] mb-3" />
				) : (
					<>
						<div className={styles.toggleRow}>
							<div>
								<p className={styles.cardTitle}>Партнёрка активна</p>
								<p className={styles.hint}>
									Если выключено, блок на главной и таб в личном кабинете
									скрываются.
								</p>
							</div>
							<button
								type="button"
								className={`${styles.toggle} ${settings?.enabled ? styles.toggleOn : ''}`}
								onClick={() =>
									updateSettings({ enabled: !settings?.enabled })
								}
								disabled={settingsMutation.isPending}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>
						<div className={styles.percentRow}>
							<label className={styles.field}>
								<span className={styles.label}>Кэшбек, %</span>
								<input
									type="number"
									min={1}
									max={50}
									className={styles.input}
									value={cashbackPercent}
									onChange={event =>
										setCashbackPercent(Number(event.target.value))
									}
								/>
							</label>
							<button
								type="button"
								className={styles.primaryBtn}
								onClick={savePercent}
								disabled={settingsMutation.isPending}
							>
								Сохранить процент
							</button>
						</div>
					</>
				)}
			</div>

			<AdminSectionHeading
				text="Рефералы"
				title="История рефералов"
				description="Показывает зарегистрированных по партнёрской ссылке клиентов, первую оплату, сумму кэшбека и дату, когда выплату можно запросить."
				risk="low"
				riskText="Список только отображает начисления. Выплата выполняется вручную через поддержку после проверки периода охлаждения и отсутствия возврата."
			/>

			<form className={styles.filters} onSubmit={applyFilters}>
				<div className={styles['filter-grid']}>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Статус</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.status}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									status: event.target.value as StatusFilter
								}))
							}
						>
							{STATUS_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Поиск</span>
						<input
							className={styles['filter-input']}
							value={filterDraft.search}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									search: event.target.value
								}))
							}
							placeholder="Реферер, клиент, контакт"
						/>
					</label>
				</div>
				<div className={styles['filter-actions']}>
					<button type="submit" className={styles['filter-apply']}>
						Применить
					</button>
					<button
						type="button"
						className={styles['filter-reset']}
						onClick={resetFilters}
					>
						Сбросить
					</button>
				</div>
			</form>

			{isLoading ? (
				<div className={styles.settingsCard}>
					<SkeletonLoader count={6} className="h-[40px] mb-3" />
				</div>
			) : data ? (
				<div className={styles['list-section']}>
					<div className={styles['list-meta']}>
						<div>
							<p className={styles['meta-title']}>Рефералы</p>
							<p className={styles['meta-subtitle']}>
								Всего записей: {data.total}
							</p>
						</div>
						<p className={styles['meta-subtitle']}>
							{isFetching
								? 'Обновляем...'
								: `Страница ${data.page} из ${data.totalPages}`}
						</p>
					</div>
					{data.items.length ? (
						<>
							<div className={styles['table-scroll']}>
								<table className={styles.table}>
									<thead>
										<tr>
											<th>Партнёр</th>
											<th>Клиент</th>
											<th>Статус</th>
											<th>Оплата</th>
											<th>Кэшбек</th>
											<th>Доступно с</th>
										</tr>
									</thead>
									<tbody>
										{data.items.map(item => (
											<tr key={item.id}>
												<td>
													<div className={styles.userCell}>
														<span>{formatUser(item.referrer)}</span>
														<span className={styles.muted}>
															{formatContact(item.referrer)}
														</span>
													</div>
												</td>
												<td>
													<div className={styles.userCell}>
														<span>{formatUser(item.referredUser)}</span>
														<span className={styles.muted}>
															{formatContact(item.referredUser)}
														</span>
													</div>
												</td>
												<td>
													{item.rewardAvailable
														? 'Можно запросить'
														: STATUS_LABELS[item.status]}
												</td>
												<td>{formatMoney(item.paymentAmount)}</td>
												<td>{formatMoney(item.cashbackAmount)}</td>
												<td>{formatDate(item.availableAt)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							{data.total > itemQuantity && (
								<Pagination
									listPage={listPage}
									currentPage={currentPage}
									prevPage={prevPage}
									nextPage={nextPage}
									changeActivePage={changeActivePage}
								/>
							)}
						</>
					) : (
						<div className={styles.emptyState}>
							<p className={styles['meta-subtitle']}>
								Рефералов с такими фильтрами нет
							</p>
						</div>
					)}
				</div>
			) : null}
		</section>
	)
}

export default AdminAffiliate
