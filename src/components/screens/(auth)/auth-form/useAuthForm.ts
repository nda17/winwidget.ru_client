import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useNavigationContext } from '@/providers/navigation-provider/NavigationProvider'
import authService from '@/services/auth/auth.service'
import { IFormData } from '@/shared/types/form.types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useRef, useTransition } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const SIMULATE_CAPTCHA_FAILURE =
	process.env.NEXT_PUBLIC_SIMULATE_CAPTCHA_FAILURE === 'true'
const DISABLE_RECAPTCHA =
	process.env.NEXT_PUBLIC_DISABLE_RECAPTCHA === 'true'

const useAuthForm = (isLogin: boolean) => {
	const { previousRoute } = useNavigationContext()

	const whiteListRedirect = ['/?', '/free-content?', '/premium-content?']

	const { register, handleSubmit, reset, formState } = useForm<IFormData>({
		mode: 'onChange'
	})
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const queryClient = useQueryClient()
	const recaptchaRef = useRef<ReCAPTCHA>(null)

	const { mutate: mutateLogin, isPending: isLoginPending } = useMutation({
		mutationKey: ['login'],
		mutationFn: ({
			data,
			token
		}: {
			data: IFormData
			token: string | null
		}) =>
			authService.main('login', data, token),
		onSuccess() {
			startTransition(() => {
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
				recaptchaRef.current.reset()
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
			}) =>
				authService.main('register', data, token),
			onSuccess() {
				startTransition(() => {
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

					recaptchaRef.current.reset()
				}
			}
		})

	const onSubmit: SubmitHandler<IFormData> = async (data) => {
		if (DISABLE_RECAPTCHA) {
			const token = SIMULATE_CAPTCHA_FAILURE ? 'invalid-token' : null

			if (isLogin) {
				mutateLogin({ data, token })
				return
			}

			mutateRegister({ data, token })
			return
		}

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

		if (isLogin) {
			mutateLogin({ data, token: requestToken }, {
				onSettled() {
					captcha.reset()
				}
			})
			return
		}

		mutateRegister(
			{ data, token: requestToken },
			{
				onSettled() {
					captcha.reset()
				}
			}
		)
	}

	const isLoading = isPending || isLoginPending || isRegisterPending

	return {
		register,
		handleSubmit,
		onSubmit,
		recaptchaRef,
		isRecaptchaDisabled: DISABLE_RECAPTCHA,
		isLoading,
		formState
	}
}

export default useAuthForm
