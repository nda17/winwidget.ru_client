import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import authService from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/entities/user'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export const useLogout = (onClose?: () => void) => {
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)
	const { replace } = useRouter()
	const queryClient = useQueryClient()

	const { mutate, isPending } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => authService.logout(),
		onSuccess() {
			toast.success('Вы вышли из аккаунта')
			queryClient.clear()
			setAuth(false)
			setAuthResolved(true)
			onClose?.()
			replace(PUBLIC_PAGES.LOGIN)
		},
		onError() {
			toast.error('Не удалось завершить выход. Попробуйте ещё раз.')
		}
	})

	return { logout: mutate, isPending }
}
