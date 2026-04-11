import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { usePhoneMask } from '@/hooks/usePhoneMask'
import { useRecaptchaV3 } from '@/hooks/useRecaptchaV3'
import { useNavigationContext } from '@/providers/navigation-provider/NavigationProvider'
import authService from '@/services/auth/auth.service'
import { IFormData } from '@/shared/types/form.types'
import { validPhoneCode } from '@/shared/regex'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const useAuthForm = (isLogin: boolean) => {
	const { previousRoute } = useNavigationContext()
	const setAuth = useAuthStore((state) => state.setAuth)
	const setAuthResolved = useAuthStore((state) => state.setAuthResolved)

	const whiteListRedirect = ['/?', '/free-content?', '/premium-content?']
	const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
	const [isPhoneCodeRequested, setIsPhoneCodeRequested] = useState(false)

	const { register, handleSubmit, reset, formState, watch, setValue } =
		useForm<IFormData>({
			mode: 'onChange'
		})
	const phoneInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const queryClient = useQueryClient()
	const { executeRecaptcha, isRecaptchaReady } = useRecaptchaV3()
	const phoneValue = watch('phone')
	const phoneMask = usePhoneMask(setValue, phoneInputRef)

	const { mutate: mutateLogin, isPending: isLoginPending } = useMutation({
		mutationKey: ['login'],
		mutationFn: ({
			data,
			token
		}: {
			data: IFormData
			token: string | null
		}) => authService.main('login', data, token),
		onSuccess() {
			startTransition(() => {
				setAuth(true)
				setAuthResolved(true)
				toast.success('Успешный вход в аккаунт')
				reset()
				router.replace(
					previousRoute && whiteListRedirect.includes(previousRoute)
						? previousRoute
						: PUBLIC_PAGES.HOME
				)
				queryClient.invalidateQueries({ queryKey: ['get-profile'] })
			})
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(`Ошибка входа: ${error.response?.data?.message}`)
			}
		}
	})

	const { mutate: mutateRegister, isPending: isRegisterPending } =
		useMutation({
			mutationKey: ['register'],
			mutationFn: ({
				data,
				token
			}: {
				data: IFormData
				token: string | null
			}) => authService.main('register', data, token),
			onSuccess() {
				startTransition(() => {
					setAuth(true)
					setAuthResolved(true)
					toast.success(
						'Регистрация прошла успешно. Ссылка для подтверждения email отправлена на вашу почту.'
					)
					reset()
					router.replace('/profile')
				})
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(
						`Ошибка регистрации: ${error.response?.data?.message}`
					)
				}
			}
		})

	const { mutate: mutatePhoneSendCode, isPending: isPhoneSendCodePending } =
		useMutation({
			mutationKey: ['phone-send-code'],
			mutationFn: ({
				phone,
				token
			}: {
				phone: string
				token: string | null
			}) => authService.sendPhoneCode({ phone }, token),
			onSuccess() {
				setIsPhoneCodeRequested(true)
				toast.success('Код подтверждения отправлен по SMS')
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(
						`Ошибка отправки кода: ${error.response?.data?.message}`
					)
				}
			}
		})

	const { mutate: mutatePhoneRegister, isPending: isPhoneRegisterPending } =
		useMutation({
			mutationKey: ['phone-register'],
			mutationFn: ({
				data,
				token
			}: {
				data: IFormData
				token: string | null
			}) =>
				authService.registerByPhone(
					{
						phone: data.phone || '',
						password: data.password,
						code: data.code
					},
					token
				),
			onSuccess() {
				startTransition(() => {
					setAuth(true)
					setAuthResolved(true)
					toast.success('Регистрация по номеру телефона прошла успешно')
					reset()
					setIsPhoneCodeRequested(false)
					queryClient.invalidateQueries({ queryKey: ['get-profile'] })
					router.replace('/profile')
				})
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(
						`Ошибка регистрации: ${error.response?.data?.message}`
					)
				}
			}
		})

	const { mutate: mutatePhoneLogin, isPending: isPhoneLoginPending } =
		useMutation({
			mutationKey: ['phone-login'],
			mutationFn: ({
				data,
				token
			}: {
				data: IFormData
				token: string | null
			}) =>
				authService.loginByPhone(
					{
						phone: data.phone || '',
						password: data.password
					},
					token
				),
			onSuccess() {
				startTransition(() => {
					setAuth(true)
					setAuthResolved(true)
					toast.success('Успешный вход в аккаунт')
					reset()
					router.replace(
						previousRoute && whiteListRedirect.includes(previousRoute)
							? previousRoute
							: PUBLIC_PAGES.HOME
					)
					queryClient.invalidateQueries({ queryKey: ['get-profile'] })
				})
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(`Ошибка входа: ${error.response?.data?.message}`)
				}
			}
		})

	useEffect(() => {
		setIsPhoneCodeRequested(false)
		setValue('code', '')
		phoneMask.reset()
	}, [authMethod, isLogin, phoneMask.reset, setValue])

	const onSubmit: SubmitHandler<IFormData> = async (data) => {
		let token: string | null = null
		const recaptchaAction =
			authMethod === 'phone'
				? isLogin
					? 'phone_login'
					: isPhoneCodeRequested
						? 'phone_register'
						: 'phone_send_code'
				: isLogin
					? 'login'
					: 'register'

		try {
			token = await executeRecaptcha(recaptchaAction)
		} catch {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (!token) {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (authMethod === 'phone') {
			if (isLogin) {
				mutatePhoneLogin({ data, token })
				return
			}

			if (!isPhoneCodeRequested) {
				mutatePhoneSendCode({
					phone: data.phone || '',
					token
				})
				return
			}

			if (!data.code || !validPhoneCode.test(data.code)) {
				toast.error('Введите корректный код из SMS')
				return
			}

			mutatePhoneRegister({ data, token })
			return
		}

		if (isLogin) {
			mutateLogin({ data, token })
			return
		}

		mutateRegister({ data, token })
	}

	const isLoading =
		isPending ||
		isLoginPending ||
		isRegisterPending ||
		isPhoneSendCodePending ||
		isPhoneRegisterPending ||
		isPhoneLoginPending

	return {
		register,
		handleSubmit,
		onSubmit,
		isLoading,
		formState,
		authMethod,
		setAuthMethod,
		isPhoneCodeRequested,
		phoneValue,
		phoneInputRef,
		phoneMask,
		resetPhoneCodeStep: () => {
			setIsPhoneCodeRequested(false)
			setValue('code', '')
		}
	}
}

export default useAuthForm
