import { getPublicHttpClient } from '@/shared/api/http-client'
import axios from 'axios'

const ACCESS_TOKEN_PATTERN = /^[^\s,]{1,16384}$/

export type AuthenticatedApiErrorKind =
	| 'unauthorized'
	| 'conflict'
	| 'temporary'

export class AuthenticatedApiError extends Error {
	constructor(
		readonly kind: AuthenticatedApiErrorKind,
		message: string
	) {
		super(message)
		this.name = 'AuthenticatedApiError'
	}
}

interface AuthenticatedRequest {
	accessToken: string
	method: 'GET' | 'POST'
	url: string
	params?: Record<string, string>
	data?: unknown
	headers?: Record<string, string>
}

export const authenticatedRequest = async ({
	accessToken,
	method,
	url,
	params,
	data,
	headers
}: AuthenticatedRequest): Promise<unknown> => {
	if (!ACCESS_TOKEN_PATTERN.test(accessToken)) {
		throw new AuthenticatedApiError(
			'temporary',
			'Не удалось подготовить безопасный запрос.'
		)
	}

	try {
		const response = await getPublicHttpClient().request<unknown>({
			method,
			url,
			params,
			data,
			headers: {
				...headers,
				Authorization: `Bearer ${accessToken}`
			}
		})

		return response.data
	} catch (error) {
		if (error instanceof AuthenticatedApiError) {
			throw error
		}

		if (axios.isAxiosError(error) && error.response?.status === 401) {
			throw new AuthenticatedApiError(
				'unauthorized',
				'Сессия больше не действует.'
			)
		}

		if (axios.isAxiosError(error) && error.response?.status === 409) {
			throw new AuthenticatedApiError(
				'conflict',
				'Команда конфликтует с ранее обработанным запросом.'
			)
		}

		throw new AuthenticatedApiError(
			'temporary',
			'Сервис WinCRM временно недоступен. Повторите попытку.'
		)
	}
}

export const invalidContractError = () =>
	new AuthenticatedApiError(
		'temporary',
		'Сервис WinCRM вернул некорректный ответ.'
	)
