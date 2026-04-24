'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import quizService from '@/services/quiz/quiz.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import {
	QuizLead,
	QuizLeadsStatsResponse,
	Subscription
} from '@/services/quiz/quiz.types'
import { Subscription as WidgetSubscription } from '@/services/widget/widget.types'
import widgetService from '@/services/widget/widget.service'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import styles from './WidgetLeads.module.scss'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Props {
	quizId: string
}

const QuizLeads = ({ quizId }: Props) => {
	const auth = useAuthStore(state => state.auth)

	const [exporting, setExporting] = useState<
		'csv' | 'xlsx' | 'pdf' | null
	>(null)

	const { data, isLoading } = useQuery({
		queryKey: ['quiz-leads', quizId],
		queryFn: () => quizService.getLeads(quizId),
		enabled: !!auth
	})

	const { data: subscription } = useQuery<WidgetSubscription>({
		queryKey: ['subscription'],
		queryFn: () => widgetService.getSubscription(),
		enabled: !!auth
	})

	const canAccess =
		subscription?.plan === 'TRIAL' || subscription?.plan === 'HARD'

	const { data: statsData } = useQuery<QuizLeadsStatsResponse>({
		queryKey: ['quiz-leads-stats', quizId],
		queryFn: () => quizService.getLeadsStats(quizId),
		enabled: !!auth && canAccess
	})

	const formatPhone = (raw: string) => {
		const digits = raw.replace(/\D/g, '')
		return digits ? `+${digits}` : raw
	}

	const formatDate = (iso: string) => {
		const d = new Date(iso)
		return d.toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	const triggerDownload = (blob: Blob, filename: string) => {
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.click()
		URL.revokeObjectURL(url)
	}

	const handleExportCsv = async () => {
		setExporting('csv')
		const toastId = toast.loading('Подготовка CSV...')
		try {
			const blob = await quizService.exportLeads(quizId, 'csv')
			triggerDownload(blob, `quiz-leads.csv`)
			toast.success('CSV скачан', { id: toastId })
		} catch {
			toast.error('Ошибка при скачивании CSV', { id: toastId })
		} finally {
			setExporting(null)
		}
	}

	const handleExportXlsx = async () => {
		setExporting('xlsx')
		const toastId = toast.loading('Подготовка Excel...')
		try {
			const blob = await quizService.exportLeads(quizId, 'xlsx')
			triggerDownload(blob, `quiz-leads.xlsx`)
			toast.success('Excel скачан', { id: toastId })
		} catch {
			toast.error('Ошибка при скачивании Excel', { id: toastId })
		} finally {
			setExporting(null)
		}
	}

	const handleExportPdf = async () => {
		setExporting('pdf')
		const toastId = toast.loading('Подготовка PDF...')
		try {
			const all = await quizService.getAllLeads(quizId)
			const html = buildPdfHtml(all.leads)
			const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
			const url = URL.createObjectURL(blob)
			window.open(url, '_blank')
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

	const buildPdfHtml = (leads: QuizLead[]) => {
		const rows = leads
			.map(
				(lead, i) => `
			<tr>
				<td>${i + 1}</td>
				<td>${formatDate(lead.createdAt)}</td>
				<td>${lead.phone ? formatPhone(lead.phone) : lead.contact ? formatPhone(lead.contact) : '—'}</td>
				<td>${lead.email || '—'}</td>
				<td>${lead.result || '—'}</td>
				<td>${lead.url ? `<a href="${lead.url}">${lead.url.length > 50 ? lead.url.slice(0, 50) + '…' : lead.url}</a>` : '—'}</td>
			</tr>`
			)
			.join('')

		return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Заявки квиза</title>
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
<h1>Заявки квиза — всего ${leads.length}</h1>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Дата</th>
      <th>Телефон</th>
      <th>Email</th>
      <th>Результат</th>
      <th>Страница</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`
	}

	return (
		<div className={styles.page}>
			<div className={styles.header}>
				<Link href="/cabinet" className={styles.backLink}>
					← Виджеты
				</Link>
			</div>

			<h1 className={styles.title}>Заявки квиза</h1>

			{canAccess && statsData && statsData.stats.length > 0 && (
				<div className={styles.statsBlock}>
					<p className={styles.statsTitle}>Аналитика результатов</p>
					<div className={styles.statsList}>
						{statsData.stats.map(stat => (
							<div key={stat.result} className={styles.statRow}>
								<span className={styles.statName}>{stat.result}</span>
								<div className={styles.statBarWrap}>
									<div
										className={styles.statBar}
										style={{ width: `${stat.percent}%` }}
									/>
								</div>
								<span className={styles.statCount}>{stat.count}</span>
								<span className={styles.statPercent}>{stat.percent}%</span>
							</div>
						))}
					</div>
					<p className={styles.statsTotal}>
						Всего заявок: {statsData.total}
					</p>
				</div>
			)}

			{!canAccess && subscription && (
				<div className={styles.statsLocked}>
					🔒 Аналитика результатов доступна на{' '}
					<Link href="/payment" className={styles.exportHintLink}>
						тарифах Тест-драйв и Hard
					</Link>
				</div>
			)}

			{isLoading ? (
				<div className={styles.skeletonWrapper}>
					<div className={styles.skeletonExportBar}>
						<SkeletonLoader width={60} height={16} />
						<SkeletonLoader width={52} height={30} borderRadius={6} />
						<SkeletonLoader width={64} height={30} borderRadius={6} />
						<SkeletonLoader width={52} height={30} borderRadius={6} />
					</div>
					<div className={styles.skeletonTable}>
						<div className={styles.skeletonHead}>
							{[0.4, 1.5, 1.5, 1.5, 1.5, 1.8].map((flex, i) => (
								<div key={i} style={{ flex, minWidth: 0 }}>
									<SkeletonLoader height={14} />
								</div>
							))}
						</div>
						{[1, 2, 3, 4, 5].map(i => (
							<div key={i} className={styles.skeletonRow}>
								{[0.4, 1.5, 1.5, 1.5, 1.5, 1.8].map((flex, j) => (
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
							onClick={handleExportCsv}
							disabled={!canAccess || exporting !== null}
							title={
								!canAccess ? 'Недоступно на тарифе Easy' : 'Скачать CSV'
							}
						>
							{exporting === 'csv' ? '…' : 'CSV'}
							{!canAccess && <span className={styles.lockIcon}>🔒</span>}
						</button>
						<button
							className={styles.exportBtn}
							onClick={handleExportXlsx}
							disabled={!canAccess || exporting !== null}
							title={
								!canAccess ? 'Недоступно на тарифе Easy' : 'Скачать Excel'
							}
						>
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
						<caption className="srOnly">Таблица заявок по квизу</caption>
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
									Результат
								</th>
								<th className={styles.th} scope="col">
									Страница
								</th>
							</tr>
						</thead>
						<tbody>
							{data.leads.map((lead, i) => (
								<tr key={lead.id} className={styles.tr}>
									<td className={styles.td}>{i + 1}</td>
									<td className={styles.td}>
										{formatDate(lead.createdAt)}
									</td>
									<td className={styles.td}>
										{lead.phone
											? formatPhone(lead.phone)
											: lead.contact
												? formatPhone(lead.contact)
												: '—'}
									</td>
									<td className={styles.td}>{lead.email || '—'}</td>
									<td className={styles.td}>{lead.result || '—'}</td>
									<td className={styles.td}>
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
						<p className={styles.pagination}>
							Показано {data.leads.length} из {data.total}
						</p>
					)}
				</div>
			)}
		</div>
	)
}

export default QuizLeads
