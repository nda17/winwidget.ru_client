import StatisticsService from '@/services/statistics/statistics.service'
import { useQuery } from '@tanstack/react-query'

export const useStatisticsOverview = () => {
	const { data, isPending } = useQuery({
		queryKey: ['get-statistics-overview'],
		queryFn: () => StatisticsService.getOverview(),
		select: ({ data }) => data
	})

	return {
		data,
		isPending
	}
}
