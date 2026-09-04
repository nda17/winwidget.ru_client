'use client'

import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { IntakeAccess } from './use-intake-access'

// Pending commands (including one-time source secrets) stay inside the mounted
// editor only, never React Query mutation cache, localStorage or telemetry.
export const useIntakeCommand = <T extends object, R>(
	access: IntakeAccess,
	permission: 'intake:write' | 'intake:manage-sources',
	send: (token: string, command: T) => Promise<R>,
	onSuccess: (result: R, command: T) => void
) => {
	const pending = useRef<T | null>(null)
	const immediateLock = useRef(false)
	const mounted = useRef(true)
	const [running, setRunning] = useState(false)
	const [uncertain, setUncertain] = useState(false)
	const [error, setError] = useState<AuthenticatedApiError | null>(null)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			pending.current = null
		}
	}, [])
	const run = async (build: () => T) => {
		if (immediateLock.current || !access.online) return
		if (
			!(permission === 'intake:write'
				? access.canWrite
				: access.canManageSources)
		)
			return
		immediateLock.current = true
		setRunning(true)
		setError(null)
		try {
			const token = await access.authorize(permission)
			if (!mounted.current) return
			const command = pending.current ?? Object.freeze(build())
			pending.current = command
			const result = await send(token, command)
			if (!mounted.current) return
			pending.current = null
			setUncertain(false)
			onSuccess(result, command)
		} catch (cause) {
			if (!mounted.current) return
			const failure =
				cause instanceof AuthenticatedApiError
					? cause
					: new AuthenticatedApiError(
							'temporary',
							'Не удалось подтвердить результат запроса. Повторите его безопасно.'
						)
			if (failure.kind !== 'temporary') pending.current = null
			setUncertain(pending.current !== null)
			setError(failure)
			toast.error(failure.message)
		} finally {
			immediateLock.current = false
			if (mounted.current) setRunning(false)
		}
	}
	const resetError = () => {
		if (!pending.current && !immediateLock.current) setError(null)
	}
	return {
		run,
		running,
		uncertain,
		locked: running || uncertain,
		error,
		resetError
	}
}
