import { EnumTokens } from '@/services/auth/auth.service'
import Cookies from 'js-cookie'

const accessTokenCookieOptions = {
	sameSite: 'strict' as const,
	expires: 1,
	path: '/'
}

export const getAccessToken = () => {
	const accessToken = Cookies.get(EnumTokens.ACCESS_TOKEN)
	return accessToken || null
}

export const getRefreshToken = () => {
	const refreshToken = Cookies.get(EnumTokens.REFRESH_TOKEN)
	return refreshToken || null
}

export const saveTokenStorage = (accessToken: string) => {
	Cookies.set(
		EnumTokens.ACCESS_TOKEN,
		accessToken,
		accessTokenCookieOptions
	)
}

export const removeFromStorage = () => {
	Cookies.remove(EnumTokens.ACCESS_TOKEN, {
		path: accessTokenCookieOptions.path
	})
}
