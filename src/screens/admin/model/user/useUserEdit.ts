import { IUserEditInput } from '@/entities/user'
import { ADMIN_PAGES } from '@/shared/config/pages/admin.config'
import { fileService } from '@/features/upload-file'
import { userService as UserService } from '@/entities/user'
import { useAuthStore } from '@/entities/user'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { SubmitHandler } from 'react-hook-form'
import toast from 'react-hot-toast'

const DEFAULT_AVATAR = '/avatar-default.png'

const isManagedAvatarFile = (avatarPath?: string | null) => {
	return Boolean(
		avatarPath &&
		avatarPath !== DEFAULT_AVATAR &&
		(avatarPath.startsWith('/uploads/') ||
			avatarPath.includes('/user-avatar/'))
	)
}

const deleteAvatarFileSilently = async (avatarPath?: string | null) => {
	if (!isManagedAvatarFile(avatarPath)) return

	try {
		await fileService.delete(avatarPath)
	} catch {
		// Файл мог быть уже удалён или недоступен, профиль уже обновлён.
	}
}

export const useUserEdit = (params: { id: string }) => {
	const auth = useAuthStore(state => state.auth)
	const router = useRouter()
	const userId = params.id
	const queryClient = useQueryClient()

	const { data, error, isLoading, isError } = useQuery({
		queryKey: ['get-user-by-id', userId],
		queryFn: () => UserService.fetchUserById(userId),
		select: ({ data }) => data,
		enabled: auth && !!userId
	})

	const { data: overview, isLoading: isOverviewLoading } = useQuery({
		queryKey: ['get-user-overview', userId],
		queryFn: () => UserService.fetchUserOverview(userId),
		select: ({ data }) => data,
		enabled: auth && !!userId && Boolean(data)
	})

	useEffect(() => {
		if (!isError) return

		if (axios.isAxiosError(error)) {
			toast.error(
				error.response?.data?.message ||
					'Произошла ошибка, попробуйте позже'
			)
			return
		}

		toast.error('Произошла ошибка, попробуйте позже')
	}, [error, isError])

	const { isPending, mutateAsync } = useMutation({
		mutationKey: ['update-user', userId],
		mutationFn: (data: IUserEditInput) =>
			UserService.updateUser(userId, data),
		onSuccess() {
			toast.success('Изменения данных пользователя сохранены')
			void queryClient.invalidateQueries({
				queryKey: ['get-user-by-id', userId]
			})
			void queryClient.invalidateQueries({
				queryKey: ['get-user-overview', userId]
			})
			void queryClient.invalidateQueries({ queryKey: ['get-user-list'] })
			router.push(ADMIN_PAGES.USER_LIST)
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(
					error.response?.data?.message ||
						'Не удалось сохранить изменения пользователя'
				)
				return
			}

			toast.error('Не удалось сохранить изменения пользователя')
		}
	})

	const {
		isPending: isActivationUpdating,
		mutateAsync: toggleActivationAsync
	} = useMutation({
		mutationKey: ['toggle-user-activation', userId],
		mutationFn: () => UserService.toggleUserActivation(userId),
		onSuccess({ data }) {
			toast.success(
				data.status === 'DEACTIVATED'
					? 'Пользователь деактивирован'
					: 'Пользователь активирован'
			)
			void queryClient.invalidateQueries({
				queryKey: ['get-user-by-id', userId]
			})
			void queryClient.invalidateQueries({
				queryKey: ['get-user-overview', userId]
			})
			void queryClient.invalidateQueries({ queryKey: ['get-user-list'] })
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(
					error.response?.data?.message ||
						'Не удалось изменить статус пользователя'
				)
				return
			}

			toast.error('Не удалось изменить статус пользователя')
		}
	})

	const { isPending: isAvatarDeleting, mutateAsync: deleteAvatarAsync } =
		useMutation({
			mutationKey: ['delete-user-avatar', userId],
			mutationFn: async (avatarPath?: string | null) => {
				await UserService.updateUser(userId, {
					avatarPath: null
				} as IUserEditInput)
				await queryClient.invalidateQueries({
					queryKey: ['get-user-by-id', userId]
				})
				await queryClient.invalidateQueries({
					queryKey: ['get-user-list']
				})
				await deleteAvatarFileSilently(avatarPath)
			}
		})

	const onSubmit: SubmitHandler<IUserEditInput> = async data => {
		await mutateAsync(data)
	}

	return {
		onSubmit,
		isLoading,
		data,
		overview,
		isOverviewLoading,
		isSaving: isPending,
		isActivationUpdating,
		toggleActivation: toggleActivationAsync,
		isAvatarDeleting,
		deleteAvatar: deleteAvatarAsync
	}
}
