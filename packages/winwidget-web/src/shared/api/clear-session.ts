import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import { removeFromStorage } from './token-storage'

export const SESSION_CLEARED_EVENT = 'winwidget:session-cleared'

interface ClearBrowserSessionOptions {
	redirectToLogin?: boolean
}

export const clearBrowserSession = ({
	redirectToLogin = true
}: ClearBrowserSessionOptions = {}) => {
	removeFromStorage()

	if (typeof window === 'undefined') {
		return
	}

	window.dispatchEvent(new Event(SESSION_CLEARED_EVENT))

	if (redirectToLogin && window.location.pathname !== PUBLIC_PAGES.LOGIN) {
		window.location.replace(PUBLIC_PAGES.LOGIN)
	}
}
