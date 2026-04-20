import { getAuthWithRefresh } from '@/utils/server/refresh-middleware-token'
import { NextRequest, NextResponse } from 'next/server'

export const adminMiddleware = async (request: NextRequest) => {
	const next = NextResponse.next()
	const { user, response } = await getAuthWithRefresh(request, next)

	const isAdmin = user?.isLoggedIn && user?.isAdmin

	if (isAdmin) {
		return response ?? next
	}

	if (user?.isLoggedIn) {
		return NextResponse.redirect(new URL('/cabinet', request.url))
	}

	return NextResponse.redirect(new URL('/login', request.url))
}
