export type FrontendZone = 'landing' | 'widgets' | 'admin-panel'

const widgetsPath =
	/^\/(?:cabinet|payment|login|register|restore-password|social-auth|logout|wheels|quizzes|callbacks|timers|stop-offers|calculators|page-wheel|page-quiz|page-callback|page-timer|page-stop-offer|page-ai-consultant|page-calculator)(?:\/|$)/

export function zoneForPath(pathname: string): FrontendZone {
	if (/^\/admin(?:\/|$)/.test(pathname)) return 'admin-panel'
	return widgetsPath.test(pathname) ? 'widgets' : 'landing'
}

export function currentFrontendZone(): FrontendZone {
	const zone = process.env.NEXT_PUBLIC_FRONTEND_APP
	if (zone === 'widgets' || zone === 'admin-panel') return zone
	return 'landing'
}

export function needsDocumentNavigation(
	href: string,
	current = currentFrontendZone()
): boolean {
	if (href.startsWith('#') || href.startsWith('?')) return false
	// Absolute/external and relative URLs retain native browser URL resolution.
	if (!href.startsWith('/') || href.startsWith('//')) return true
	try {
		const url = new URL(href, 'https://winwidget.ru')
		// URL normalization can turn a leading slash/backslash into an
		// external authority. Never prefetch that destination through Next.
		if (url.origin !== 'https://winwidget.ru') return true
		return zoneForPath(url.pathname) !== current
	} catch {
		return true
	}
}
