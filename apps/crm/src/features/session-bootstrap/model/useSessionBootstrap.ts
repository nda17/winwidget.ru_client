'use client'

import {
	type AuthenticatedSession,
	useSessionStore
} from '@/entities/session'
import {
	refreshSession,
	SessionBootstrapError
} from '@/features/session-bootstrap/api/refresh-session'
import { useCallback, useEffect } from 'react'

let pendingBootstrap: Promise<AuthenticatedSession> | null = null

const bootstrapSessionOnce = () => {
	if (!pendingBootstrap) {
		pendingBootstrap = refreshSession().then(
			session => {
				pendingBootstrap = null
				return session
			},
			error => {
				pendingBootstrap = null
				throw error
			}
		)
	}

	return pendingBootstrap
}

export const useSessionBootstrap = () => {
	const status = useSessionStore(state => state.status)
	const errorMessage = useSessionStore(state => state.errorMessage)
	const setChecking = useSessionStore(state => state.setChecking)
	const setAuthenticated = useSessionStore(state => state.setAuthenticated)
	const setAnonymous = useSessionStore(state => state.setAnonymous)
	const setError = useSessionStore(state => state.setError)

	useEffect(() => {
		if (status !== 'checking') {
			return
		}

		let isActive = true

		void bootstrapSessionOnce().then(
			session => {
				if (isActive) {
					setAuthenticated(session)
				}
			},
			error => {
				if (!isActive) {
					return
				}

				if (
					error instanceof SessionBootstrapError &&
					error.kind === 'anonymous'
				) {
					setAnonymous()
					return
				}

				setError(
					error instanceof SessionBootstrapError
						? error.message
						: 'Не удалось проверить сессию. Повторите попытку.'
				)
			}
		)

		return () => {
			isActive = false
		}
	}, [status, setAnonymous, setAuthenticated, setError])

	const retry = useCallback(() => {
		setChecking()
	}, [setChecking])
	const fail = useCallback(
		(message: string) => {
			setError(message)
		},
		[setError]
	)

	return { status, errorMessage, retry, fail }
}
