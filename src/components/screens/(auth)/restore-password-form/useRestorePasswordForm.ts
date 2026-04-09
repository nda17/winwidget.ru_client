import { useRecaptchaV3 } from '@/hooks/useRecaptchaV3'
import authService from '@/services/auth/auth.service'
import { IEmail } from '@/shared/types/form.types'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const useRestorePasswordForm = () => {
	const { register, handleSubmit, reset, formState } = useForm<IEmail>()

	const router = useRouter()

	const [isPending, startTransition] = useTransition()
	const { executeRecaptcha, isRecaptchaReady } = useRecaptchaV3()

	const { mutate: mutateRestorePassword, isPending: isRestorePending } =
		useMutation({
			mutationKey: ['restore-password'],
			mutationFn: ({
				data,
				token
			}: {
				data: IEmail
				token: string | null
			}) => authService.getRestorePassword(data, token),
			onSuccess() {
				startTransition(() => {
					toast.success('Временный пароль отправлен на вашу почту')
					reset()
					router.replace('/login')
				})
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(
						`Ошибка восстановления пароля: ${error.response?.data?.message}`
					)
				}
			}
		})

	const onSubmit: SubmitHandler<IEmail> = async (data) => {
		if (!isRecaptchaReady) {
			toast.error('Капча недоступна')
			return
		}

		let token: string | null = null

		try {
			token = await executeRecaptcha('restore_password')
		} catch {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (!token) {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		mutateRestorePassword({ data, token })
	}

	const isLoading = isPending || isRestorePending

	return {
		register,
		handleSubmit,
		onSubmit,
		isLoading,
		formState
	}
}

export default useRestorePasswordForm
