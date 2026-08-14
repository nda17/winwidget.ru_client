'use client'
import { authService } from '@/features/auth'
import { useAuthStore } from '@/entities/user'
import { clearBrowserSession } from '@/shared/api'
import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const AFFILIATE_REFERRER_STORAGE_KEY = 'affiliateReferrerId'
const SOCIAL_AUTH_TOAST_ID = 'social-auth'

const SocialAuthPage: NextPage = () => {
	const router = useRouter()
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)

	useEffect(() => {
		const toastId = toast.loading('Загрузка...', {
			id: SOCIAL_AUTH_TOAST_ID
		})

		authService
			.getNewTokens()
			.then(() => {
				window.localStorage.removeItem(AFFILIATE_REFERRER_STORAGE_KEY)
				setAuth(true)
				setAuthResolved(true)
				toast.dismiss(toastId)
				router.replace('/')
			})
			.catch(() => {
				clearBrowserSession({ redirectToLogin: false })
				toast.error('Ошибка авторизации через социальную сеть', {
					id: toastId
				})
				router.replace(PUBLIC_PAGES.LOGIN)
			})
	}, [router, setAuth, setAuthResolved])

	return null
}

export default SocialAuthPage
