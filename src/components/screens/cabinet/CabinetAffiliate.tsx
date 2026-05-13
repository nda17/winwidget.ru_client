'use client'

import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import affiliateService, {
	AffiliateReferral,
	AffiliateReferralStatus
} from '@/services/affiliate/affiliate.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './Cabinet.module.scss'

const STATUS_LABELS: Record<AffiliateReferralStatus, string> = {
	REGISTERED: 'Зарегистрирован',
	REWARD_PENDING: 'Ожидание 20 суток',
	CANCELLED: 'Аннулировано',
	PAID: 'Выплачено'
}

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
				dateStyle: 'short'
			}).format(new Date(value))
		: '—'

const formatContact = (item: AffiliateReferral) =>
	item.referredUser.email ||
	item.referredUser.phone ||
	item.referredUser.name ||
	item.referredUser.id

const CabinetAffiliate = () => {
	const auth = useAuthStore(state => state.auth)
	const [currentPage, setCurrentPage] = useState(1)
	const itemQuantity = 10

	const { data, isLoading } = useQuery({
		queryKey: ['affiliate-me', currentPage, itemQuantity],
		queryFn: () =>
			affiliateService.getMyProgram(currentPage, itemQuantity),
		enabled: auth
	})

	const totalPages = data?.totalPages ?? 1
	const listPage = Array.from(
		{ length: totalPages },
		(_, index) => index + 1
	)
	const prevPage = () => setCurrentPage(page => Math.max(1, page - 1))
	const nextPage = () =>
		setCurrentPage(page => Math.min(totalPages, page + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)

	const copyReferralLink = async () => {
		if (!data?.referralLink) return

		try {
			await navigator.clipboard.writeText(data.referralLink)
			toast.success('Реферальная ссылка скопирована')
		} catch {
			toast.error('Не удалось скопировать ссылку')
		}
	}

	if (isLoading) {
		return (
			<div className={styles.section}>
				<SkeletonLoader count={1} className="h-[28px] mb-3" />
				<SkeletonLoader count={3} className="h-[64px] mb-2" />
			</div>
		)
	}

	if (!data?.settings.enabled) {
		return null
	}

	return (
		<>
			<section className={styles.section}>
				<p className={styles.sectionTitle}>Партнёрская программа</p>
				<div className={styles.affiliateHero}>
					<div>
						<p className={styles.affiliateTitle}>
							Получайте {data.settings.cashbackPercent}% от первой оплаты
							нового клиента
						</p>
						<p className={styles.affiliateText}>
							Ссылка рассчитана на дизайнеров, SMM-специалистов,
							маркетологов и подрядчиков, которые рекомендуют наш сервис
							своим клиентам.
						</p>
					</div>
					<button
						type="button"
						className={styles.btn}
						onClick={copyReferralLink}
					>
						Скопировать ссылку
					</button>
				</div>
				<div className={styles.affiliateLink}>{data.referralLink}</div>
			</section>

			<section className={styles.section}>
				<p className={styles.sectionTitle}>Условия</p>
				<div className={styles.affiliateTerms}>
					<p>
						Кэшбек начисляется только за нового клиента, которого раньше не
						было в клиентской базе Winwidget.
					</p>
					<p>
						Право на кэшбек появляется после первой успешной оплаты любого
						тарифа. За одного клиента кэшбек начисляется только один раз.
					</p>
					<p>
						Выплату можно запросить через поддержку на 21-е сутки после
						оплаты. Либо при накоплении кешбека на сумму более 3000 рублей.
						(Что наступит раньше)
					</p>
					<p>
						Если платёж отменён или возвращён клиенту, право на выплату
						аннулируется.
					</p>
				</div>
			</section>

			<section className={styles.section}>
				<p className={styles.sectionTitle}>Рефералы</p>
				{data.items.length ? (
					<>
						<div className={styles.affiliateTable}>
							<div className={styles.affiliateTableHead}>
								<span>Клиент</span>
								<span>Оплата</span>
								<span>Кэшбек</span>
								<span>Получить с</span>
								<span>Статус</span>
							</div>
							{data.items.map(item => (
								<div className={styles.affiliateTableRow} key={item.id}>
									<span>{formatContact(item)}</span>
									<span>{formatMoney(item.paymentAmount)}</span>
									<span>{formatMoney(item.cashbackAmount)}</span>
									<span>{formatDate(item.availableAt)}</span>
									<span>
										{item.rewardAvailable
											? 'Можно запросить'
											: STATUS_LABELS[item.status]}
									</span>
								</div>
							))}
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
					<p className={styles.emptyWidgetText}>
						Переходов и регистраций по вашей ссылке пока нет.
					</p>
				)}
			</section>
		</>
	)
}

export default CabinetAffiliate
