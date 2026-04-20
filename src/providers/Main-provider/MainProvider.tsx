'use client'
import AuthProvider from '@/providers/auth-provider/AuthProvider'
import CookieConsentProvider from '@/providers/cookie-consent-provider/CookieConsentProvider'
import { IMainProvider } from '@/providers/Main-provider/main-provider.interface'
import { NavigationProvider } from '@/providers/navigation-provider/NavigationProvider'
import NetworkStatusProvider from '@/providers/network-status-provider/NetworkStatusProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextPage } from 'next'
import { Toaster } from 'react-hot-toast'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false
		}
	}
})

const MainProvider: NextPage<IMainProvider> = ({ children }) => {
	return (
		<QueryClientProvider client={queryClient}>
			<Toaster />
			<NetworkStatusProvider />
			<CookieConsentProvider />
			<AuthProvider>
				<NavigationProvider>{children}</NavigationProvider>
			</AuthProvider>
		</QueryClientProvider>
	)
}

export default MainProvider
