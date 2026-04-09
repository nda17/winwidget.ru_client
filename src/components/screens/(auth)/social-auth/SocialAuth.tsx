'use client'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import { saveTokenStorage } from '@/services/auth/auth.helper'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { NextPage } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const SocialAuthPage: NextPage = () => {
	const searchParams = useSearchParams()
	const router = useRouter()
	const setAuth = useAuthStore((state) => state.setAuth)
	const setAuthResolved = useAuthStore((state) => state.setAuthResolved)

	useEffect(() => {
		const accessToken = searchParams.get('accessToken')
		if (accessToken) {
			saveTokenStorage(accessToken)
			setAuth(true)
			setAuthResolved(true)
		}

		router.replace('/')
	}, [router, searchParams, setAuth, setAuthResolved])

	return <CirclesLoader />
}

export default SocialAuthPage
