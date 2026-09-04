'use client'

import {
	mutateSales,
	type SalesCommand,
	type SalesDeal,
	type SalesMutation
} from '@/entities/sales'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { useSessionStore } from '@/entities/session'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'

export const useSalesCommand = (
	workspaceId: string,
	accessToken: string,
	enabled: boolean,
	onSuccess: (deal: SalesDeal) => void
) => {
	const sessionRevision = useSessionStore(state => state.sessionRevision)
	const inFlight = useRef(false)
	const saved = useRef<SalesCommand | null>(null)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState<AuthenticatedApiError | null>(null)
	const ambiguous = error?.kind === 'temporary'
	const blocked = !!error && error.kind !== 'validation' && !ambiguous

	const execute = async (mutation?: SalesMutation) => {
		if (!enabled || inFlight.current || blocked) return
		if (!saved.current) {
			if (!mutation) return
			saved.current = {
				workspaceId,
				commandId: crypto.randomUUID(),
				mutation: structuredClone(mutation)
			}
		}
		inFlight.current = true
		setPending(true)
		setError(null)
		let completed: SalesDeal | null = null
		try {
			const deal = await mutateSales(accessToken, saved.current)
			saved.current = null
			toast.success('Изменения сохранены')
			completed = deal
		} catch (cause) {
			const failure =
				cause instanceof AuthenticatedApiError
					? cause
					: new AuthenticatedApiError(
							'temporary',
							'Не удалось подтвердить сохранение. Повторите тот же запрос.'
						)
			if (failure.kind !== 'temporary') saved.current = null
			setError(failure)
			toast.error(failure.message)
			if (
				failure.kind === 'unauthorized' &&
				useSessionStore.getState().session?.accessToken === accessToken &&
				useSessionStore.getState().sessionRevision === sessionRevision
			)
				useSessionStore.getState().setAnonymous()
		} finally {
			inFlight.current = false
			setPending(false)
		}
		if (completed) onSuccess(completed)
	}
	const resetAfterReview = () => {
		if (inFlight.current || saved.current) return
		setError(null)
		toast('Данные обновлены. Проверьте форму перед сохранением.')
	}
	const canClose = () => {
		if (inFlight.current || saved.current) {
			toast('Сначала подтвердите результат сохранения повторным запросом.')
			return false
		}
		return true
	}
	return {
		execute,
		pending,
		error,
		ambiguous,
		blocked,
		canRetry: enabled && !pending && !blocked,
		locked: pending || ambiguous || blocked || !enabled,
		resetAfterReview,
		canClose
	}
}
