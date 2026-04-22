'use client'

import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useAuthStore } from '@/store/auth-store/auth-store'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface HomeStartTrialLinkProps {
	className: string
	children: ReactNode
}

const HomeStartTrialLink = ({
	className,
	children
}: HomeStartTrialLinkProps) => {
	const auth = useAuthStore(state => state.auth)
	const href = auth ? PUBLIC_PAGES.CABINET : PUBLIC_PAGES.REGISTER

	return (
		<Link href={href} className={className}>
			{children}
		</Link>
	)
}

export default HomeStartTrialLink
