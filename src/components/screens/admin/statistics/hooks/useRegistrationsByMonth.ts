import statisticsService from '@/services/statistics/statistics.service'
import { useQuery } from '@tanstack/react-query'

export const useRegistrationsByMonth = () => {
	const { data, isPending } = useQuery({
		queryKey: ['get-registrations-by-month'],
		queryFn: () => statisticsService.getRegistrationsByMonth(),
		select: ({ data }) => data
	})

	return {
		data,
		isPending
	}
}
