import { IUserEditInput } from '@/components/screens/admin/user/edit/user-edit.interface'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import UserService from '@/services/user/user.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
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

	const onSubmit: SubmitHandler<IUserEditInput> = async data => {
		await mutateAsync(data)
	}

	return { onSubmit, isLoading, data, isSaving: isPending }
}
