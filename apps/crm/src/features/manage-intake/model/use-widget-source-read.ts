'use client'

import { useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { useQuery } from '@tanstack/react-query'
import { useLayoutEffect, useRef } from 'react'
import type { IntakeAccess } from './use-intake-access'

export const useWidgetSourceRead = <T>(
	access: IntakeAccess,
	key: readonly (string | number)[],
	read: (token: string) => Promise<T>,
	writeRequired = false
) => {
	const current = useRef(access)
	const mounted = useRef(true)
	useLayoutEffect(() => {
		current.current = access
	}, [access])
	useLayoutEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const allowed = (value: IntakeAccess) =>
		value.confirmed &&
		value.sourceManager &&
		!!value.session &&
		(!writeRequired || value.canManageSources)
	const assertScope = () => {
		const state = useSessionStore.getState()
		const latest = current.current
		if (
			!mounted.current ||
			!allowed(latest) ||
			state.session?.userId !== access.session?.userId ||
			state.sessionRevision !== access.revision ||
			latest.workspaceId !== access.workspaceId ||
			latest.revision !== access.revision ||
			latest.scopeKey !== access.scopeKey
		)
			throw new AuthenticatedApiError(
				'forbidden',
				'Доступ к подключению сейчас не подтверждён.'
			)
	}
	return useQuery({
		queryKey: [
			'crm-widget-sources',
			access.workspaceId,
			access.session?.userId,
			access.revision,
			access.scopeKey,
			...key
		],
		enabled: allowed(access) && access.online,
		queryFn: async () => {
			assertScope()
			const result = await read(access.session!.accessToken)
			assertScope()
			return result
		},
		retry: false,
		gcTime: 0,
		staleTime: 0,
		refetchOnWindowFocus: false
	})
}
