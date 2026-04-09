'use client'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import SocialAuth from '@/components/screens/(auth)/social-auth/SocialAuth'
import { Suspense } from 'react'

const SocialAuthPage = () => {
	return (
		<Suspense fallback={<CirclesLoader />}>
			<SocialAuth />
		</Suspense>
	)
}

export default SocialAuthPage
