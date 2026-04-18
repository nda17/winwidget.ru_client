import { getMiddlewareAuth } from '@/utils/server/get-middleware-auth'
import { NextRequest, NextResponse } from 'next/server'

export const authMiddleware = async (request: NextRequest) => {
	const user = await getMiddlewareAuth(request)

	if (user && user?.isLoggedIn) {
		return NextResponse.redirect(new URL('/', request.url))
	}

	return NextResponse.next()
}
