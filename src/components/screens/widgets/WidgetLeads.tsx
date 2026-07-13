'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import calculatorService from '@/services/calculator/calculator.service'
import {
	CalculatorLead,
	CalculatorLeadsResponse
} from '@/services/calculator/calculator.types'
import widgetService from '@/services/widget/widget.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import {
	Lead,
	LeadsResponse,
	LeadsStatsResponse,
	Subscription
} from '@/services/widget/widget.types'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import AppIcon from '@/components/ui/icons/AppIcon'
import styles from './WidgetLeads.module.scss'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Props =
	| { source?: 'wheel'; widgetId: string; calculatorId?: never }
	| { source: 'calculator'; calculatorId: string; widgetId?: never }

const WidgetLeads = (props: Props) => {
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)
	const isCalculator = props.source === 'calculator'
	const sourceId = isCalculator ? props.calculatorId : props.widgetId

	const [exporting, setExporting] = useState<
		'csv' | 'xlsx' | 'pdf' | null
	>(null)
	const [currentPage, setCurrentPage] = useState(1)
	const itemQuantity = 50

	const { data, isLoading } = useQuery<
		LeadsResponse | CalculatorLeadsResponse
	>({
		queryKey: [
			isCalculator ? 'calculator-leads' : 'leads',
			sourceId,
			currentPage,
			itemQuantity
		],
		queryFn: () =>
			isCalculator
				? calculatorService.getLeads(sourceId, currentPage, itemQuantity)
				: widgetService.getLeads(sourceId, currentPage, itemQuantity),
		enabled: auth
	})

	const { data: subscription } = useQuery<Subscription>({
		queryKey: ['subscription'],
		queryFn: () => widgetService.getSubscription(),
		enabled: auth
	})

	const canAccess =
		subscription?.plan === 'TRIAL' || subscription?.plan === 'HARD'

	const { data: statsData } = useQuery<LeadsStatsResponse>({
		queryKey: ['leads-stats', sourceId],
		queryFn: () => widgetService.getLeadsStats(sourceId),
		enabled: !!auth && canAccess && !isCalculator
	})

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

	const formatCalculatorAnswers = (
		answers: CalculatorLead['answers']
	): string => {
		if (Array.isArray(answers)) {
			return answers
				.map(answer => {
					const value =
						answer.valueLabel ||
						(Array.isArray(answer.value)
							? answer.value.join(', ')
							: String(answer.value))
					return `${answer.fieldLabel || answer.fieldId}: ${value}`
				})
				.join('; ')
		}

		return Object.entries(answers || {})
			.map(
				([key, value]) =>
					`${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`
			)
			.join('; ')
	}

	const escapeHtml = (value: unknown) =>
		String(value ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;')

	const formatPdfUrl = (url?: string | null) => {
		if (!url) return '—'

		const label = url.length > 50 ? `${url.slice(0, 50)}…` : url
		try {
			const parsedUrl = new URL(url)
			if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
				return escapeHtml(label)
			}
			return `<a href="${escapeHtml(parsedUrl.toString())}">${escapeHtml(label)}</a>`
		} catch {
			return escapeHtml(label)
		}
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
			const blob = isCalculator
				? await calculatorService.exportLeads(sourceId, 'csv')
				: await widgetService.exportLeads(sourceId, 'csv')
			triggerDownload(
				blob,
				isCalculator ? 'calculator-leads.csv' : 'leads.csv'
			)
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
			const blob = isCalculator
				? await calculatorService.exportLeads(sourceId, 'xlsx')
				: await widgetService.exportLeads(sourceId, 'xlsx')
			triggerDownload(
				blob,
				isCalculator ? 'calculator-leads.xlsx' : 'leads.xlsx'
			)
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
			const all = isCalculator
				? await calculatorService.getAllLeads(sourceId)
				: await widgetService.getAllLeads(sourceId)
			const html = buildPdfHtml(all.leads)
			const blob = new Blob([html], { type: 'text/html; charset=utf-8' })
			const url = URL.createObjectURL(blob)
			window.open(url, '_blank')
			toast.success(
				'PDF открыт в новой вкладке — нажмите Ctrl+P для сохранения',
				{
					id: toastId,
					duration: 5000
				}
			)
		} catch {
			toast.error('Ошибка при формировании PDF', { id: toastId })
		} finally {
			setExporting(null)
		}
	}

	const buildPdfHtml = (leads: Array<Lead | CalculatorLead>) => {
		const rows = leads
			.map((lead, i) => {
				if (isCalculator) {
					const calculatorLead = lead as CalculatorLead
					return `
			<tr>
				<td>${i + 1}</td>
				<td>${escapeHtml(formatDate(calculatorLead.createdAt))}</td>
				<td>${calculatorLead.phone ? escapeHtml(formatPhone(calculatorLead.phone)) : '—'}</td>
				<td>${calculatorLead.email ? escapeHtml(calculatorLead.email) : '—'}</td>
				<td>${escapeHtml(formatCalculatorAnswers(calculatorLead.answers)) || '—'}</td>
				<td>${escapeHtml(calculatorLead.calculatedPrice)} ${escapeHtml(calculatorLead.currency)}</td>
				<td>${formatPdfUrl(calculatorLead.url)}</td>
			</tr>`
				}

				const wheelLead = lead as Lead
				return `
			<tr>
				<td>${i + 1}</td>
				<td>${escapeHtml(formatDate(wheelLead.createdAt))}</td>
				<td>${wheelLead.phone ? escapeHtml(formatPhone(wheelLead.phone)) : wheelLead.contact ? escapeHtml(formatPhone(wheelLead.contact)) : '—'}</td>
				<td>${wheelLead.email ? escapeHtml(wheelLead.email) : '—'}</td>
				<td>${wheelLead.bonus ? escapeHtml(wheelLead.bonus) : '—'}</td>
				<td>${formatPdfUrl(wheelLead.url)}</td>
			</tr>`
			})
			.join('')
		const extraHead = isCalculator
			? '<th scope="col">Параметры</th><th scope="col">Расчёт</th>'
			: '<th scope="col">Бонус</th>'

		return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${isCalculator ? 'Заявки калькулятора' : 'Заявки'}</title>
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
<h1>Заявки — всего ${leads.length}</h1>
<table>
  <caption style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">Таблица заявок по виджету</caption>
  <thead>
    <tr>
      <th scope="col">#</th>
      <th scope="col">Дата</th>
      <th scope="col">Телефон</th>
      <th scope="col">Email</th>
	  ${extraHead}
      <th scope="col">Страница</th>
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

			<h1 className={styles.title}>
				{isCalculator ? 'Заявки калькулятора' : 'Заявки'}
			</h1>

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
							{isCalculator
								? 'Всего страниц списка'
								: 'Уникальных бонусов'}
						</span>
						{isPending ? (
							<SkeletonLoader height={28} width={64} />
						) : (
							<strong className={styles.metricValue}>
								{isCalculator
									? data?.total
										? totalPages
										: 0
									: canAccess
										? (statsData?.stats.length ?? 0)
										: '—'}
							</strong>
						)}
					</span>
				</div>
			</div>

			{!isCalculator &&
				canAccess &&
				statsData &&
				statsData.stats.length > 0 && (
					<div className={styles.statsBlock}>
						<p className={styles.statsTitle}>Аналитика бонусов</p>
						<div className={styles.statsList}>
							{statsData.stats.map(stat => (
								<div key={stat.bonus} className={styles.statRow}>
									<span className={styles.statName}>{stat.bonus}</span>
									<div className={styles.statBarWrap}>
										<div
											className={styles.statBar}
											style={{ width: `${stat.percent}%` }}
										/>
									</div>
									<span className={styles.statCount}>{stat.count}</span>
									<span className={styles.statPercent}>
										{stat.percent}%
									</span>
								</div>
							))}
						</div>
						<p className={styles.statsTotal}>
							Всего заявок: {statsData.total}
						</p>
					</div>
				)}

			{!isCalculator && !canAccess && subscription && (
				<div className={styles.statsLocked}>
					🔒 Аналитика бонусов доступна на{' '}
					<Link href="/payment" className={styles.exportHintLink}>
						тарифах Тест-драйв и Hard
					</Link>
				</div>
			)}

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
							{(isCalculator
								? [0.4, 1.2, 1.2, 1.2, 2, 1.1, 1.8]
								: [0.4, 1.5, 1.5, 1.5, 1.2, 1.8]
							).map((flex, i) => (
								<div key={i} style={{ flex, minWidth: 0 }}>
									<SkeletonLoader height={14} />
								</div>
							))}
						</div>
						{[1, 2, 3, 4, 5].map(i => (
							<div key={i} className={styles.skeletonRow}>
								{(isCalculator
									? [0.4, 1.2, 1.2, 1.2, 2, 1.1, 1.8]
									: [0.4, 1.5, 1.5, 1.5, 1.2, 1.8]
								).map((flex, j) => (
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
							<AppIcon name="payment" size={17} />
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
						<caption className="srOnly">
							{isCalculator
								? 'Таблица заявок калькулятора'
								: 'Таблица заявок по виджету'}
						</caption>
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
								{isCalculator ? (
									<>
										<th className={styles.th} scope="col">
											Параметры
										</th>
										<th className={styles.th} scope="col">
											Расчёт
										</th>
									</>
								) : (
									<th className={styles.th} scope="col">
										Бонус
									</th>
								)}
								<th className={styles.th} scope="col">
									Страница
								</th>
							</tr>
						</thead>
						<tbody>
							{data.leads.map((lead, i) => {
								const calculatorLead = lead as CalculatorLead
								const wheelLead = lead as Lead
								return (
									<tr key={lead.id} className={styles.tr}>
										<td className={styles.td} data-label="#">
											{(data.page - 1) * data.limit + i + 1}
										</td>
										<td className={styles.td} data-label="Дата">
											{formatDate(lead.createdAt)}
										</td>
										<td className={styles.td} data-label="Телефон">
											{lead.phone
												? formatPhone(lead.phone)
												: !isCalculator && lead.contact
													? formatPhone(lead.contact)
													: '—'}
										</td>
										<td className={styles.td} data-label="Email">
											{lead.email || '—'}
										</td>
										{isCalculator ? (
											<>
												<td className={styles.td} data-label="Параметры">
													{formatCalculatorAnswers(
														calculatorLead.answers
													) || '—'}
												</td>
												<td className={styles.td} data-label="Расчёт">
													{calculatorLead.calculatedPrice}{' '}
													{calculatorLead.currency}
												</td>
											</>
										) : (
											<td className={styles.td} data-label="Бонус">
												{wheelLead.bonus || '—'}
											</td>
										)}
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
								)
							})}
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

export default WidgetLeads
