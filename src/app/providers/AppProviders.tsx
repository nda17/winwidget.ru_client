'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'

const AppProviders = ({ children }: PropsWithChildren) => {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnWindowFocus: false,
						retry: 1,
						staleTime: 30_000
					},
					mutations: {
						retry: false
					}
				}
			})
	)

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			<Toaster position="top-right" />
		</QueryClientProvider>
	)
}

export default AppProviders
