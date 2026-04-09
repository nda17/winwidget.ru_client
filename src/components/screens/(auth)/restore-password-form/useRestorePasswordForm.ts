import authService from '@/services/auth/auth.service'
import { IEmail } from '@/shared/types/form.types'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useRef, useTransition } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const SIMULATE_CAPTCHA_FAILURE =
	process.env.NEXT_PUBLIC_SIMULATE_CAPTCHA_FAILURE === 'true'

const useRestorePasswordForm = () => {
	const { register, handleSubmit, reset, formState } = useForm<IEmail>()

	const router = useRouter()

	const [isPending, startTransition] = useTransition()

	const recaptchaRef = useRef<ReCAPTCHA>(null)

	const { mutate: mutateRestorePassword, isPending: isRestorePending } =
		useMutation({
			mutationKey: ['restore-password'],
			mutationFn: ({ data, token }: { data: IEmail; token: string }) =>
				authService.getRestorePassword(data, token),
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
					recaptchaRef.current.reset()
				}
			}
		})

	const onSubmit: SubmitHandler<IEmail> = async (data) => {
		const captcha = recaptchaRef.current

		if (!captcha) {
			toast.error('Капча недоступна')
			return
		}

		const token = await captcha.executeAsync()
		const requestToken = SIMULATE_CAPTCHA_FAILURE ? 'invalid-token' : token

		if (!token) {
			toast.error('Не удалось пройти проверку капчи')
			captcha.reset()
			return
		}

		mutateRestorePassword(
			{ data, token: requestToken },
			{
				onSettled() {
					captcha.reset()
				}
			}
		)
	}

	const isLoading = isPending || isRestorePending

	return {
		register,
		handleSubmit,
		onSubmit,
		recaptchaRef,
		isLoading,
		formState
	}
}

export default useRestorePasswordForm
