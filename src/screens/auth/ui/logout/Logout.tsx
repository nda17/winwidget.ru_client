'use client'

import { useAuthStore } from '@/entities/user'
import { authService } from '@/features/auth'
import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const Logout = () => {
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)
	const { replace } = useRouter()
	const queryClient = useQueryClient()

	const { mutateAsync: mutateLogout } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => authService.logout(),
		onSuccess() {
			queryClient.clear()
			setAuth(false)
			setAuthResolved(true)
		}
	})

	useEffect(() => {
		const toastId = toast.loading('Загрузка...')
		const logout = async () => {
			try {
				await mutateLogout()
				toast.dismiss(toastId)
				replace(PUBLIC_PAGES.LOGIN)
			} catch {
				toast.error('Не удалось завершить выход. Попробуйте ещё раз.', {
					id: toastId
				})
				replace(PUBLIC_PAGES.HOME)
			}
		}

		void logout()
	}, [mutateLogout, replace])

	return null
}

export default Logout
