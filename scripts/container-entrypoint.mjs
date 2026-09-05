import { lstatSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const FRONTEND_APPS = Object.freeze([
	'landing',
	'widgets',
	'admin-panel',
	'crm'
])

const rejectPackaging = () => {
	throw new Error('Invalid frontend runtime packaging')
}

export const resolveFrontendServer = (directory, app) => {
	if (!FRONTEND_APPS.includes(app)) rejectPackaging()
	try {
		const root = realpathSync(directory)
		const appNames = readdirSync(path.join(root, 'apps'))
		if (appNames.length !== 1 || appNames[0] !== app) rejectPackaging()
		const server = path.join(root, 'apps', app, 'server.js')
		if (!lstatSync(server).isFile()) rejectPackaging()
		if (!realpathSync(server).startsWith(`${root}${path.sep}`)) {
			rejectPackaging()
		}
		return server
	} catch {
		return rejectPackaging()
	}
}

// Image-build/CI validation only: this does not start Next or make requests.
export const verifyFrontendRuntime = (directory, app, revision) => {
	if (
		typeof revision !== 'string' ||
		revision.length !== 40 ||
		!/^[a-f0-9]{40}$/.test(revision)
	) {
		rejectPackaging()
	}
	const server = resolveFrontendServer(directory, app)
	const root = realpathSync(directory)
	const visit = current => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			if (/^\.env(?:\.|$)/.test(entry.name)) rejectPackaging()
			const target = path.join(current, entry.name)
			if (entry.isSymbolicLink()) {
				if (!realpathSync(target).startsWith(`${root}${path.sep}`)) {
					rejectPackaging()
				}
			} else if (entry.isDirectory()) {
				visit(target)
			}
		}
	}
	try {
		visit(root)
		for (const relative of ['public', '.next/static']) {
			if (
				!lstatSync(path.join(path.dirname(server), relative)).isDirectory()
			) {
				rejectPackaging()
			}
		}
		if (readdirSync(root).includes('public')) rejectPackaging()
		return server
	} catch {
		return rejectPackaging()
	}
}

const direct =
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (direct) {
	try {
		const root = path.dirname(fileURLToPath(import.meta.url))
		if (process.argv.length === 3 && process.argv[2] === '--verify') {
			verifyFrontendRuntime(
				root,
				process.env.FRONTEND_APP,
				process.env.APP_REVISION
			)
			console.log('Frontend runtime packaging verified')
		} else if (process.argv.length === 2) {
			const server = resolveFrontendServer(root, process.env.FRONTEND_APP)
			await import(pathToFileURL(server).href)
		} else {
			rejectPackaging()
		}
	} catch {
		console.error('Frontend runtime could not be started or verified')
		process.exitCode = 1
	}
}
