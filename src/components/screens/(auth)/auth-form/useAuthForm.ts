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
		mutationFn: ({ data, token }: { data: IFormData; token: string }) =>
			authService.main('login', data, token),
		onSuccess() {
			startTransition(() => {
				toast.success('Successful login')
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
				toast.error(`Unsuccessful login: ${error.response?.data?.message}`)
				recaptchaRef.current.reset()
			}
		}
	})

	const { mutate: mutateRegister, isPending: isRegisterPending } =
		useMutation({
			mutationKey: ['register'],
			mutationFn: ({ data, token }: { data: IFormData; token: string }) =>
				authService.main('register', data, token),
			onSuccess() {
				startTransition(() => {
					toast.success(
						'Successful register. A link to confirm your Email has been sent to your email.'
					)
					reset()
					router.replace('/profile')
				})
			},
			onError(error) {
				if (axios.isAxiosError(error)) {
					toast.error(
						`Unsuccessful register: ${error.response?.data?.message}`
					)

					recaptchaRef.current.reset()
				}
			}
		})

	const onSubmit: SubmitHandler<IFormData> = async (data) => {
		const captcha = recaptchaRef.current

		if (!captcha) {
			toast.error('Captcha is unavailable')
			return
		}

		const token = await captcha.executeAsync()

		if (!token) {
			toast.error('Captcha verification failed')
			captcha.reset()
			return
		}

		if (isLogin) {
			mutateLogin({ data, token }, {
				onSettled() {
					captcha.reset()
				}
			})
			return
		}

		mutateRegister(
			{ data, token },
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
		isLoading,
		formState
	}
}

export default useAuthForm
