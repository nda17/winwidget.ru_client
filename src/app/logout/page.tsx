'use client'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import authService from '@/services/auth/auth.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const LogoutPage = () => {
	const setAuth = useAuthStore((state) => state.setAuth)
	const setAuthResolved = useAuthStore((state) => state.setAuthResolved)
	const { replace } = useRouter()
	const queryClient = useQueryClient()

	const { mutate: mutateLogout } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => authService.logout(),
		onMutate() {
			queryClient.clear()
			setAuth(false)
			setAuthResolved(true)
		}
	})

	useEffect(() => {
		mutateLogout()
		replace(PUBLIC_PAGES.LOGIN)
	}, [mutateLogout, replace])

	return <CirclesLoader />
}

export default LogoutPage
