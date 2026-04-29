import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { usePhoneMask } from '@/hooks/usePhoneMask'
import { useRecaptchaV3 } from '@/hooks/useRecaptchaV3'
import { useNavigationContext } from '@/providers/navigation-provider/NavigationProvider'
import authService, {
	IEmailRegistrationResponse
} from '@/services/auth/auth.service'
import { IFormData } from '@/shared/types/form.types'
import { validPhoneCode } from '@/shared/regex'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition
} from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const PENDING_EMAIL_REGISTRATION_STORAGE_KEY = 'pendingEmailRegistration'

type PendingEmailRegistrationState = {
	email: string
	expiresAt: string
	resendAvailableAt: string
}

const savePendingEmailRegistrationState = (
	payload: PendingEmailRegistrationState
) => {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.setItem(
		PENDING_EMAIL_REGISTRATION_STORAGE_KEY,
		JSON.stringify(payload)
	)
}

const getPendingEmailRegistrationState = () => {
	if (typeof window === 'undefined') {
		return null
	}

	const rawValue = window.localStorage.getItem(
		PENDING_EMAIL_REGISTRATION_STORAGE_KEY
	)

	if (!rawValue) {
		return null
	}

	try {
		return JSON.parse(rawValue) as PendingEmailRegistrationState
	} catch {
		window.localStorage.removeItem(PENDING_EMAIL_REGISTRATION_STORAGE_KEY)
		return null
	}
}

const clearPendingEmailRegistrationState = () => {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.removeItem(PENDING_EMAIL_REGISTRATION_STORAGE_KEY)
}

const useAuthForm = (isLogin: boolean) => {
	const { previousRoute } = useNavigationContext()
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)

	const whiteListRedirect = ['/']
	const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email')
	const [isPhoneCodeRequested, setIsPhoneCodeRequested] = useState(false)
	const [isEmailCodeRequested, setIsEmailCodeRequested] = useState(false)

	const { register, handleSubmit, reset, formState, watch, setValue } =
		useForm<IFormData>({
			mode: 'onChange'
		})
	const phoneInputRef = useRef<HTMLInputElement>(null)
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const queryClient = useQueryClient()
	const { executeRecaptcha, isRecaptchaEnabled } = useRecaptchaV3()
	const emailValue = watch('email')
	const phoneValue = watch('phone')
	const phoneMask = usePhoneMask(setValue, phoneInputRef)
	const resetPhoneMask = phoneMask.reset

	const clearEmailCodeStep = useCallback(() => {
		clearPendingEmailRegistrationState()
		setIsEmailCodeRequested(false)
		setValue('code', '')
	}, [setValue])

	const syncPendingEmailRegistrationState = (
		payload: IEmailRegistrationResponse
	) => {
		savePendingEmailRegistrationState(payload)
		setValue('email', payload.email)
		setValue('code', '')
		setIsEmailCodeRequested(true)
	}

	const handleEmailFlowError = (error: unknown, prefix: string) => {
		if (!axios.isAxiosError(error)) {
			return
		}

		const errorCode = error.response?.data?.code
		if (
			errorCode === 'email_code_not_found' ||
			errorCode === 'user_already_exists'
		) {
			clearEmailCodeStep()
		}

		toast.error(`${prefix}: ${error.response?.data?.message}`)
	}

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

	const {
		mutate: mutateEmailSendCode,
		isPending: isEmailSendCodePending
	} = useMutation({
		mutationKey: ['email-send-code'],
		mutationFn: ({
			data,
			token
		}: {
			data: IFormData
			token: string | null
		}) =>
			authService.sendEmailCode(
				{
					email: data.email || '',
					password: data.password
				},
				token
			),
		onSuccess({ data }) {
			syncPendingEmailRegistrationState(data)
			toast.success('Код подтверждения отправлен на email')
		},
		onError(error) {
			handleEmailFlowError(error, 'Ошибка отправки кода')
		}
	})

	const {
		mutate: mutateEmailRegister,
		isPending: isEmailRegisterPending
	} = useMutation({
		mutationKey: ['email-register'],
		mutationFn: ({
			data,
			token
		}: {
			data: IFormData
			token: string | null
		}) =>
			authService.registerByEmail(
				{
					email: data.email || '',
					code: data.code
				},
				token
			),
		onSuccess() {
			startTransition(() => {
				clearEmailCodeStep()
				setAuth(true)
				setAuthResolved(true)
				toast.success('Email подтвержден. Регистрация завершена')
				reset()
				router.replace('/cabinet')
				queryClient.invalidateQueries({ queryKey: ['get-profile'] })
			})
		},
		onError(error) {
			handleEmailFlowError(error, 'Ошибка подтверждения email')
		}
	})

	const {
		mutate: mutateEmailResendCode,
		isPending: isEmailResendCodePending
	} = useMutation({
		mutationKey: ['email-resend-code'],
		mutationFn: ({
			email,
			token
		}: {
			email: string
			token: string | null
		}) => authService.resendEmailCode({ email }, token),
		onSuccess({ data }) {
			syncPendingEmailRegistrationState(data)
			toast.success('Новый код подтверждения отправлен на email')
		},
		onError(error) {
			handleEmailFlowError(error, 'Ошибка повторной отправки')
		}
	})

	const {
		mutate: mutatePhoneSendCode,
		isPending: isPhoneSendCodePending
	} = useMutation({
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

	const {
		mutate: mutatePhoneRegister,
		isPending: isPhoneRegisterPending
	} = useMutation({
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
				router.replace('/cabinet')
			})
		},
		onError(error) {
			if (axios.isAxiosError(error)) {
				toast.error(`Ошибка регистрации: ${error.response?.data?.message}`)
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
		if (isLogin) {
			clearEmailCodeStep()
			setIsPhoneCodeRequested(false)
			setValue('code', '')
			resetPhoneMask()
			return
		}

		const pendingEmailRegistration = getPendingEmailRegistrationState()

		if (!pendingEmailRegistration) {
			return
		}

		if (
			new Date(pendingEmailRegistration.expiresAt).getTime() < Date.now()
		) {
			clearPendingEmailRegistrationState()
			return
		}

		setValue('email', pendingEmailRegistration.email)
		setValue('code', '')
		setIsEmailCodeRequested(true)
	}, [clearEmailCodeStep, isLogin, resetPhoneMask, setValue])

	useEffect(() => {
		if (authMethod === 'phone') {
			clearEmailCodeStep()
			setValue('code', '')
			return
		}

		setIsPhoneCodeRequested(false)
		setValue('code', '')
		resetPhoneMask()
	}, [authMethod, clearEmailCodeStep, resetPhoneMask, setValue])

	const onSubmit: SubmitHandler<IFormData> = async data => {
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
					: isEmailCodeRequested
						? 'email_register'
						: 'register'

		try {
			token = await executeRecaptcha(recaptchaAction)
		} catch {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (isRecaptchaEnabled && !token) {
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

		if (!isEmailCodeRequested) {
			mutateEmailSendCode({ data, token })
			return
		}

		if (!data.code || !validPhoneCode.test(data.code)) {
			toast.error('Введите корректный код из email')
			return
		}

		mutateEmailRegister({ data, token })
	}

	const resendEmailCode = async () => {
		const email = emailValue?.trim()

		if (!email) {
			toast.error('Введите email')
			return
		}

		let token: string | null = null

		try {
			token = await executeRecaptcha('email_resend_code')
		} catch {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (isRecaptchaEnabled && !token) {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		mutateEmailResendCode({ email, token })
	}

	const isLoading =
		isPending ||
		isLoginPending ||
		isEmailSendCodePending ||
		isEmailRegisterPending ||
		isEmailResendCodePending ||
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
		isEmailCodeRequested,
		emailValue,
		phoneValue,
		phoneInputRef,
		phoneMask,
		resendEmailCode,
		resetEmailCodeStep: () => {
			clearEmailCodeStep()
		},
		resetPhoneCodeStep: () => {
			setIsPhoneCodeRequested(false)
			setValue('code', '')
		}
	}
}

export default useAuthForm
