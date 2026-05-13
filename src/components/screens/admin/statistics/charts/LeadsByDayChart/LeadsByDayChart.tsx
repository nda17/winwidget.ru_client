import { useStatisticsOverview } from '@/components/screens/admin/statistics/hooks/useStatisticsOverview'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LinearScale,
	Tooltip
} from 'chart.js'
import { FC } from 'react'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const LeadsByDayChart: FC = () => {
	const { data, isPending } = useStatisticsOverview()

	if (isPending) {
		return <SkeletonLoader count={1} className="w-full h-full" />
	}

	if (!data?.leads.byDay.length) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-[#6b7280]">
				Нет данных за период
			</div>
		)
	}

	return (
		<Bar
			data={{
				labels: data.leads.byDay.map(item => item.label),
				datasets: [
					{
						label: 'Колесо',
						data: data.leads.byDay.map(item => item.wheel),
						backgroundColor: '#E6A34D',
						borderRadius: 6
					},
					{
						label: 'Квизы',
						data: data.leads.byDay.map(item => item.quiz),
						backgroundColor: '#BE496B',
						borderRadius: 6
					},
					{
						label: 'Обратный звонок',
						data: data.leads.byDay.map(item => item.callback),
						backgroundColor: '#406E8E',
						borderRadius: 6
					},
					{
						label: 'Таймеры',
						data: data.leads.byDay.map(item => item.countdownTimer),
						backgroundColor: '#2A9D8F',
						borderRadius: 6
					}
				]
			}}
			options={{
				responsive: true,
				maintainAspectRatio: false,
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
						stacked: true,
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
						stacked: true,
						ticks: {
							font: {
								size: 10
							}
						}
					}
				}
			}}
		/>
	)
}

export default LeadsByDayChart
