import userService from '@/services/user/user.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { transformUserToState } from '@/utils/transform-user-to-state'
import { useQuery } from '@tanstack/react-query'

const useUser = () => {
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)

	const { data, isLoading } = useQuery({
		queryKey: ['get-profile', auth],
		queryFn: () => userService.fetchProfile(),
		refetchInterval: 1800000,
		enabled: auth
	})

	const profile = data?.data
	const userState = profile ? transformUserToState(profile) : null

	return {
		isLoading: !isAuthResolved || isLoading,
		user: {
			...profile,
			...userState
		}
	}
}

export default useUser
