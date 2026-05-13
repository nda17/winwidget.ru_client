import { useStatisticsOverview } from '@/components/screens/admin/statistics/hooks/useStatisticsOverview'
import { ChartData } from 'chart.js'

export const useRevenueByMonthChart = () => {
	const { data, isPending } = useStatisticsOverview()

	return {
		data: data
			? ({
					labels: data.charts.revenueByMonth.map(item => item.label),
					datasets: [
						{
							label: 'Выручка',
							data: data.charts.revenueByMonth.map(item => item.revenue),
							borderColor: '#2A9D8F',
							backgroundColor: 'rgba(42, 157, 143, 0.16)',
							fill: true,
							tension: 0.35
						}
					]
				} as ChartData<'line', number[], string>)
			: null,
		isPending
	}
}
