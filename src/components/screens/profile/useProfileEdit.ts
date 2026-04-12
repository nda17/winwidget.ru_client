import { errorCatch } from '@/api/api.helper'
import userService, {
	IProfileEditInput
} from '@/services/user/user.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SubmitHandler } from 'react-hook-form'
import toast from 'react-hot-toast'

export const useProfileEdit = () => {
	const queryClient = useQueryClient()

	const { mutateAsync, isPending } = useMutation({
		mutationKey: ['update-profile'],
		mutationFn: (data: IProfileEditInput) =>
			userService.updateProfile(data),
		onSuccess() {
			toast.success('Изменения профиля сохранены')
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		},
		onError(error) {
			toast.error(`Изменение данных профиля: ${errorCatch(error)}`)
		}
	})

	const onSubmit: SubmitHandler<IProfileEditInput> = async data => {
		try {
			await mutateAsync({
				name: data.name || undefined,
				avatarPath: data.avatarPath || undefined,
				password: data.password || undefined
			})

			return true
		} catch {
			// Error toast is handled in the mutation.
			return false
		}
	}

	return {
		onSubmit,
		isLoading: isPending
	}
}
