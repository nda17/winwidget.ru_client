import { ITokenInside } from '@/services/auth/auth.types'
import {
	TUserDataState,
	transformUserToState
} from '@/utils/transform-user-to-state'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const ACCESS_TOKEN_COOKIE = 'accessToken'
const REFRESH_TOKEN_COOKIE = 'refreshToken'

const getApiUrl = () => {
	const apiHost =
		process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST

	return (
		process.env.NEXT_PUBLIC_API_URL ||
		(apiHost ? `${apiHost}/api` : 'http://localhost:4200/api')
	)
}

interface IRefreshResult {
	user: TUserDataState | null
	response: NextResponse | null
}

export const getAuthWithRefresh = async (
	request: NextRequest,
	baseResponse: NextResponse
): Promise<IRefreshResult> => {
	const jwtSecret = process.env.JWT_SECRET
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
	const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value

	if (jwtSecret && accessToken) {
		try {
			const { payload }: { payload: ITokenInside } = await jwtVerify(
				accessToken,
				new TextEncoder().encode(jwtSecret)
			)
			if (payload) {
				return { user: transformUserToState(payload), response: null }
			}
		} catch {
			// access token invalid/expired — try refresh below
		}
	}

	if (!refreshToken) {
		return { user: null, response: null }
	}

	try {
		const res = await fetch(`${getApiUrl()}/auth/access-token`, {
			method: 'POST',
			headers: { Cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` },
			cache: 'no-store'
		})

		if (!res.ok) {
			return { user: null, response: null }
		}

		const data = await res.json()
		const newAccessToken: string | undefined = data?.accessToken

		if (!newAccessToken || !jwtSecret) {
			return { user: null, response: null }
		}

		const { payload }: { payload: ITokenInside } = await jwtVerify(
			newAccessToken,
			new TextEncoder().encode(jwtSecret)
		)

		if (!payload) {
			return { user: null, response: null }
		}

		baseResponse.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
			httpOnly: false,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60,
			path: '/'
		})

		// Проброс Set-Cookie от бэка (новый refresh при ротации)
		res.headers.getSetCookie?.().forEach(cookie => {
			if (cookie.startsWith(REFRESH_TOKEN_COOKIE + '=')) {
				baseResponse.headers.append('Set-Cookie', cookie)
			}
		})

		return { user: transformUserToState(payload), response: baseResponse }
	} catch {
		return { user: null, response: null }
	}
}
