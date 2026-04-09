import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useRecaptchaV3 } from '@/hooks/useRecaptchaV3'
import { useNavigationContext } from '@/providers/navigation-provider/NavigationProvider'
import authService from '@/services/auth/auth.service'
import { IFormData } from '@/shared/types/form.types'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const useAuthForm = (isLogin: boolean) => {
	const { previousRoute } = useNavigationContext()
	const setAuth = useAuthStore((state) => state.setAuth)
	const setAuthResolved = useAuthStore((state) => state.setAuthResolved)

	const whiteListRedirect = ['/?', '/free-content?', '/premium-content?']

	const { register, handleSubmit, reset, formState } = useForm<IFormData>({
		mode: 'onChange'
	})
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const queryClient = useQueryClient()
	const { executeRecaptcha, isRecaptchaReady } = useRecaptchaV3()

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

	const onSubmit: SubmitHandler<IFormData> = async (data) => {
		if (!isRecaptchaReady) {
			toast.error('Капча недоступна')
			return
		}

		let token: string | null = null

		try {
			token = await executeRecaptcha(isLogin ? 'login' : 'register')
		} catch {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (!token) {
			toast.error('Не удалось пройти проверку капчи')
			return
		}

		if (isLogin) {
			mutateLogin({ data, token })
			return
		}

		mutateRegister({ data, token })
	}

	const isLoading = isPending || isLoginPending || isRegisterPending

	return {
		register,
		handleSubmit,
		onSubmit,
		isLoading,
		formState
	}
}

export default useAuthForm
