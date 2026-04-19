'use server'
import authService, { EnumTokens } from '@/services/auth/auth.service'
import { ITokenInside } from '@/services/auth/auth.types'
import {
	transformUserToState,
	TUserDataState
} from '@/utils/transform-user-to-state'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const verifyAccessToken = async (
	accessToken: string,
	jwtSecret: string
): Promise<TUserDataState | null> => {
	const { payload }: { payload: ITokenInside } = await jwtVerify(
		accessToken,
		new TextEncoder().encode(jwtSecret)
	)

	if (!payload) {
		return null
	}

	return transformUserToState(payload)
}

export const getServerAuth = async (): Promise<TUserDataState | null> => {
	const jwtSecret = process.env.JWT_SECRET
	const cookieStore = await cookies()
	let accessToken = cookieStore.get(EnumTokens.ACCESS_TOKEN)?.value
	const refreshToken = cookieStore.get(EnumTokens.REFRESH_TOKEN)?.value

	if (!jwtSecret) {
		return null
	}

	if (accessToken) {
		try {
			return await verifyAccessToken(accessToken, jwtSecret)
		} catch (error) {
			accessToken = null
		}
	}

	if (!refreshToken) {
		return null
	}

	try {
		const data = await authService.getNewTokensByRefresh(refreshToken)
		accessToken = data.accessToken
		const user = await verifyAccessToken(accessToken, jwtSecret)
		if (user) {
			;(await cookies()).set(EnumTokens.ACCESS_TOKEN, accessToken, {
				httpOnly: false,
				sameSite: 'strict',
				secure: process.env.NODE_ENV === 'production',
				maxAge: 60 * 60,
				path: '/'
			})
		}
		return user
	} catch (error) {
		return null
	}
}
