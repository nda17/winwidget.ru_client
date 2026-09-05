import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const applications = ['landing', 'widgets', 'admin-panel', 'crm']
const routeFile = '%5F%5Ffrontend/health/route.ts'
const repository = fileURLToPath(new URL('../', import.meta.url))
const read = relative =>
	readFileSync(path.join(repository, relative), 'utf8')
const forbidden = () => {
	throw new Error(
		'Readiness must not access dependencies or unrelated environment'
	)
}

function compile(relative, env, modules = {}) {
	const result = ts.transpileModule(read(relative), {
		fileName: relative,
		reportDiagnostics: true,
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022
		}
	})
	assert.equal(result.diagnostics.length, 0)
	const loaded = { exports: {} }
	new Function(
		'exports',
		'module',
		'require',
		'process',
		'fetch',
		result.outputText
	)(
		loaded.exports,
		loaded,
		name => {
			assert.ok(
				Object.hasOwn(modules, name),
				'Unexpected readiness import'
			)
			return modules[name]
		},
		{ env },
		forbidden
	)
	return loaded.exports
}

function loadHealth(application, initial) {
	let revision = initial
	let reads = 0
	const env = new Proxy(Object.create(null), {
		get(_target, key) {
			assert.equal(key, 'APP_REVISION')
			reads += 1
			return revision
		},
		ownKeys: forbidden,
		getOwnPropertyDescriptor: forbidden
	})
	const route = compile(`apps/${application}/src/app/${routeFile}`, env)
	assert.deepEqual(Object.keys(route).sort(), [
		'GET',
		'dynamic',
		'runtime'
	])
	assert.equal(route.dynamic, 'force-dynamic')
	assert.equal(route.runtime, 'nodejs')
	return {
		route,
		setRevision(value) {
			revision = value
		},
		reads: () => reads
	}
}

async function assertResponse(route, application, revision) {
	// Invoke the actual transpiled handler with Node's native Request/Response.
	const response = await route.GET(
		new Request(
			'http://localhost/__frontend/health?application=other&revision=other'
		)
	)
	assert.ok(response instanceof Response)
	assert.equal(response.status, revision === null ? 503 : 200)
	assert.equal(response.headers.get('cache-control'), 'no-store')
	assert.equal(response.headers.get('content-type'), 'application/json')
	assert.deepEqual(await response.json(), {
		status: revision === null ? 'not-ready' : 'ok',
		application,
		revision
	})
}

for (const application of applications) {
	test(`${application}: valid image revision, exact identity and uncached native GET`, async () => {
		const revision = '0123456789abcdef'.repeat(2) + '01234567'
		const loaded = loadHealth(application, revision)
		assert.equal(
			loaded.reads(),
			0,
			'Revision must be evaluated per request'
		)
		await assertResponse(loaded.route, application, revision)
		assert.equal(loaded.reads(), 1)
	})

	test(`${application}: missing and malformed revisions fail closed without echoing values`, async () => {
		for (const revision of [
			undefined,
			null,
			'',
			'a'.repeat(39),
			'a'.repeat(41),
			'A'.repeat(40),
			'g'.repeat(40),
			' ' + 'a'.repeat(40),
			'a'.repeat(40) + ' ',
			'a'.repeat(40) + '\n',
			'a'.repeat(40) + '\r\n',
			'a'.repeat(39) + '\u0000',
			['a'.repeat(40)],
			{ revision: 'a'.repeat(40) }
		]) {
			const loaded = loadHealth(application, revision)
			await assertResponse(loaded.route, application, null)
		}
	})

	test(`${application}: readiness cannot retain a stale valid or invalid revision`, async () => {
		const loaded = loadHealth(application)
		await assertResponse(loaded.route, application, null)
		loaded.setRevision('b'.repeat(40))
		await assertResponse(loaded.route, application, 'b'.repeat(40))
		loaded.setRevision('invalid')
		await assertResponse(loaded.route, application, null)
		assert.equal(loaded.reads(), 3)
	})

	test(`${application}: installed Next maps the encoded folder to the literal public URL`, async () => {
		const appRequire = createRequire(
			new URL(`../apps/${application}/package.json`, import.meta.url)
		)
		const { createPagesMapping } = appRequire(
			application === 'crm'
				? 'next/dist/build/route-discovery'
				: 'next/dist/build/entries'
		)
		const appDir = fileURLToPath(
			new URL(`../apps/${application}/src/app/`, import.meta.url)
		)
		const mapping = await createPagesMapping({
			isDev: false,
			pageExtensions: ['ts'],
			pagePaths: [`/${routeFile}`],
			pagesType: 'app',
			appDir
		})
		assert.ok(Object.hasOwn(mapping, '/__frontend/health/route'))
		assert.ok(mapping['/__frontend/health/route'].endsWith(routeFile))
		assert.equal(
			existsSync(
				new URL(
					`../apps/${application}/src/app/__frontend/`,
					import.meta.url
				)
			),
			false
		)
	})
}

test('Widgets middleware allows health without invoking authentication or profile dependencies', () => {
	const next = Symbol('next')
	const { middleware } = compile(
		'apps/widgets/src/middleware.ts',
		{},
		{
			'@/app/middlewares/authMiddleware': { authMiddleware: forbidden },
			'@/app/middlewares/profileMiddleware': {
				profileMiddleware: forbidden
			},
			'next/server': { NextResponse: { next: () => next } }
		}
	)
	assert.equal(
		middleware({ nextUrl: { pathname: '/__frontend/health' } }),
		next
	)
})

test('Admin middleware matches only admin routes; Landing and CRM have no middleware', () => {
	const { config } = compile(
		'apps/admin-panel/src/middleware.ts',
		{},
		{
			'@/app/middlewares/adminMiddleware': { adminMiddleware: forbidden }
		}
	)
	assert.deepEqual(config.matcher, ['/admin/:path*'])
	for (const application of ['landing', 'crm']) {
		for (const relative of [
			'middleware.ts',
			'src/middleware.ts',
			'proxy.ts',
			'src/proxy.ts'
		]) {
			assert.equal(
				existsSync(
					new URL(`../apps/${application}/${relative}`, import.meta.url)
				),
				false
			)
		}
	}
})
