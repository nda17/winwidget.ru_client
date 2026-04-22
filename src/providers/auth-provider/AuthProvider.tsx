'use client'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import {
	getAccessToken,
	isAccessTokenValid,
	removeFromStorage
} from '@/services/auth/auth.helper'
import authService from '@/services/auth/auth.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 60 * 1000

interface IAuthProviderProps {
	children: React.ReactNode
	hasSessionHint: boolean
}

const AuthProvider = ({
	children,
	hasSessionHint
}: IAuthProviderProps) => {
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)
	const queryClient = useQueryClient()
	const pathname = usePathname()
	const isMountedRef = useRef(true)
	const hasSessionHintRef = useRef(hasSessionHint)
	const isProtectedPath =
		pathname === PUBLIC_PAGES.USER_PROFILE ||
		pathname.startsWith(`${PUBLIC_PAGES.USER_PROFILE}/`) ||
		pathname.startsWith('/admin')

	const syncSession = useCallback(async () => {
		const accessToken = getAccessToken()

		if (accessToken) {
			hasSessionHintRef.current = true
		}

		if (
			isAccessTokenValid(accessToken, ACCESS_TOKEN_REFRESH_THRESHOLD_MS)
		) {
			if (isMountedRef.current) {
				setAuth(true)
				setAuthResolved(true)
			}

			return
		}

		if (!isProtectedPath && !hasSessionHintRef.current) {
			if (isMountedRef.current) {
				setAuth(false)
				setAuthResolved(true)
				queryClient.removeQueries({ queryKey: ['get-profile'] })
			}

			return
		}

		if (isMountedRef.current) {
			setAuthResolved(false)
		}

		try {
			await authService.getNewTokens()
			hasSessionHintRef.current = true

			if (isMountedRef.current) {
				setAuth(true)
				setAuthResolved(true)
				queryClient.invalidateQueries({ queryKey: ['get-profile'] })
			}
		} catch {
			removeFromStorage()

			if (!isMountedRef.current) {
				return
			}

			setAuth(false)
			setAuthResolved(true)
			queryClient.removeQueries({ queryKey: ['get-profile'] })
			hasSessionHintRef.current = false

			if (isProtectedPath) {
				window.location.href = PUBLIC_PAGES.LOGIN
			}
		}
	}, [isProtectedPath, queryClient, setAuth, setAuthResolved])

	useEffect(() => {
		hasSessionHintRef.current = hasSessionHint
	}, [hasSessionHint])

	useEffect(() => {
		isMountedRef.current = true
		void syncSession()

		return () => {
			isMountedRef.current = false
		}
	}, [syncSession])

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState !== 'visible') {
				return
			}

			void syncSession()
		}

		window.addEventListener('focus', handleVisibilityChange)
		window.addEventListener('pageshow', handleVisibilityChange)
		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			window.removeEventListener('focus', handleVisibilityChange)
			window.removeEventListener('pageshow', handleVisibilityChange)
			document.removeEventListener(
				'visibilitychange',
				handleVisibilityChange
			)
		}
	}, [syncSession])

	return <>{children}</>
}

export default AuthProvider
