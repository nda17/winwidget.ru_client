import { authMiddleware } from '@/app/middlewares/authMiddleware'
import { profileMiddleware } from '@/app/middlewares/profileMiddleware'
import { NextRequest, NextResponse } from 'next/server'

const WIDGET_PREVIEW_PATH =
	/^\/page-(wheel|quiz|callback|timer|stop-offer|ai-consultant|calculator)\//

export const config = {
	matcher: [
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|otf)).*)'
	]
}

export const middleware = (request: NextRequest) => {
	const { pathname } = request.nextUrl

	if (WIDGET_PREVIEW_PATH.test(pathname)) {
		const requestHeaders = new Headers(request.headers)
		requestHeaders.set('x-winwidget-widget-preview', '1')

		return NextResponse.next({
			request: {
				headers: requestHeaders
			}
		})
	}

	switch (true) {
		case /^\/(register|login|restore-password)$/.test(pathname):
			return authMiddleware(request)

		case /^\/cabinet(\/.*)?$/.test(pathname):
			return profileMiddleware(request)
	}

	return NextResponse.next()
}
