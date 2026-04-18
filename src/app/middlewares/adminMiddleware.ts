import { UserRole } from '@/services/auth/auth.types'
import { getMiddlewareAuth } from '@/utils/server/get-middleware-auth'
import { NextRequest, NextResponse } from 'next/server'

export const adminMiddleware = async (request: NextRequest) => {
	const user = await getMiddlewareAuth(request)

	if (
		user?.isLoggedIn &&
		user?.isAdmin &&
		user?.rights?.includes(UserRole.ADMIN)
	) {
		return NextResponse.next()
	}

	if (
		user?.isLoggedIn &&
		!user?.isAdmin &&
		!user?.rights?.includes(UserRole.ADMIN)
	) {
		return NextResponse.redirect(new URL('/profile', request.url))
	}

	return NextResponse.redirect(new URL('/logout', request.url))
}
