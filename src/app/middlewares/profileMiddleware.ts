import { getAuthWithRefresh } from '@/utils/server/refresh-middleware-token'
import { NextRequest, NextResponse } from 'next/server'

export const profileMiddleware = async (request: NextRequest) => {
	const next = NextResponse.next()
	const { user, response } = await getAuthWithRefresh(request, next)

	if (!user?.isLoggedIn) {
		return NextResponse.redirect(new URL('/login', request.url))
	}

	return response ?? next
}
