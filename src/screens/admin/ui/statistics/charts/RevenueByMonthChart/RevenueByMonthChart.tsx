import { useRevenueByMonthChart } from '@/screens/admin/model/statistics/useRevenueByMonthChart'
import { formatMoney } from '@/screens/admin/model/statistics/statistics.utils'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend,
	LineElement,
	LinearScale,
	PointElement,
	Tooltip
} from 'chart.js'
import { FC } from 'react'
import { Line } from 'react-chartjs-2'

ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Filler,
	Tooltip,
	Legend
)

const RevenueByMonthChart: FC = () => {
	const { data, isPending } = useRevenueByMonthChart()

	return isPending ? (
		<SkeletonLoader count={1} className="w-full h-full" />
	) : data ? (
		<Line
			data={data}
			options={{
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
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
				},
				scales: {
					x: {
						ticks: {
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 6,
							font: {
								size: 10
							}
						}
					},
					y: {
						ticks: {
							callback: value => formatMoney(Number(value)),
							font: {
								size: 10
							}
						}
					}
				}
			}}
		/>
	) : null
}

export default RevenueByMonthChart
