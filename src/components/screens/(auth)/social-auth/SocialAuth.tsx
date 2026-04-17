'use client'
import { saveTokenStorage } from '@/services/auth/auth.helper'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { NextPage } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const SocialAuthPage: NextPage = () => {
	const searchParams = useSearchParams()
	const router = useRouter()
	const setAuth = useAuthStore(state => state.setAuth)
	const setAuthResolved = useAuthStore(state => state.setAuthResolved)

	useEffect(() => {
		const toastId = toast.loading('Загрузка...')
		const accessToken = searchParams.get('accessToken')
		if (accessToken) {
			saveTokenStorage(accessToken)
			setAuth(true)
			setAuthResolved(true)
		}
		toast.dismiss(toastId)
		router.replace('/')
	}, [router, searchParams, setAuth, setAuthResolved])

	return null
}

export default SocialAuthPage
