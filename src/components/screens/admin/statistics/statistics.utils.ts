import { IStatisticsDashboard } from '@/services/statistics/statistics.service'

const numberFormatter = new Intl.NumberFormat('ru-RU')
const moneyFormatter = new Intl.NumberFormat('ru-RU', {
	style: 'currency',
	currency: 'RUB',
	maximumFractionDigits: 0
})

export const formatStatValue = (value: number) => {
	if (!Number.isFinite(value)) {
		return '0'
	}

	return numberFormatter.format(value)
}

export const formatMoney = (value: number) => {
	if (!Number.isFinite(value)) {
		return moneyFormatter.format(0)
	}

	return moneyFormatter.format(value)
}

export const formatPercentage = (value: number | null | undefined) => {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return '—'
	}

	const sign = value > 0 ? '+' : ''

	return `${sign}${value.toFixed(1)}%`
}

export const getLeadTypeChartData = (
	dashboard: IStatisticsDashboard | undefined
) => dashboard?.leads.byType30d.filter(item => item.count > 0) ?? []
