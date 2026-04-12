import { useRegistrationsByMonth } from '@/components/screens/admin/statistics/hooks/useRegistrationsByMonth'
import { getRegistrationLabels } from '@/components/screens/admin/statistics/statistics.utils'
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

const RegistrationByMonthBarChart: FC = () => {
	const { data, isPending } = useRegistrationsByMonth()

	if (isPending) {
		return <SkeletonLoader count={1} className="w-full h-full" />
	}

	if (!data?.length) {
		return null
	}

	return (
		<Bar
			data={{
				labels: getRegistrationLabels(data),
				datasets: [
					{
						label: 'Регистрации по месяцам',
						data: data.map(item => item.count),
						backgroundColor: '#BE496B',
						borderRadius: 8
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

export default RegistrationByMonthBarChart
