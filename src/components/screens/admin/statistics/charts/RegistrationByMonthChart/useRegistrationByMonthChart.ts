import { useRegistrationsByMonth as useRegistrationsByMonthQuery } from '@/components/screens/admin/statistics/hooks/useRegistrationsByMonth'
import { getRegistrationLabels } from '@/components/screens/admin/statistics/statistics.utils'
import { ChartData } from 'chart.js'

export const useRegistrationsByMonthChart = () => {
	const { data, isPending } = useRegistrationsByMonthQuery()

	return {
		data: data
			? ({
					labels: getRegistrationLabels(data),
					datasets: [
						{
							label: 'Регистрации',
							data: data.map(item => item.count),
							borderColor: '#E6A34D',
							backgroundColor: 'rgba(230, 163, 77, 0.18)',
							fill: true,
							tension: 0.35
						}
					]
				} as ChartData<'line', number[], string>)
			: null,
		isPending
	}
}
