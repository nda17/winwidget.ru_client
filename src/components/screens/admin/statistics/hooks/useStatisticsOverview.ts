import StatisticsService from '@/services/statistics/statistics.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'

export const useStatisticsOverview = () => {
	const auth = useAuthStore(state => state.auth)

	const { data, isPending } = useQuery({
		queryKey: ['get-statistics-dashboard'],
		queryFn: () => StatisticsService.getDashboard(),
		select: ({ data }) => data,
		enabled: auth
	})

	return {
		data,
		isPending
	}
}
