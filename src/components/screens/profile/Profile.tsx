'use client'
import styles from '@/components/screens/profile/Profile.module.scss'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import Heading from '@/components/ui/heading/Heading'
import UserInfo from '@/components/ui/user-info/UserInfo'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import useUser from '@/hooks/useUser'
import authService from '@/services/auth/auth.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import toast from 'react-hot-toast'

const Profile: NextPage = () => {
	const { user, isLoading } = useUser()
	const { replace } = useRouter()
	const queryClient = useQueryClient()

	const [isPending, startTransition] = useTransition()

	const { mutate: mutateLogout, isPending: isLogoutPending } = useMutation(
		{
			mutationKey: ['logout'],
			mutationFn: () => authService.logout(),
			onSuccess() {
				startTransition(() => {
					toast.success('Вы вышли из аккаунта')
					queryClient.clear()
					replace(PUBLIC_PAGES.LOGIN)
				})
			}
		}
	)

	const isLogoutLoading = isLogoutPending || isPending

	return (
		<div className={styles.wrapper}>
			<Heading text="Профиль" />

			{isLoading ? (
				<CirclesLoader />
			) : (
				<>
					<UserInfo
						avatarPath={user?.avatarPath}
						name={user?.name}
						isLoading={isLoading}
					/>
					{user?.email && (
						<p className={clsx(styles['info-field'])}>
							Email: {user.email}{' '}
							<i>
								(
								{user.verificationToken
									? 'Требуется подтверждение'
									: 'Подтверждено'}
								)
							</i>
						</p>
					)}
					{user?.phone && (
						<p className={clsx(styles['info-field'])}>
							Телефон: {user.phone}{' '}
							<i>
								(
								{user.isPhoneVerified
									? 'Подтвержден'
									: 'Требуется подтверждение'}
								)
							</i>
						</p>
					)}
					<button
						onClick={() => mutateLogout()}
						disabled={isLogoutLoading}
						className={clsx(styles['logout-button'])}
					>
						{isLogoutLoading ? 'Подождите...' : 'Выйти'}
					</button>
				</>
			)}
		</div>
	)
}

export default Profile
