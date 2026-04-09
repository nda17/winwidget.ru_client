import {
	IStatisticsCounter,
	IUserRegistrationsByMonth
} from '@/services/statistics/statistics.service'

const numberFormatter = new Intl.NumberFormat('ru-RU')

export const parseStatValue = (value: string | number | null | undefined) => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : 0
	}

	if (typeof value !== 'string') {
		return 0
	}

	const normalizedValue = value.replace(/\s+/g, '').replace(',', '.')
	const match = normalizedValue.match(/-?\d+(\.\d+)?/)

	if (!match) {
		return 0
	}

	return Number(match[0])
}

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

export const getRegistrationLabels = (items: IUserRegistrationsByMonth[]) =>
	items.map((item) => `${item.month} ${item.year}`)

export const getCountersChartData = (
	counters: IStatisticsCounter[] | undefined
) => {
	if (!counters?.length) {
		return []
	}

	return counters
		.map((item) => ({
			label: item.name,
			value: parseStatValue(item.value)
		}))
		.filter((item) => item.value > 0)
}

export const getTopCounter = (counters: IStatisticsCounter[] | undefined) => {
	const parsedCounters = getCountersChartData(counters)

	if (!parsedCounters.length) {
		return null
	}

	return parsedCounters.reduce((topItem, currentItem) =>
		currentItem.value > topItem.value ? currentItem : topItem
	)
}
