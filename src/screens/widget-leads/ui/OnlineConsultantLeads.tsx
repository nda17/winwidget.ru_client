'use client'

import AppIcon from '@/shared/ui/icons/AppIcon'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import { onlineConsultantService } from '@/entities/site-widget'
import type { Subscription as WidgetSubscription } from '@/entities/subscription'
import { widgetService } from '@/entities/site-widget'
import { useAuthStore } from '@/entities/user'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './WidgetLeads.module.scss'

interface Props {
	onlineConsultantId: string
}

const OnlineConsultantLeads = ({ onlineConsultantId }: Props) => {
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)
	const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)
	const [currentPage, setCurrentPage] = useState(1)
	const itemQuantity = 50

	const { data, isLoading } = useQuery({
		queryKey: [
			'online-consultant-leads',
			onlineConsultantId,
			currentPage,
			itemQuantity
		],
		queryFn: () =>
			onlineConsultantService.getLeads(
				onlineConsultantId,
				currentPage,
				itemQuantity
			),
		enabled: !!auth
	})

	const { data: subscription } = useQuery<WidgetSubscription>({
		queryKey: ['subscription'],
		queryFn: () => widgetService.getSubscription(),
		enabled: !!auth
	})

	const canExport =
		subscription?.plan === 'TRIAL' || subscription?.plan === 'HARD'
	const isPending = !isAuthResolved || (!!auth && isLoading)
	const totalPages = data?.totalPages ?? currentPage
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)

	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages)
	}, [currentPage, totalPages])

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})

	const triggerDownload = (blob: Blob, filename: string) => {
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = filename
		anchor.click()
		URL.revokeObjectURL(url)
	}

	const handleExport = async (format: 'csv' | 'xlsx') => {
		setExporting(format)
		const toastId = toast.loading(
			format === 'csv' ? 'Подготовка CSV...' : 'Подготовка Excel...'
		)
		try {
			const blob = await onlineConsultantService.exportLeads(
				onlineConsultantId,
				format
			)
			triggerDownload(blob, `online-consultant-leads.${format}`)
			toast.success(format === 'csv' ? 'CSV скачан' : 'Excel скачан', {
				id: toastId
			})
		} catch {
			toast.error('Ошибка при скачивании файла', { id: toastId })
		} finally {
			setExporting(null)
		}
	}

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Link href="/cabinet" className={styles.backLink}>
					← Виджеты
				</Link>
			</div>

			<h1 className={styles.title}>Заявки онлайн-консультанта</h1>

			<div className={styles.metricsGrid}>
				<div className={styles.metricCard}>
					<span className={styles.metricIcon}>
						<AppIcon name="payment" size={24} />
					</span>
					<span className={styles.metricCopy}>
						<span className={styles.metricLabel}>
							Всего заявок за всё время
						</span>
						{isPending ? (
							<SkeletonLoader height={28} width={64} />
						) : (
							<strong className={styles.metricValue}>
								{data?.total ?? 0}
							</strong>
						)}
					</span>
				</div>
				<div className={styles.metricCard}>
					<span className={styles.metricIcon}>
						<AppIcon name="dashboard" size={24} />
					</span>
					<span className={styles.metricCopy}>
						<span className={styles.metricLabel}>На этой странице</span>
						{isPending ? (
							<SkeletonLoader height={28} width={64} />
						) : (
							<strong className={styles.metricValue}>
								{data?.leads.length ?? 0}
							</strong>
						)}
					</span>
				</div>
			</div>

			{isPending ? (
				<div className={styles.skeletonWrapper}>
					<SkeletonLoader height={220} />
				</div>
			) : !data?.leads.length ? (
				<div className={styles.empty}>Заявок пока нет</div>
			) : (
				<div className={styles.tableWrapper}>
					<div className={styles.exportBar}>
						<span className={styles.exportLabel}>Экспорт:</span>
						<button
							className={styles.exportBtn}
							onClick={() => handleExport('csv')}
							disabled={!canExport || exporting !== null}
						>
							CSV
						</button>
						<button
							className={styles.exportBtn}
							onClick={() => handleExport('xlsx')}
							disabled={!canExport || exporting !== null}
						>
							Excel
						</button>
					</div>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>#</th>
								<th>Дата</th>
								<th>Телефон</th>
								<th>Email</th>
								<th>Вопрос</th>
								<th>Страница</th>
							</tr>
						</thead>
						<tbody>
							{data.leads.map((lead, index) => (
								<tr key={lead.id}>
									<td>{(currentPage - 1) * itemQuantity + index + 1}</td>
									<td>{formatDate(lead.createdAt)}</td>
									<td>{lead.phone || '—'}</td>
									<td>{lead.email || '—'}</td>
									<td>{lead.actionLabel || '—'}</td>
									<td>
										{lead.url ? (
											<a
												href={lead.url}
												target="_blank"
												rel="noopener noreferrer"
											>
												{lead.url.length > 44
													? `${lead.url.slice(0, 44)}…`
													: lead.url}
											</a>
										) : (
											'—'
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{totalPages > 1 && (
				<Pagination
					currentPage={currentPage}
					listPage={listPage}
					changeActivePage={setCurrentPage}
					prevPage={() => setCurrentPage(page => Math.max(1, page - 1))}
					nextPage={() =>
						setCurrentPage(page => Math.min(totalPages, page + 1))
					}
				/>
			)}
		</div>
	)
}

export default OnlineConsultantLeads
