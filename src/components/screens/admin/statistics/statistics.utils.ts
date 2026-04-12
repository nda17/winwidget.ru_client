import {
	IStatisticsOverview,
	IUserRegistrationsByMonth
} from '@/services/statistics/statistics.service'

const numberFormatter = new Intl.NumberFormat('ru-RU')

export const formatStatValue = (value: number) => {
	if (!Number.isFinite(value)) {
		return '0'
	}

	return numberFormatter.format(value)
}

export const formatPercentage = (value: number) => {
	if (!Number.isFinite(value)) {
		return '0%'
	}

	const sign = value > 0 ? '+' : ''

	return `${sign}${value.toFixed(1)}%`
}

export const getSortedRegistrations = (
	items: IUserRegistrationsByMonth[] | undefined
) => {
	if (!items?.length) {
		return []
	}

	return [...items].sort((left, right) => {
		const leftDate = new Date(`${left.month} 1, ${left.year}`)
		const rightDate = new Date(`${right.month} 1, ${right.year}`)

		return leftDate.getTime() - rightDate.getTime()
	})
}

export const getRegistrationLabels = (
	items: IUserRegistrationsByMonth[]
) => items.map(item => `${item.month} ${item.year}`)

export const getOverviewChartData = (
	overview: IStatisticsOverview | undefined
) => {
	if (!overview) {
		return []
	}

	return [
		{ label: 'Активные за 30 дней', value: overview.activeUsers30d },
		{ label: 'Новые за 30 дней', value: overview.newUsers30d },
		{ label: 'Премиум', value: overview.premiumUsers },
		{ label: '2+ способов входа', value: overview.multiLoginUsers },
		{ label: 'Админы', value: overview.adminUsers },
		{ label: 'Менеджеры', value: overview.managerUsers }
	].filter(item => item.value > 0)
}
