import { statisticsService as StatisticsService } from '@/features/admin-monitoring'
import { useAuthStore } from '@/entities/user'
import { useQuery } from '@tanstack/react-query'

export const useStatisticsOverview = () => {
	const auth = useAuthStore(state => state.auth)

	const query = useQuery({
		queryKey: ['get-statistics-dashboard'],
		queryFn: () => StatisticsService.getDashboard(),
		select: ({ data }) => data,
		enabled: auth
	})

	return {
		data: query.data,
		isPending: query.isPending,
		isError: query.isError,
		error: query.error,
		isFetching: query.isFetching,
		refetch: query.refetch
	}
}
