'use client'
import CookieConsentProvider from '@/providers/cookie-consent-provider/CookieConsentProvider'
import { IMainProvider } from '@/providers/main-provider/main-provider.interface'
import { NavigationProvider } from '@/providers/navigation-provider/NavigationProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextPage } from 'next'
import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'

const ReactQueryDevtools = dynamic(
	() =>
		import('@tanstack/react-query-devtools').then(
			(module) => module.ReactQueryDevtools
		),
	{ ssr: false }
)

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
			<CookieConsentProvider />
			<NavigationProvider>{children}</NavigationProvider>
			{process.env.NODE_ENV === 'development' && (
				<ReactQueryDevtools initialIsOpen={false} />
			)}
		</QueryClientProvider>
	)
}

export default MainProvider
