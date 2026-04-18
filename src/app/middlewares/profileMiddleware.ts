import { getMiddlewareAuth } from '@/utils/server/get-middleware-auth'
import { NextRequest, NextResponse } from 'next/server'

export const profileMiddleware = async (request: NextRequest) => {
	const user = await getMiddlewareAuth(request)

	if (!user?.isLoggedIn) {
		return NextResponse.redirect(new URL('/login', request.url))
	}

	return NextResponse.next()
}
