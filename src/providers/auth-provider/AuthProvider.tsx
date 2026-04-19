'use client'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import {
	getAccessToken,
	removeFromStorage
} from '@/services/auth/auth.helper'
import authService from '@/services/auth/auth.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)
	const queryClient = useQueryClient()
	const pathname = usePathname()
	const isProtectedPath =
		pathname === PUBLIC_PAGES.USER_PROFILE || pathname.startsWith('/admin')

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

			try {
				await authService.getNewTokens()

				if (!ignore) {
					setAuth(true)
					setAuthResolved(true)
					queryClient.invalidateQueries({ queryKey: ['get-profile'] })
				}
			} catch {
				if (!ignore) {
					removeFromStorage()
					setAuth(false)
					setAuthResolved(true)
					queryClient.removeQueries({ queryKey: ['get-profile'] })
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
	}, [pathname, isProtectedPath, queryClient, setAuth, setAuthResolved])

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState !== 'visible') return
			if (getAccessToken()) return

			void authService
				.getNewTokens()
				.then(() => {
					setAuth(true)
					setAuthResolved(true)
					queryClient.invalidateQueries({ queryKey: ['get-profile'] })
				})
				.catch(() => {
					removeFromStorage()
					setAuth(false)
					setAuthResolved(true)
					queryClient.removeQueries({ queryKey: ['get-profile'] })
					if (isProtectedPath) {
						window.location.href = PUBLIC_PAGES.LOGIN
					}
				})
		}

		window.addEventListener('focus', handleVisibilityChange)
		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			window.removeEventListener('focus', handleVisibilityChange)
			document.removeEventListener(
				'visibilitychange',
				handleVisibilityChange
			)
		}
	}, [isProtectedPath, queryClient, setAuth, setAuthResolved])

	return <>{children}</>
}

export default AuthProvider
