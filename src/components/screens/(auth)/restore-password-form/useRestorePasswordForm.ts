import { usePhoneMask } from '@/hooks/usePhoneMask'
import { useRecaptchaV3 } from '@/hooks/useRecaptchaV3'
import authService from '@/services/auth/auth.service'
import { IRestorePassword } from '@/shared/types/form.types'
import { validEmail, validPhone } from '@/shared/regex'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { FieldErrors, SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const useRestorePasswordForm = () => {
	const { register, handleSubmit, reset, formState, setValue } =
		useForm<IRestorePassword>({
			mode: 'onChange'
		})
	const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
	const phoneInputRef = useRef<HTMLInputElement>(null)
	const phoneMask = usePhoneMask(setValue, phoneInputRef)
	const resetPhoneMask = phoneMask.reset

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
				data: IRestorePassword
				token: string | null
			}) => authService.getRestorePassword(data, token),
			onSuccess() {
				startTransition(() => {
					toast.success(
						authMethod === 'phone'
							? 'Новый пароль отправлен по SMS'
							: 'Временный пароль отправлен на вашу почту'
					)
					reset()
					router.replace('/login')
				})
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					const serverMessage = error.response?.data?.message
					const message =
						serverMessage === 'Internal server error'
							? 'Не удалось отправить письмо. Попробуйте позже.'
							: serverMessage || 'Проверьте корректность введённых данных'

					toast.error(`Ошибка восстановления пароля: ${message}`)
				}
			}
		})

	useEffect(() => {
		setValue('email', '')
		setValue('phone', '')
		resetPhoneMask()
	}, [authMethod, resetPhoneMask, setValue])

	const onSubmit: SubmitHandler<IRestorePassword> = async data => {
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

		if (authMethod === 'phone') {
			if (!data.phone || !validPhone.test(data.phone)) {
				toast.error('Введите корректный номер телефона')
				return
			}
		} else {
			if (!data.email) {
				toast.error('Введите email')
				return
			}

			if (!validEmail.test(data.email)) {
				toast.error('Введите корректный email')
				return
			}
		}

		mutateRestorePassword({ data, token })
	}

	const onInvalid = (errors: FieldErrors<IRestorePassword>) => {
		if (authMethod === 'phone') {
			const message =
				errors.phone?.message || 'Введите корректный номер телефона'

			toast.error(String(message))
			return
		}

		const message = errors.email?.message || 'Введите корректный email'
		toast.error(String(message))
	}

	const isLoading = isPending || isRestorePending

	return {
		register,
		handleSubmit,
		onSubmit,
		onInvalid,
		isLoading,
		formState,
		authMethod,
		setAuthMethod,
		phoneInputRef,
		phoneMask
	}
}

export default useRestorePasswordForm
