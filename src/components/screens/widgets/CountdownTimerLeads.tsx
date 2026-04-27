'use client'

import countdownTimerService from '@/services/countdown-timer/countdown-timer.service'
import { CountdownTimerLead } from '@/services/countdown-timer/countdown-timer.types'
import { Subscription as WidgetSubscription } from '@/services/widget/widget.types'
import widgetService from '@/services/widget/widget.service'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
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

	const { data, isLoading } = useQuery({
		queryKey: ['countdown-timer-leads', timerId],
		queryFn: () => countdownTimerService.getLeads(timerId),
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

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})

	const formatContact = (lead: CountdownTimerLead) =>
		[lead.phone, lead.email].filter(Boolean).join(' / ') || '—'

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
				<td>${lead.phone || ''}</td>
				<td>${lead.email || ''}</td>
				<td>${lead.url ? `<a href="${lead.url}">${lead.url.length > 60 ? lead.url.slice(0, 60) + '…' : lead.url}</a>` : '—'}</td>
			</tr>`
				)
				.join('')
			const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Заявки с таймера</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px}h1{font-size:20px;color:#470B58}table{width:100%;border-collapse:collapse}th{background:#7b3fa0;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #e0d6f0}tr:nth-child(even) td{background:#faf7ff}</style></head><body><h1>Заявки с таймера — всего ${all.leads.length}</h1><table><thead><tr><th>#</th><th>Дата</th><th>Телефон</th><th>Email</th><th>Страница</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
			const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
			window.open(URL.createObjectURL(blob), '_blank')
			toast.success('PDF открыт в новой вкладке', { id: toastId })
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

			{isPending ? (
				<div className={styles.skeletonWrapper}>
					<SkeletonLoader width="100%" height={240} borderRadius={8} />
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
						>
							{exporting === 'csv' ? '…' : 'CSV'}
						</button>
						<button
							className={styles.exportBtn}
							onClick={() => handleExport('xlsx')}
							disabled={!canAccess || exporting !== null}
						>
							{exporting === 'xlsx' ? '…' : 'Excel'}
						</button>
						<button
							className={styles.exportBtn}
							onClick={handleExportPdf}
							disabled={!canAccess || exporting !== null}
						>
							{exporting === 'pdf' ? '…' : 'PDF'}
						</button>
					</div>

					{!canAccess && (
						<p className={styles.exportHint}>
							Экспорт недоступен на тарифе Easy —{' '}
							<Link href="/payment" className={styles.exportHintLink}>
								перейти на Hard
							</Link>
						</p>
					)}

					<table className={styles.table}>
						<thead>
							<tr>
								<th className={styles.th}>#</th>
								<th className={styles.th}>Дата</th>
								<th className={styles.th}>Контакт</th>
								<th className={styles.th}>Страница</th>
							</tr>
						</thead>
						<tbody>
							{data.leads.map((lead, i) => (
								<tr key={lead.id}>
									<td className={styles.td}>{i + 1}</td>
									<td className={styles.td}>
										{formatDate(lead.createdAt)}
									</td>
									<td className={styles.td}>{formatContact(lead)}</td>
									<td className={styles.td}>
										{lead.url ? (
											<a
												href={lead.url}
												target="_blank"
												rel="noopener noreferrer"
												className={styles.urlLink}
											>
												{lead.url}
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
		</div>
	)
}

export default CountdownTimerLeads
