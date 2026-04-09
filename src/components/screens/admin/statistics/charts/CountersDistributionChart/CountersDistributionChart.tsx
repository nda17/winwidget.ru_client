import { useCounters } from '@/components/screens/admin/statistics/counters/useCounters'
import { getCountersChartData } from '@/components/screens/admin/statistics/statistics.utils'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import {
	ArcElement,
	Chart as ChartJS,
	Legend,
	Tooltip
} from 'chart.js'
import { FC } from 'react'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const palette = ['#E6A34D', '#BE496B', '#406E8E', '#2A9D8F', '#FFB703', '#6C757D']

const CountersDistributionChart: FC = () => {
	const { data, isPending } = useCounters()
	const countersData = getCountersChartData(data)

	if (isPending) {
		return <SkeletonLoader count={1} className="w-full h-full" />
	}

	if (!countersData.length) {
		return null
	}

	return (
		<Doughnut
			data={{
				labels: countersData.map((item) => item.label),
				datasets: [
					{
						label: 'Распределение',
						data: countersData.map((item) => item.value),
						backgroundColor: countersData.map(
							(_, index) => palette[index % palette.length]
						),
						borderWidth: 0
					}
				]
			}}
			options={{
				responsive: true,
				maintainAspectRatio: false,
				cutout: '62%',
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							boxWidth: 12,
							padding: 12,
							font: {
								size: 11
							}
						}
					}
				}
			}}
		/>
	)
}

export default CountersDistributionChart
