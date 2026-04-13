import { UserRole } from '@/services/auth/auth.types'
import { getServerAuth } from '@/utils/server/get-server-auth'
import { NextRequest, NextResponse } from 'next/server'

export const managerMiddleware = async (request: NextRequest) => {
	const user = await getServerAuth()

	if (
		user?.isLoggedIn &&
		user?.isManager &&
		user?.rights?.includes(UserRole.MANAGER)
	) {
		return NextResponse.next()
	}

	if (
		user?.isLoggedIn &&
		!user?.isManager &&
		!user?.rights?.includes(UserRole.MANAGER)
	) {
		return NextResponse.redirect(new URL('/profile', request.url))
	}

	return NextResponse.redirect(new URL('/logout', request.url))
}
