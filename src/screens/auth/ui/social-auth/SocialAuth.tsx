'use client'
import { authService } from '@/features/auth'
import { useAuthStore } from '@/entities/user'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const AFFILIATE_REFERRER_STORAGE_KEY = 'affiliateReferrerId'

const SocialAuthPage: NextPage = () => {
	const router = useRouter()
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)

	useEffect(() => {
		const toastId = toast.loading('Загрузка...')

		authService
			.getNewTokens()
			.then(() => {
				window.localStorage.removeItem(AFFILIATE_REFERRER_STORAGE_KEY)
				setAuth(true)
				setAuthResolved(true)
			})
			.catch(() => {
				toast.error('Ошибка авторизации через социальную сеть')
			})
			.finally(() => {
				toast.dismiss(toastId)
				router.replace('/')
			})
	}, [router, setAuth, setAuthResolved])

	return null
}

export default SocialAuthPage
