import { adminMiddleware } from '@/app/middlewares/adminMiddleware'
import { authMiddleware } from '@/app/middlewares/authMiddleware'
import { managerMiddleware } from '@/app/middlewares/managerMiddleware'
import { profileMiddleware } from '@/app/middlewares/profileMiddleware'
import { NextRequest, NextResponse } from 'next/server'

export const config = {
	matcher: [
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)).*)'
	]
}

export const middleware = (request: NextRequest) => {
	const { pathname } = request.nextUrl

	switch (true) {
		case /^\/(register|login|restore-password)$/.test(pathname):
			return authMiddleware(request)

		case /^\/profile/.test(pathname):
			return profileMiddleware(request)

		case /^\/admin(\/.*)?$/.test(pathname):
			return adminMiddleware(request)

		case /^\/manager(\/.*)?$/.test(pathname):
			return managerMiddleware(request)
	}

	return NextResponse.next()
}
