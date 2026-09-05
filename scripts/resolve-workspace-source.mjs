const repositoryUrl = new URL('../', import.meta.url)

const screenOwners = Object.freeze({
	home: 'landing',
	'legal-documentation': 'landing',
	admin: 'admin-panel',
	auth: 'widgets',
	cabinet: 'widgets',
	payment: 'widgets',
	'widget-leads': 'widgets',
	'widget-preview': 'widgets',
	'widget-settings': null
})

const sharedAppDirectories = new Set([
	'_ui',
	'config',
	'providers',
	'middlewares',
	'fonts',
	'styles'
])

const landingAppEntries = new Set([
	'page.tsx',
	'layout.tsx',
	'legal-documentation',
	'robots.ts',
	'sitemap.ts',
	'manifest.ts',
	'favicon.ico',
	'icon.svg',
	'apple-icon.png'
])

// Resolve ownership, not file existence: deleted-file assertions must still
// inspect the owning app instead of silently falling back to another tree.
export const resolveWorkspaceSource = canonicalPath => {
	if (
		typeof canonicalPath !== 'string' ||
		/[\\\u0000-\u001f\u007f?#%]/.test(canonicalPath) ||
		canonicalPath
			.split('/')
			.some(part => !part || part === '.' || part === '..')
	) {
		throw new TypeError('Expected a canonical repository source path')
	}

	if (canonicalPath === 'next.config.mjs') {
		return new URL(canonicalPath, repositoryUrl)
	}
	if (!canonicalPath.startsWith('src/')) {
		throw new TypeError('Unsupported repository source path')
	}

	const relativePath = canonicalPath.slice('src/'.length)
	if (relativePath === 'middleware.ts') {
		return new URL('apps/widgets/src/middleware.ts', repositoryUrl)
	}
	if (relativePath === 'app/not-found.tsx') {
		return new URL(
			'packages/winwidget-web/src/app/_ui/NotFoundPage.tsx',
			repositoryUrl
		)
	}

	let owner = null
	if (relativePath.startsWith('screens/')) {
		const screen = relativePath.split('/')[1]
		if (!Object.hasOwn(screenOwners, screen)) {
			throw new TypeError('Unknown screen owner')
		}
		owner = screenOwners[screen]
	} else if (relativePath.startsWith('app/')) {
		const entry = relativePath.split('/')[1]
		if (!sharedAppDirectories.has(entry)) {
			owner =
				entry === 'admin'
					? 'admin-panel'
					: landingAppEntries.has(entry)
						? 'landing'
						: 'widgets'
		}
	}

	return new URL(
		owner
			? `apps/${owner}/src/${relativePath}`
			: `packages/winwidget-web/src/${relativePath}`,
		repositoryUrl
	)
}
