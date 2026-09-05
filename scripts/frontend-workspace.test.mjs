import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = file => readFileSync(new URL(file, root), 'utf8')
const json = file => JSON.parse(read(file))
const apps = ['landing', 'widgets', 'admin-panel', 'crm']

test('four applications own their routes and keep separate runtime versions', () => {
	assert.equal(json('package.json').private, true)
	assert.ok(!existsSync(new URL('src/app', root)))
	for (const app of apps) {
		const manifest = json(`apps/${app}/package.json`)
		assert.ok(existsSync(new URL(`apps/${app}/src/app/layout.tsx`, root)))
		assert.ok(!existsSync(new URL(`apps/${app}/pnpm-lock.yaml`, root)))
		assert.ok(!manifest.scripts.prepare)
		assert.equal(
			manifest.dependencies.next,
			app === 'crm' ? '16.3.3' : '^14.2.23'
		)
		assert.equal(
			manifest.dependencies.react,
			app === 'crm' ? '19.2.8' : '^18.3.1'
		)
	}
})

test('each installed Next version accepts its own standalone config', async () => {
	for (const app of apps) {
		const require = createRequire(
			new URL(`apps/${app}/package.json`, root)
		)
		const { configSchema } = require('next/dist/server/config-schema')
		const { default: config } = await import(
			new URL(`apps/${app}/next.config.mjs`, root)
		)
		const parsed = configSchema.safeParse(config)
		assert.equal(
			parsed.success,
			true,
			JSON.stringify(parsed.error?.issues)
		)
		assert.equal(config.output, 'standalone')
		if (app === 'crm') {
			assert.ok(config.outputFileTracingRoot)
			assert.ok(!config.assetPrefix)
		} else {
			assert.ok(config.experimental.outputFileTracingRoot)
			assert.equal(config.env.NEXT_PUBLIC_FRONTEND_APP, app)
			assert.equal(config.assetPrefix, `/_frontends/${app}`)
			assert.equal(config.images.path, `/_frontends/${app}/_next/image`)
			assert.deepEqual((await config.rewrites()).beforeFiles, [
				{
					source: `/_frontends/${app}/_next/:path+`,
					destination: '/_next/:path+'
				}
			])
		}
	}
})

test('CRM type aliases cannot replace the browser React implementation', () => {
	const paths = json('apps/crm/tsconfig.json').compilerOptions.paths
	for (const specifier of [
		'react',
		'react/*',
		'react-dom',
		'react-dom/*'
	]) {
		assert.equal(paths[specifier].length, 1)
		assert.match(
			paths[specifier][0],
			/^\.\/node_modules\/@types\/react(?:-dom)?\/(?:index|\*)\.d\.ts$/
		)
	}
})

test('root pre-commit dispatches CRM lint to its own ESLint version', () => {
	const staged = json('apps/crm/package.json')['lint-staged']
	assert.equal(
		staged['*.{ts,tsx}'],
		'pnpm --filter wincrm-client exec eslint --fix --max-warnings=0'
	)
	assert.equal(
		json('package.json')['lint-staged']['*.{ts,tsx}'],
		'eslint --fix --max-warnings=0'
	)
})

test('editable technical SEO is requested at runtime, not frozen from offline-build fallbacks', () => {
	for (const file of ['robots.ts', 'sitemap.ts']) {
		const source = read(`apps/landing/src/app/${file}`)
		assert.match(source, /export const dynamic = 'force-dynamic'/)
		assert.match(source, /await getHomePageContent\(\)/)
	}
})

test('shared package has no route runtime and cannot import application source', () => {
	assert.ok(!json('packages/winwidget-web/package.json').scripts.start)
	const walk = directory => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = new URL(
				entry.name + (entry.isDirectory() ? '/' : ''),
				directory
			)
			if (entry.isDirectory()) walk(file)
			else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
				assert.ok(
					![
						'route.ts',
						'page.tsx',
						'layout.tsx',
						'middleware.ts'
					].includes(entry.name),
					file.pathname
				)
				assert.doesNotMatch(
					readFileSync(file, 'utf8'),
					/(?:from\s*|import\s*\()['"][^'"]*\bapps\//,
					file.pathname
				)
			}
		}
	}
	walk(new URL('packages/winwidget-web/src/', root))
})
