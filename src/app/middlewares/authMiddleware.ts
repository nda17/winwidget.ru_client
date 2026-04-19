import { getAuthWithRefresh } from '@/utils/server/refresh-middleware-token'
import { NextRequest, NextResponse } from 'next/server'

export const authMiddleware = async (request: NextRequest) => {
	const next = NextResponse.next()
	const { user } = await getAuthWithRefresh(request, next)

	if (user?.isLoggedIn) {
		return NextResponse.redirect(new URL('/', request.url))
	}

	return next
}
