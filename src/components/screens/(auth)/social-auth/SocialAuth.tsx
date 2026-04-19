'use client'
import authService from '@/services/auth/auth.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const SocialAuthPage: NextPage = () => {
	const router = useRouter()
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)

	useEffect(() => {
		const toastId = toast.loading('Загрузка...')

		authService
			.getNewTokens()
			.then(() => {
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
