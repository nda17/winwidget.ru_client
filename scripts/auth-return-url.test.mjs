import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const modulePath = new URL(
	'../src/shared/lib/auth-return-url.ts',
	import.meta.url
)
const sourceText = await readFile(modulePath, 'utf8')
const { outputText } = ts.transpileModule(sourceText, {
	compilerOptions: {
		module: ts.ModuleKind.ESNext,
		target: ts.ScriptTarget.ES2022
	}
})
const authReturn = await import(
	`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)

const productionOptions = { allowLocalhost: false }
const localOptions = { allowLocalhost: true }

const createStorage = () => {
	const values = new Map()

	return {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: key => values.delete(key)
	}
}

test('accepts only the exact production WinCRM origin', () => {
	assert.equal(
		authReturn.getSafeAuthReturnUrl(
			'https://crm.winwidget.ru/deals/42?tab=history#latest',
			productionOptions
		),
		'https://crm.winwidget.ru/deals/42?tab=history#latest'
	)

	for (const unsafeUrl of [
		'https://crm.winwidget.ru.evil.example/deals',
		'https://crm.winwidget.ru:444/deals',
		'https://user@crm.winwidget.ru/deals',
		'http://crm.winwidget.ru/deals',
		'https://winwidget.ru/deals',
		'//crm.winwidget.ru/deals',
		'https://crm.winwidget.ru\\@evil.example/deals',
		' https://crm.winwidget.ru/deals',
		['https://crm.winwidget.ru/deals']
	]) {
		assert.equal(
			authReturn.getSafeAuthReturnUrl(unsafeUrl, productionOptions),
			null
		)
	}
})

test('allows the exact local WinCRM origin only in local mode', () => {
	const localUrl = 'http://localhost:3001/inbox?filter=new'

	assert.equal(
		authReturn.getSafeAuthReturnUrl(localUrl, localOptions),
		localUrl
	)
	assert.equal(
		authReturn.getSafeAuthReturnUrl(localUrl, productionOptions),
		null
	)
	assert.equal(
		authReturn.getSafeAuthReturnUrl(
			'http://127.0.0.1:3001/inbox',
			localOptions
		),
		null
	)
})

test('keeps missing, invalid and valid query values distinct', () => {
	assert.equal(
		authReturn.parseAuthReturnUrlParam(undefined, productionOptions),
		undefined
	)
	assert.equal(
		authReturn.parseAuthReturnUrlParam(
			'https://evil.example',
			productionOptions
		),
		null
	)

	const params = new URLSearchParams([
		['returnUrl', 'https://crm.winwidget.ru/deals'],
		['returnUrl', 'https://crm.winwidget.ru/tasks']
	])
	assert.equal(
		authReturn.getAuthReturnUrlFromSearchParams(params, productionOptions),
		null
	)
})

test('propagates only a validated returnUrl between auth pages', () => {
	assert.equal(
		authReturn.withAuthReturnUrl(
			'/register',
			'https://crm.winwidget.ru/deals?owner=me',
			productionOptions
		),
		'/register?returnUrl=https%3A%2F%2Fcrm.winwidget.ru%2Fdeals%3Fowner%3Dme'
	)
	assert.equal(
		authReturn.withAuthReturnUrl(
			'/register',
			'https://evil.example',
			productionOptions
		),
		'/register'
	)
})

test('stores a short-lived same-tab intent and rejects tampering', () => {
	const storage = createStorage()
	const now = 1_700_000_000_000
	const returnUrl = 'https://crm.winwidget.ru/contacts'

	assert.equal(
		authReturn.saveAuthReturnIntent(
			storage,
			returnUrl,
			now,
			productionOptions
		),
		returnUrl
	)
	assert.equal(
		authReturn.readAuthReturnIntent(
			storage,
			now + 60_000,
			productionOptions
		),
		returnUrl
	)
	assert.equal(
		authReturn.readAuthReturnIntent(
			storage,
			now + 15 * 60_000 + 1,
			productionOptions
		),
		null
	)

	storage.setItem(
		authReturn.AUTH_RETURN_INTENT_STORAGE_KEY,
		JSON.stringify({ url: 'https://evil.example', createdAt: now })
	)
	assert.equal(
		authReturn.readAuthReturnIntent(storage, now, productionOptions),
		null
	)
	assert.equal(
		storage.getItem(authReturn.AUTH_RETURN_INTENT_STORAGE_KEY),
		null
	)
})

test('OAuth completion uses validated same-tab intent, not callback query', async () => {
	const socialAuthSource = await readFile(
		new URL(
			'../src/screens/auth/ui/social-auth/SocialAuth.tsx',
			import.meta.url
		),
		'utf8'
	)

	assert.match(
		socialAuthSource,
		/readAuthReturnIntent\(window\.sessionStorage\)/
	)
	assert.doesNotMatch(
		socialAuthSource,
		/useSearchParams|window\.location\.search|searchParams/
	)
})

test('all interactive auth completions use the guarded navigation helper', async () => {
	const authFormSource = await readFile(
		new URL('../src/features/auth/model/useAuthForm.ts', import.meta.url),
		'utf8'
	)
	const navigationCalls =
		authFormSource.match(/navigateAfterAuth\(/g) ?? []
	const loginFallbackCalls =
		authFormSource.match(/navigateAfterAuth\(loginDestination\)/g) ?? []
	const registrationFallbackCalls =
		authFormSource.match(/navigateAfterAuth\(PUBLIC_PAGES\.CABINET\)/g) ??
		[]

	assert.equal(navigationCalls.length, 5)
	assert.equal(loginFallbackCalls.length, 2)
	assert.equal(registrationFallbackCalls.length, 2)
	assert.match(
		authFormSource,
		/isLogin \? loginDestination : PUBLIC_PAGES\.CABINET/
	)
})

test('auth page toggles keep only a validated returnUrl', async () => {
	const authToggleSource = await readFile(
		new URL(
			'../src/features/auth/ui/auth-form/auth-toggle/AuthToggle.tsx',
			import.meta.url
		),
		'utf8'
	)

	assert.match(
		authToggleSource,
		/const authPage = \(path: string\) => withAuthReturnUrl\(path, authReturnUrl\)/
	)
	assert.match(authToggleSource, /authPage\(PUBLIC_PAGES\.REGISTER\)/)
	assert.match(authToggleSource, /authPage\(PUBLIC_PAGES\.LOGIN\)/)
	assert.match(
		authToggleSource,
		/authPage\(PUBLIC_PAGES\.RESTORE_PASSWORD\)/
	)
})

test('already authenticated auth pages redirect only through the validator', async () => {
	const middlewareSource = await readFile(
		new URL('../src/app/middlewares/authMiddleware.ts', import.meta.url),
		'utf8'
	)

	assert.match(
		middlewareSource,
		/getAuthReturnUrlFromSearchParams\(\s*request\.nextUrl\.searchParams\s*\)/
	)
	assert.match(
		middlewareSource,
		/authReturnUrl \|\| new URL\('\/', request\.url\)/
	)
})
