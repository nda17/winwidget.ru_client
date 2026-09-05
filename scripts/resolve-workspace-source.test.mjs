import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWorkspaceSource } from './resolve-workspace-source.mjs'

test('canonical source paths resolve to their app or shared owner', () => {
	const cases = [
		[
			'src/screens/home/ui/Home.tsx',
			'apps/landing/src/screens/home/ui/Home.tsx'
		],
		[
			'src/screens/legal-documentation/index.ts',
			'apps/landing/src/screens/legal-documentation/index.ts'
		],
		[
			'src/screens/admin/ui/Admin.tsx',
			'apps/admin-panel/src/screens/admin/ui/Admin.tsx'
		],
		[
			'src/screens/auth/index.ts',
			'apps/widgets/src/screens/auth/index.ts'
		],
		[
			'src/screens/cabinet/index.ts',
			'apps/widgets/src/screens/cabinet/index.ts'
		],
		[
			'src/screens/payment/index.ts',
			'apps/widgets/src/screens/payment/index.ts'
		],
		[
			'src/screens/widget-leads/index.ts',
			'apps/widgets/src/screens/widget-leads/index.ts'
		],
		[
			'src/screens/widget-preview/index.ts',
			'apps/widgets/src/screens/widget-preview/index.ts'
		],
		[
			'src/screens/widget-settings/index.ts',
			'packages/winwidget-web/src/screens/widget-settings/index.ts'
		],
		[
			'src/entities/user/index.ts',
			'packages/winwidget-web/src/entities/user/index.ts'
		],
		[
			'src/features/auth/index.ts',
			'packages/winwidget-web/src/features/auth/index.ts'
		],
		[
			'src/shared/api/index.ts',
			'packages/winwidget-web/src/shared/api/index.ts'
		],
		['src/app/page.tsx', 'apps/landing/src/app/page.tsx'],
		[
			'src/app/legal-documentation/oferta/page.tsx',
			'apps/landing/src/app/legal-documentation/oferta/page.tsx'
		],
		[
			'src/app/admin/widgets/page.tsx',
			'apps/admin-panel/src/app/admin/widgets/page.tsx'
		],
		[
			'src/app/(auth)/login/page.tsx',
			'apps/widgets/src/app/(auth)/login/page.tsx'
		],
		[
			'src/app/page-wheel/[key]/page.tsx',
			'apps/widgets/src/app/page-wheel/[key]/page.tsx'
		],
		['src/middleware.ts', 'apps/widgets/src/middleware.ts'],
		[
			'src/app/middlewares/authMiddleware.ts',
			'packages/winwidget-web/src/app/middlewares/authMiddleware.ts'
		],
		[
			'src/app/not-found.tsx',
			'packages/winwidget-web/src/app/_ui/NotFoundPage.tsx'
		],
		['next.config.mjs', 'next.config.mjs']
	]

	for (const [canonicalPath, target] of cases) {
		assert.equal(
			resolveWorkspaceSource(canonicalPath).href,
			new URL(`../${target}`, import.meta.url).href
		)
	}
})

test('legacy deleted modules resolve without existence-based fallback', () => {
	for (const canonicalPath of [
		'src/screens/widget-leads/ui/OnlineConsultantLeads.tsx',
		'src/app/online-consultants/[id]/leads/page.tsx',
		'src/app/page-online-consultant/[key]/page.tsx'
	]) {
		assert.equal(
			resolveWorkspaceSource(canonicalPath).href,
			new URL(`../apps/widgets/${canonicalPath}`, import.meta.url).href
		)
	}
})

test('invalid paths cannot escape ownership resolution', () => {
	for (const invalid of [
		'../src/shared/api/index.ts',
		'src/../package.json',
		'/src/shared/api/index.ts',
		'src//shared/api/index.ts',
		'src/shared/api/index.ts?other',
		'src/shared/api/index.ts#other',
		'src/%2e%2e/package.json',
		'src/shared\\api/index.ts',
		'src/screens/unknown/index.ts',
		'package.json',
		null
	]) {
		assert.throws(() => resolveWorkspaceSource(invalid), TypeError)
	}
})
