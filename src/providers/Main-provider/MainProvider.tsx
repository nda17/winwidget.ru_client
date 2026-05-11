'use client'
import AuthProvider from '@/providers/auth-provider/AuthProvider'
import CookieConsentProvider from '@/providers/cookie-consent-provider/CookieConsentProvider'
import { IMainProvider } from '@/providers/Main-provider/main-provider.interface'
import { NavigationProvider } from '@/providers/navigation-provider/NavigationProvider'
import NetworkStatusProvider from '@/providers/network-status-provider/NetworkStatusProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextPage } from 'next'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'

const AFFILIATE_REFERRER_STORAGE_KEY = 'affiliateReferrerId'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false
		}
	}
})

const MainProvider: NextPage<IMainProvider> = ({
	children,
	hasSessionHint
}) => {
	return (
		<QueryClientProvider client={queryClient}>
			<Toaster />
			<NetworkStatusProvider />
			<AffiliateReferralTracker />
			<CookieConsentProvider />
			<AuthProvider hasSessionHint={hasSessionHint}>
				<NavigationProvider>{children}</NavigationProvider>
			</AuthProvider>
		</QueryClientProvider>
	)
}

export default MainProvider

const AffiliateReferralTracker = () => {
	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const referrerId = params.get('ref')?.trim()

		if (referrerId) {
			window.localStorage.setItem(
				AFFILIATE_REFERRER_STORAGE_KEY,
				referrerId
			)
		}
	}, [])

	return null
}
