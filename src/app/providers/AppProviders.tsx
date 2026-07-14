'use client'
import { SessionProvider } from '@/features/auth'
import { CookieConsentProvider } from '@/features/cookie-consent'
import { NetworkStatusProvider } from '@/features/network-status'
import { NavigationProvider } from '@/shared/lib/navigation/NavigationProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
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

type AppProvidersProps = PropsWithChildren<{
	hasSessionHint: boolean
}>

const AppProviders = ({ children, hasSessionHint }: AppProvidersProps) => {
	return (
		<QueryClientProvider client={queryClient}>
			<Toaster />
			<NetworkStatusProvider />
			<AffiliateReferralTracker />
			<CookieConsentProvider />
			<SessionProvider hasSessionHint={hasSessionHint}>
				<NavigationProvider>{children}</NavigationProvider>
			</SessionProvider>
		</QueryClientProvider>
	)
}

export default AppProviders

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
