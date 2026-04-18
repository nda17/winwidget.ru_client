import { ITokenInside } from '@/services/auth/auth.types'
import {
	transformUserToState,
	TUserDataState
} from '@/utils/transform-user-to-state'
import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const ACCESS_TOKEN_COOKIE = 'accessToken'

export const getMiddlewareAuth = async (
	request: NextRequest
): Promise<TUserDataState | null> => {
	const jwtSecret = process.env.JWT_SECRET
	const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value

	if (!jwtSecret || !accessToken) {
		return null
	}

	try {
		const { payload }: { payload: ITokenInside } = await jwtVerify(
			accessToken,
			new TextEncoder().encode(jwtSecret)
		)

		return payload ? transformUserToState(payload) : null
	} catch (error) {
		return null
	}
}
