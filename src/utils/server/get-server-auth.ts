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
	let accessToken = cookies().get(EnumTokens.ACCESS_TOKEN)?.value
	const refreshToken = cookies().get(EnumTokens.REFRESH_TOKEN)?.value

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
		return await verifyAccessToken(accessToken, jwtSecret)
	} catch (error) {
		return null
	}
}
