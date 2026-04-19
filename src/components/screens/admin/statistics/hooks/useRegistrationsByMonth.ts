import statisticsService from '@/services/statistics/statistics.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery } from '@tanstack/react-query'

export const useRegistrationsByMonth = () => {
	const auth = useAuthStore(state => state.auth)

	const { data, isPending } = useQuery({
		queryKey: ['get-registrations-by-month'],
		queryFn: () => statisticsService.getRegistrationsByMonth(),
		select: ({ data }) => data,
		enabled: auth
	})

	return {
		data,
		isPending
	}
}
