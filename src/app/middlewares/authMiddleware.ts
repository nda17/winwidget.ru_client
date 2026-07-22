import { getAuthWithRefresh } from '@/features/auth/server/refresh-middleware-token'
import { NextRequest, NextResponse } from 'next/server'

export const authMiddleware = async (request: NextRequest) => {
	const next = NextResponse.next()
	const { user, response } = await getAuthWithRefresh(request, next)

	if (user?.isLoggedIn) {
		const redirect = NextResponse.redirect(new URL('/', request.url))

		response?.headers.getSetCookie().forEach(cookie => {
			redirect.headers.append('Set-Cookie', cookie)
		})

		return redirect
	}

	return next
}
