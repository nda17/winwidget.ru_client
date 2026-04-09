import {
	getAccessToken,
	removeFromStorage
} from '@/services/auth/auth.helper'
import authService from '@/services/auth/auth.service'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import userService from '@/services/user/user.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { transformUserToState } from '@/utils/transform-user-to-state'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const useUser = () => {
	const auth = useAuthStore((state) => state.auth)
	const isAuthResolved = useAuthStore((state) => state.isAuthResolved)
	const setAuth = useAuthStore((state) => state.setAuth)
	const setAuthResolved = useAuthStore((state) => state.setAuthResolved)
	const queryClient = useQueryClient()
	const pathname = usePathname()
	const hasAccessToken = getAccessToken() !== null
	const isProtectedPath =
		pathname === PUBLIC_PAGES.USER_PROFILE ||
		pathname === PUBLIC_PAGES.MANAGER ||
		pathname.startsWith('/admin')

	const { data, isLoading } = useQuery({
		queryKey: ['get-profile', auth],
		queryFn: () => userService.fetchProfile(),
		refetchInterval: 1800000, // 30 minutes in milliseconds

		enabled: auth && hasAccessToken
	})

	useEffect(() => {
		let ignore = false

		const syncSession = async () => {
			if (getAccessToken()) {
				if (!ignore) {
					setAuth(true)
					setAuthResolved(true)
				}
				return
			}

			if (!ignore) {
				setAuthResolved(false)
			}

			try {
				await authService.getNewTokens()

				if (!ignore) {
					setAuth(true)
					setAuthResolved(true)
					queryClient.invalidateQueries({
						queryKey: ['get-profile']
					})
				}
			} catch {
				if (!ignore) {
					removeFromStorage()
					setAuth(false)
					setAuthResolved(true)
					queryClient.removeQueries({
						queryKey: ['get-profile']
					})
					if (isProtectedPath) {
						window.location.href = PUBLIC_PAGES.LOGIN
					}
				}
			}
		}

		void syncSession()

		return () => {
			ignore = true
		}
	}, [pathname, queryClient, setAuth, setAuthResolved])

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState !== 'visible') {
				return
			}

			if (!getAccessToken()) {
				void authService
					.getNewTokens()
					.then(() => {
						setAuth(true)
						setAuthResolved(true)
						queryClient.invalidateQueries({
							queryKey: ['get-profile']
						})
					})
					.catch(() => {
						removeFromStorage()
						setAuth(false)
						setAuthResolved(true)
						queryClient.removeQueries({
							queryKey: ['get-profile']
						})
						if (isProtectedPath) {
							window.location.href = PUBLIC_PAGES.LOGIN
						}
					})
			}
		}

		window.addEventListener('focus', handleVisibilityChange)
		document.addEventListener(
			'visibilitychange',
			handleVisibilityChange
		)

		return () => {
			window.removeEventListener('focus', handleVisibilityChange)
			document.removeEventListener(
				'visibilitychange',
				handleVisibilityChange
			)
		}
	}, [isProtectedPath, queryClient, setAuth, setAuthResolved])

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
