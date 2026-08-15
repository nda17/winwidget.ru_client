import { pathToFileURL } from 'node:url'

const AUTH_SETTINGS_URL = 'https://api.winwidget.ru/api/v1/auth/settings'
const AUTH_SETTINGS_KEYS = [
	'githubAuthEnabled',
	'googleAuthEnabled',
	'recaptchaEnabled',
	'telegramAuthEnabled',
	'vkAuthEnabled',
	'yandexAuthEnabled'
]

export const assertAuthSettingsContract = payload => {
	if (
		payload === null ||
		Array.isArray(payload) ||
		typeof payload !== 'object'
	) {
		throw new Error('Auth settings response must be a JSON object')
	}

	const actualKeys = Object.keys(payload).sort()
	if (JSON.stringify(actualKeys) !== JSON.stringify(AUTH_SETTINGS_KEYS)) {
		throw new Error(
			`Auth settings response must contain exactly: ${AUTH_SETTINGS_KEYS.join(', ')}`
		)
	}

	for (const key of AUTH_SETTINGS_KEYS) {
		if (typeof payload[key] !== 'boolean') {
			throw new Error(`Auth settings field ${key} must be boolean`)
		}
	}
}

const verifyAuthSettingsContract = async () => {
	const response = await fetch(AUTH_SETTINGS_URL, {
		headers: {
			accept: 'application/json',
			'cache-control': 'no-cache'
		},
		redirect: 'error',
		signal: AbortSignal.timeout(10_000)
	})

	if (response.status !== 200) {
		throw new Error(
			`Auth settings contract returned HTTP ${response.status}`
		)
	}

	const contentType = response.headers.get('content-type') ?? ''
	if (!contentType.toLowerCase().startsWith('application/json')) {
		throw new Error('Auth settings contract must return application/json')
	}

	let payload
	try {
		payload = await response.json()
	} catch {
		throw new Error('Auth settings contract returned invalid JSON')
	}

	assertAuthSettingsContract(payload)
	console.log('Production auth settings contract verified')
}

const isDirectRun =
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
	verifyAuthSettingsContract().catch(error => {
		console.error(error instanceof Error ? error.message : String(error))
		process.exitCode = 1
	})
}
