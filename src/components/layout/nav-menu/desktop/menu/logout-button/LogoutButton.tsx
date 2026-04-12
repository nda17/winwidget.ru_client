import styles from '@/components/layout/nav-menu/desktop/menu/logout-button/LogoutButton.module.scss'
import MaterialIcon from '@/components/ui/icons/MaterialIcon'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import authService from '@/services/auth/auth.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { MouseEvent } from 'react'
import toast from 'react-hot-toast'

const LogoutButton: NextPage = () => {
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)
	const { replace } = useRouter()
	const queryClient = useQueryClient()

	const { mutate: mutateLogout, isPending: isLogoutLoading } = useMutation(
		{
			mutationKey: ['logout'],
			mutationFn: () => authService.logout(),
			onSuccess() {
				toast.success('Вы вышли из аккаунта')
				queryClient.clear()
				setAuth(false)
				setAuthResolved(true)
				replace(PUBLIC_PAGES.LOGIN)
			},
			onError() {
				toast.error('Не удалось завершить выход. Попробуйте ещё раз.')
			}
		}
	)

	const logoutHandler = (e: MouseEvent) => {
		e.preventDefault()
		mutateLogout()
	}

	return (
		<button
			onClick={logoutHandler}
			disabled={isLogoutLoading}
			className={clsx(styles['link-auth-button'])}
		>
			<MaterialIcon name="MdLogout" fill="red" />
			{isLogoutLoading ? 'Подождите...' : 'Выйти'}
		</button>
	)
}

export default LogoutButton
