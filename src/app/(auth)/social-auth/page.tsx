'use client'
import SocialAuth from '@/components/screens/(auth)/social-auth/SocialAuth'
import { Suspense } from 'react'

const SocialAuthPage = () => {
	return (
		<Suspense fallback={null}>
			<SocialAuth />
		</Suspense>
	)
}

export default SocialAuthPage
