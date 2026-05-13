import { useStatisticsOverview } from '@/components/screens/admin/statistics/hooks/useStatisticsOverview'
import { getLeadTypeChartData } from '@/components/screens/admin/statistics/statistics.utils'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import { FC } from 'react'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const palette = [
	'#E6A34D',
	'#BE496B',
	'#406E8E',
	'#2A9D8F',
	'#FFB703',
	'#6C757D'
]

const LeadsByTypeChart: FC = () => {
	const { data, isPending } = useStatisticsOverview()
	const leadTypeChartData = getLeadTypeChartData(data)

	if (isPending) {
		return <SkeletonLoader count={1} className="w-full h-full" />
	}

	if (!leadTypeChartData.length) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-[#6b7280]">
				Заявок за 30 дней пока нет
			</div>
		)
	}

	return (
		<Doughnut
			data={{
				labels: leadTypeChartData.map(item => item.label),
				datasets: [
					{
						label: 'Заявки',
						data: leadTypeChartData.map(item => item.count),
						backgroundColor: leadTypeChartData.map(
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

export default LeadsByTypeChart
