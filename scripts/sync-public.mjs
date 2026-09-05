import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const APPS = ['landing', 'widgets', 'admin-panel']
const SOURCE_MANIFEST = 'scripts/public-assets.manifest.json'
const OWNED_MANIFEST = '.winwidget-public-manifest.json'
const LOCK = '.winwidget-public-sync.lock'
const ICONS = ['apple-icon.png', 'favicon.ico', 'icon.png']
const ICON_PREFIX = 'apps/landing/src/app/'
const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_TOTAL_BYTES = 64 * 1024 * 1024
const HASH = /^[a-f0-9]{64}$/
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export class PublicAssetSyncError extends Error {
	constructor(code) {
		super(`Public asset sync failed (${code})`)
		this.code = code
	}
}

const fail = code => {
	throw new PublicAssetSyncError(code)
}

const exactKeys = (value, keys) =>
	value !== null &&
	typeof value === 'object' &&
	!Array.isArray(value) &&
	Object.keys(value).sort().join(',') === [...keys].sort().join(',')

const assertRelative = value => {
	if (
		typeof value !== 'string' ||
		value.length > 1024 ||
		/[\\\u0000-\u001f\u007f?#%]/.test(value) ||
		value.split('/').some(part => !part || part === '.' || part === '..')
	)
		fail('INVALID_PATH')
}

const assertPublicPath = value => {
	assertRelative(value)
	if (
		value
			.split('/')
			.some(
				part => part.startsWith('.') || /^(TEMP|other_files)$/i.test(part)
			)
	) {
		fail('FORBIDDEN_PATH')
	}
}

const sourceDestination = source => {
	assertPublicPath(source)
	if (source.startsWith('public/'))
		return { path: source.slice(7), apps: APPS }
	if (
		source.startsWith(ICON_PREFIX) &&
		ICONS.includes(source.slice(ICON_PREFIX.length))
	) {
		return {
			path: source.slice(ICON_PREFIX.length),
			apps: ['widgets', 'admin-panel']
		}
	}
	fail('INVALID_SOURCE')
}

const inspect = async filename => {
	try {
		return await fs.lstat(filename)
	} catch (error) {
		if (error.code === 'ENOENT') return null
		throw error
	}
}

const directory = async (root, relative, create = false) => {
	if (!relative || relative === '.') return root
	assertRelative(relative)
	let current = root
	for (const part of relative.split('/')) {
		current = path.join(current, part)
		let stat = await inspect(current)
		if (!stat && create) {
			try {
				await fs.mkdir(current)
			} catch (error) {
				if (error.code !== 'EEXIST') throw error
			}
			stat = await inspect(current)
		}
		if (!stat || !stat.isDirectory() || stat.isSymbolicLink())
			fail('UNSAFE_DIRECTORY')
	}
	return current
}

const readRegular = async (
	root,
	relative,
	{ missing = false, limit = MAX_FILE_BYTES } = {}
) => {
	assertRelative(relative)
	await directory(root, path.posix.dirname(relative))
	const filename = path.join(root, relative)
	const stat = await inspect(filename)
	if (!stat && missing) return null
	if (
		!stat ||
		!stat.isFile() ||
		stat.isSymbolicLink() ||
		stat.nlink !== 1 ||
		stat.size > limit
	)
		fail('UNSAFE_FILE')
	const handle = await fs.open(
		filename,
		constants.O_RDONLY | constants.O_NOFOLLOW
	)
	try {
		const opened = await handle.stat()
		if (
			opened.ino !== stat.ino ||
			opened.dev !== stat.dev ||
			opened.size > limit
		)
			fail('FILE_CHANGED')
		const bytes = await handle.readFile()
		if (bytes.length > limit) fail('FILE_TOO_LARGE')
		return bytes
	} finally {
		await handle.close()
	}
}

const parseJson = bytes => {
	try {
		return JSON.parse(bytes.toString('utf8'))
	} catch {
		fail('INVALID_MANIFEST')
	}
}

const parseSourceManifest = value => {
	if (
		!exactKeys(value, ['schemaVersion', 'files']) ||
		value.schemaVersion !== 1 ||
		!Array.isArray(value.files) ||
		!value.files.length ||
		value.files.length > 2048
	)
		fail('INVALID_MANIFEST')
	const destinations = new Set()
	let previous = ''
	for (const file of value.files) {
		if (
			!exactKeys(file, ['source', 'sha256']) ||
			typeof file.sha256 !== 'string' ||
			!HASH.test(file.sha256)
		)
			fail('INVALID_MANIFEST')
		const target = sourceDestination(file.source)
		if (file.source <= previous) fail('INVALID_MANIFEST')
		previous = file.source
		for (const app of target.apps) {
			const key = `${app}/${target.path}`
			if (destinations.has(key)) fail('DESTINATION_COLLISION')
			destinations.add(key)
		}
		if (file.source.startsWith('public/') && ICONS.includes(target.path))
			fail('METADATA_COLLISION')
	}
	return value.files
}

const parseOwnedManifest = (value, app) => {
	if (
		!exactKeys(value, ['schemaVersion', 'owner', 'app', 'files']) ||
		value.schemaVersion !== 1 ||
		value.owner !== 'winwidget-public-sync' ||
		value.app !== app ||
		!Array.isArray(value.files) ||
		value.files.length > 2048
	)
		fail('INVALID_OWNED_MANIFEST')
	let previous = ''
	for (const file of value.files) {
		if (
			!exactKeys(file, ['path', 'sha256']) ||
			typeof file.sha256 !== 'string' ||
			!HASH.test(file.sha256)
		)
			fail('INVALID_OWNED_MANIFEST')
		assertPublicPath(file.path)
		if (file.path <= previous) fail('INVALID_OWNED_MANIFEST')
		previous = file.path
	}
	return value.files
}

const atomicWrite = async (root, relative, bytes, expectedHash) => {
	const parent = await directory(root, path.posix.dirname(relative), true)
	const existing = await readRegular(root, relative, { missing: true })
	if ((existing === null ? null : digest(existing)) !== expectedHash)
		fail('DESTINATION_CHANGED')
	const temporary = path.join(
		parent,
		`.${path.basename(relative)}.${randomUUID()}.tmp`
	)
	try {
		const handle = await fs.open(
			temporary,
			constants.O_WRONLY |
				constants.O_CREAT |
				constants.O_EXCL |
				constants.O_NOFOLLOW,
			0o644
		)
		try {
			await handle.writeFile(bytes)
			await handle.sync()
		} finally {
			await handle.close()
		}
		await directory(root, path.posix.dirname(relative))
		await fs.rename(temporary, path.join(root, relative))
	} finally {
		await fs.unlink(temporary).catch(error => {
			if (error.code !== 'ENOENT') throw error
		})
	}
}

const validatedRoot = async root => {
	root = path.resolve(root)
	const stat = await fs.lstat(root)
	if (!stat.isDirectory() || stat.isSymbolicLink()) fail('UNSAFE_ROOT')
	return fs.realpath(root)
}

export const syncPublic = async ({ root = repositoryRoot, app } = {}) => {
	if (!APPS.includes(app)) fail('INVALID_APP')
	root = await validatedRoot(root)
	const sourceFiles = parseSourceManifest(
		parseJson(
			await readRegular(root, SOURCE_MANIFEST, { limit: 1024 * 1024 })
		)
	)
	const nextFiles = []
	let total = 0
	for (const file of sourceFiles) {
		const target = sourceDestination(file.source)
		const bytes = await readRegular(root, file.source)
		if (digest(bytes) !== file.sha256) fail('SOURCE_HASH_MISMATCH')
		total += bytes.length
		if (total > MAX_TOTAL_BYTES) fail('SOURCES_TOO_LARGE')
		if (target.apps.includes(app))
			nextFiles.push({ path: target.path, sha256: file.sha256, bytes })
	}
	nextFiles.sort((left, right) =>
		left.path < right.path ? -1 : left.path > right.path ? 1 : 0
	)
	const publicRoot = await directory(root, `apps/${app}/public`, true)
	let lock
	try {
		lock = await fs.open(
			path.join(publicRoot, LOCK),
			constants.O_CREAT |
				constants.O_EXCL |
				constants.O_WRONLY |
				constants.O_NOFOLLOW,
			0o600
		)
	} catch (error) {
		if (error.code === 'EEXIST') fail('SYNC_BUSY')
		throw error
	}
	try {
		const manifestBytes = await readRegular(publicRoot, OWNED_MANIFEST, {
			missing: true,
			limit: 1024 * 1024
		})
		const previousFiles = manifestBytes
			? parseOwnedManifest(parseJson(manifestBytes), app)
			: []
		const previous = new Map(
			previousFiles.map(file => [file.path, file.sha256])
		)
		const ownedDirectories = new Set(
			previousFiles.flatMap(file =>
				file.path
					.split('/')
					.slice(0, -1)
					.map((_, index, parts) => parts.slice(0, index + 1).join('/'))
			)
		)
		const visit = async (relative = '') => {
			const current = relative
				? await directory(publicRoot, relative)
				: publicRoot
			for (const entry of await fs.readdir(current, {
				withFileTypes: true
			})) {
				const child = relative ? `${relative}/${entry.name}` : entry.name
				if (child === OWNED_MANIFEST || child === LOCK) continue
				if (entry.isSymbolicLink()) fail('UNSAFE_FILE')
				if (entry.isDirectory()) {
					if (!ownedDirectories.has(child)) fail('UNKNOWN_FILE')
					await visit(child)
				} else {
					if (!previous.has(child)) fail('UNKNOWN_FILE')
					if (
						digest(await readRegular(publicRoot, child)) !==
						previous.get(child)
					)
						fail('DESTINATION_CHANGED')
				}
			}
		}
		await visit()
		const wanted = new Set(nextFiles.map(file => file.path))
		for (const file of nextFiles) {
			await directory(publicRoot, path.posix.dirname(file.path), true)
			const current = await readRegular(publicRoot, file.path, {
				missing: true
			})
			if (current && digest(current) === file.sha256) continue
			await atomicWrite(
				publicRoot,
				file.path,
				file.bytes,
				current ? previous.get(file.path) : null
			)
		}
		let removed = 0
		for (const file of previousFiles) {
			if (wanted.has(file.path)) continue
			const current = await readRegular(publicRoot, file.path, {
				missing: true
			})
			if (current) {
				if (digest(current) !== file.sha256) fail('DESTINATION_CHANGED')
				await fs.unlink(path.join(publicRoot, file.path))
				removed += 1
			}
		}
		const wantedDirectories = new Set(
			nextFiles.flatMap(file =>
				file.path
					.split('/')
					.slice(0, -1)
					.map((_, index, parts) => parts.slice(0, index + 1).join('/'))
			)
		)
		for (const staleDirectory of [...ownedDirectories].sort(
			(left, right) => right.length - left.length
		)) {
			if (wantedDirectories.has(staleDirectory)) continue
			await directory(publicRoot, path.posix.dirname(staleDirectory))
			await fs
				.rmdir(path.join(publicRoot, staleDirectory))
				.catch(error => {
					if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY')
						throw error
				})
		}
		const manifest = {
			schemaVersion: 1,
			owner: 'winwidget-public-sync',
			app,
			files: nextFiles.map(({ path: filename, sha256 }) => ({
				path: filename,
				sha256
			}))
		}
		await atomicWrite(
			publicRoot,
			OWNED_MANIFEST,
			Buffer.from(JSON.stringify(manifest, null, '\t') + '\n'),
			manifestBytes ? digest(manifestBytes) : null
		)
		return { app, files: nextFiles.length, removed }
	} finally {
		await lock.close()
		await fs.unlink(path.join(publicRoot, LOCK))
	}
}

export const generatePublicManifest = async ({
	root = repositoryRoot,
	check = false
} = {}) => {
	root = await validatedRoot(root)
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
	)
	const { stdout } = await promisify(execFile)(
		'git',
		[
			'-C',
			root,
			'ls-files',
			'--cached',
			'-z',
			'--',
			'public/',
			...ICONS.map(icon => ICON_PREFIX + icon)
		],
		{ env, maxBuffer: 1024 * 1024 }
	)
	const sources = stdout.split('\0').filter(Boolean).sort()
	if (ICONS.some(icon => !sources.includes(ICON_PREFIX + icon)))
		fail('UNTRACKED_METADATA_ICON')
	const files = []
	for (const source of sources) {
		sourceDestination(source)
		files.push({ source, sha256: digest(await readRegular(root, source)) })
	}
	parseSourceManifest({ schemaVersion: 1, files })
	const current = await readRegular(root, SOURCE_MANIFEST, {
		missing: true,
		limit: 1024 * 1024
	})
	const expected = Buffer.from(
		JSON.stringify({ schemaVersion: 1, files }, null, '\t') + '\n'
	)
	if (check) {
		if (!current || !current.equals(expected))
			fail('SOURCE_MANIFEST_OUTDATED')
	} else {
		await atomicWrite(
			root,
			SOURCE_MANIFEST,
			expected,
			current ? digest(current) : null
		)
	}
	return { files: files.length }
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		if (process.argv.length !== 3) fail('INVALID_ARGUMENTS')
		const result = ['--generate-manifest', '--check-manifest'].includes(
			process.argv[2]
		)
			? await generatePublicManifest({
					check: process.argv[2] === '--check-manifest'
				})
			: await syncPublic({ app: process.argv[2] })
		console.log(JSON.stringify(result))
	} catch (error) {
		console.error(
			error instanceof PublicAssetSyncError
				? error.message
				: 'Public asset sync failed (FILESYSTEM_ERROR)'
		)
		process.exitCode = 1
	}
}
