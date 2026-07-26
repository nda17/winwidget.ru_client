import {
	copySetCookieHeaders,
	getAuthWithRefresh
} from '@/features/auth/server/refresh-middleware-token'
import { NextRequest, NextResponse } from 'next/server'

export const adminMiddleware = async (request: NextRequest) => {
	const next = NextResponse.next()
	const { user, response } = await getAuthWithRefresh(request, next)

	const isAdmin = user?.isLoggedIn && user?.isAdmin

	if (isAdmin) {
		return response ?? next
	}

	if (user?.isLoggedIn) {
		const redirect = NextResponse.redirect(
			new URL('/cabinet', request.url)
		)

		if (response) {
			copySetCookieHeaders(response, redirect)
		}

		return redirect
	}

	const redirect = NextResponse.redirect(new URL('/login', request.url))

	if (response) {
		copySetCookieHeaders(response, redirect)
	}

	return redirect
}
