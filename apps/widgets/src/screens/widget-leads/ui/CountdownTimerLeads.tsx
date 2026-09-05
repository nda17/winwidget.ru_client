'use client'

import { countdownTimerService } from '@/entities/site-widget'
import type { Subscription as WidgetSubscription } from '@/entities/subscription'
import { widgetService } from '@/entities/site-widget'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import AppIcon from '@/shared/ui/icons/AppIcon'
import { useAuthStore } from '@/entities/user'
import { useQuery } from '@tanstack/react-query'
import Link from '@/shared/lib/navigation/ZoneLink'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './WidgetLeads.module.scss'

interface Props {
	timerId: string
}

const CountdownTimerLeads = ({ timerId }: Props) => {
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)
	const [exporting, setExporting] = useState<
		'csv' | 'xlsx' | 'pdf' | null
	>(null)
	const [currentPage, setCurrentPage] = useState(1)
	const itemQuantity = 50

	const { data, isLoading } = useQuery({
		queryKey: [
			'countdown-timer-leads',
			timerId,
			currentPage,
			itemQuantity
		],
		queryFn: () =>
			countdownTimerService.getLeads(timerId, currentPage, itemQuantity),
		enabled: !!auth
	})

	const { data: subscription } = useQuery<WidgetSubscription>({
		queryKey: ['subscription'],
		queryFn: () => widgetService.getSubscription(),
		enabled: !!auth
	})

	const canAccess =
		subscription?.plan === 'TRIAL' || subscription?.plan === 'HARD'
	const isPending = !isAuthResolved || (!!auth && isLoading)
	const totalPages = data?.totalPages ?? currentPage
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const prevPage = () => setCurrentPage(p => Math.max(1, p - 1))
	const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1))
	const changeActivePage = (page: number) => setCurrentPage(page)

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})

	const formatPhone = (raw: string) => {
		const digits = raw.replace(/\D/g, '')
		return digits ? `+${digits}` : raw
	}

	const triggerDownload = (blob: Blob, filename: string) => {
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.click()
		URL.revokeObjectURL(url)
	}

	const handleExport = async (format: 'csv' | 'xlsx') => {
		setExporting(format)
		const toastId = toast.loading(
			format === 'csv' ? 'Подготовка CSV...' : 'Подготовка Excel...'
		)
		try {
			const blob = await countdownTimerService.exportLeads(timerId, format)
			triggerDownload(blob, `timer-leads.${format}`)
			toast.success(format === 'csv' ? 'CSV скачан' : 'Excel скачан', {
				id: toastId
			})
		} catch {
			toast.error('Ошибка при скачивании файла', { id: toastId })
		} finally {
			setExporting(null)
		}
	}

	const handleExportPdf = async () => {
		setExporting('pdf')
		const toastId = toast.loading('Подготовка PDF...')
		try {
			const all = await countdownTimerService.getAllLeads(timerId)
			const rows = all.leads
				.map(
					(lead, i) => `
			<tr>
				<td>${i + 1}</td>
				<td>${formatDate(lead.createdAt)}</td>
				<td>${lead.phone ? formatPhone(lead.phone) : '—'}</td>
				<td>${lead.email || '—'}</td>
				<td>${lead.url ? `<a href="${lead.url}">${lead.url.length > 50 ? lead.url.slice(0, 50) + '…' : lead.url}</a>` : '—'}</td>
			</tr>`
				)
				.join('')
			const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Заявки с таймера</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
  .print-hint { background: #f0e8ff; border: 1px solid #c4a8e8; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; color: #7b3fa0; font-size: 13px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #470B58; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #7b3fa0; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e0d6f0; font-size: 12px; }
  tr:nth-child(even) td { background: #faf7ff; }
  a { color: #9b72c8; }
  @media print { .print-hint { display: none; } }
</style>
</head>
<body>
<div class="print-hint">Нажмите Ctrl+P (⌘P на Mac) → «Сохранить как PDF»</div>
<h1>Заявки с таймера — всего ${all.leads.length}</h1>
<table>
  <caption style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">Таблица заявок с таймера</caption>
  <thead>
    <tr>
      <th scope="col">#</th>
      <th scope="col">Дата</th>
      <th scope="col">Телефон</th>
      <th scope="col">Email</th>
      <th scope="col">Страница</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`
			const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
			window.open(URL.createObjectURL(blob), '_blank')
			toast.success(
				'PDF открыт в новой вкладке — нажмите Ctrl+P для сохранения',
				{ id: toastId, duration: 5000 }
			)
		} catch {
			toast.error('Ошибка при формировании PDF', { id: toastId })
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

			<h1 className={styles.title}>Заявки с таймера</h1>

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
						<span className={styles.metricLabel}>
							Показано на этой странице
						</span>
						{isPending ? (
							<SkeletonLoader height={28} width={64} />
						) : (
							<strong className={styles.metricValue}>
								{data?.leads.length ?? 0}
							</strong>
						)}
					</span>
				</div>
				<div className={styles.metricCard}>
					<span className={styles.metricIcon}>
						<AppIcon name="diamond" size={24} />
					</span>
					<span className={styles.metricCopy}>
						<span className={styles.metricLabel}>
							Всего страниц списка
						</span>
						{isPending ? (
							<SkeletonLoader height={28} width={64} />
						) : (
							<strong className={styles.metricValue}>
								{data?.total ? totalPages : 0}
							</strong>
						)}
					</span>
				</div>
			</div>

			{isPending ? (
				<div className={styles.skeletonWrapper}>
					<div className={styles.skeletonExportBar}>
						<SkeletonLoader width={60} height={16} />
						<SkeletonLoader width={52} height={30} borderRadius={6} />
						<SkeletonLoader width={64} height={30} borderRadius={6} />
						<SkeletonLoader width={52} height={30} borderRadius={6} />
					</div>
					<div className={styles.skeletonTable}>
						<div className={styles.skeletonHead}>
							{[0.4, 1.5, 1.5, 1.5, 1.8].map((flex, i) => (
								<div key={i} style={{ flex, minWidth: 0 }}>
									<SkeletonLoader height={14} />
								</div>
							))}
						</div>
						{[1, 2, 3, 4, 5].map(i => (
							<div key={i} className={styles.skeletonRow}>
								{[0.4, 1.5, 1.5, 1.5, 1.8].map((flex, j) => (
									<div key={j} style={{ flex, minWidth: 0 }}>
										<SkeletonLoader height={14} />
									</div>
								))}
							</div>
						))}
					</div>
				</div>
			) : !data?.leads.length ? (
				<div className={styles.empty}>Заявок пока нет</div>
			) : (
				<div className={styles.tableWrapper}>
					<div className={styles.exportBar}>
						<span className={styles.exportLabel}>Выгрузить:</span>
						<button
							className={styles.exportBtn}
							onClick={() => handleExport('csv')}
							disabled={!canAccess || exporting !== null}
							title={
								!canAccess ? 'Недоступно на тарифе Easy' : 'Скачать CSV'
							}
						>
							<AppIcon name="payment" size={17} />
							{exporting === 'csv' ? '…' : 'CSV'}
							{!canAccess && <span className={styles.lockIcon}>🔒</span>}
						</button>
						<button
							className={styles.exportBtn}
							onClick={() => handleExport('xlsx')}
							disabled={!canAccess || exporting !== null}
							title={
								!canAccess ? 'Недоступно на тарифе Easy' : 'Скачать Excel'
							}
						>
							<AppIcon name="dashboard" size={17} />
							{exporting === 'xlsx' ? '…' : 'Excel'}
							{!canAccess && <span className={styles.lockIcon}>🔒</span>}
						</button>
						<button
							className={styles.exportBtn}
							onClick={handleExportPdf}
							disabled={!canAccess || exporting !== null}
							title={
								!canAccess
									? 'Недоступно на тарифе Easy'
									: 'Открыть PDF для печати'
							}
						>
							<AppIcon name="apps" size={17} />
							{exporting === 'pdf' ? '…' : 'PDF'}
							{!canAccess && <span className={styles.lockIcon}>🔒</span>}
						</button>
						{!canAccess && (
							<span className={styles.exportHint}>
								Недоступно на тарифе Easy —{' '}
								<Link href="/payment" className={styles.exportHintLink}>
									перейти на Hard
								</Link>
							</span>
						)}
					</div>

					<table className={styles.table}>
						<caption className="srOnly">Таблица заявок с таймера</caption>
						<thead>
							<tr>
								<th className={styles.th} scope="col">
									#
								</th>
								<th className={styles.th} scope="col">
									Дата
								</th>
								<th className={styles.th} scope="col">
									Телефон
								</th>
								<th className={styles.th} scope="col">
									Email
								</th>
								<th className={styles.th} scope="col">
									Страница
								</th>
							</tr>
						</thead>
						<tbody>
							{data.leads.map((lead, i) => (
								<tr key={lead.id} className={styles.tr}>
									<td className={styles.td} data-label="#">
										{(data.page - 1) * data.limit + i + 1}
									</td>
									<td className={styles.td} data-label="Дата">
										{formatDate(lead.createdAt)}
									</td>
									<td className={styles.td} data-label="Телефон">
										{lead.phone ? formatPhone(lead.phone) : '—'}
									</td>
									<td className={styles.td} data-label="Email">
										{lead.email || '—'}
									</td>
									<td className={styles.td} data-label="Страница">
										{lead.url ? (
											<a
												href={lead.url}
												target="_blank"
												rel="noopener noreferrer"
												className={styles.urlLink}
											>
												{lead.url.length > 40
													? lead.url.slice(0, 40) + '…'
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
					{data.total > data.limit && (
						<>
							<p className={styles.pagination}>
								Показано {data.leads.length} из {data.total}
							</p>
							<Pagination
								listPage={listPage}
								currentPage={currentPage}
								prevPage={prevPage}
								nextPage={nextPage}
								changeActivePage={changeActivePage}
							/>
						</>
					)}
				</div>
			)}
		</div>
	)
}

export default CountdownTimerLeads
