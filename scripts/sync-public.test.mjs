import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { PublicAssetSyncError, syncPublic } from './sync-public.mjs'

const MANIFEST = 'scripts/public-assets.manifest.json'
const OWNED = '.winwidget-public-manifest.json'
const hash = value => createHash('sha256').update(value).digest('hex')
const json = value => JSON.stringify(value, null, '\t') + '\n'
const errorCode = code => error =>
	error instanceof PublicAssetSyncError && error.code === code

const createFixture = async t => {
	const root = await fs.mkdtemp(
		path.join(os.tmpdir(), 'winwidget-public-sync-test-')
	)
	t.after(() => fs.rm(root, { recursive: true, force: true }))
	const write = async (relative, bytes) => {
		const filename = path.join(root, relative)
		await fs.mkdir(path.dirname(filename), { recursive: true })
		await fs.writeFile(filename, bytes)
	}
	const assets = new Map([
		['public/logo.svg', '<svg>fixture</svg>'],
		['public/images/card.png', 'fixture-png'],
		['apps/landing/src/app/favicon.ico', 'fixture-favicon'],
		['apps/landing/src/app/icon.png', 'fixture-icon'],
		['apps/landing/src/app/apple-icon.png', 'fixture-apple-icon']
	])
	const writeManifest = async () => {
		await write(
			MANIFEST,
			json({
				schemaVersion: 1,
				files: [...assets]
					.sort(([left], [right]) => (left < right ? -1 : 1))
					.map(([source, bytes]) => ({ source, sha256: hash(bytes) }))
			})
		)
	}
	for (const [source, bytes] of assets) await write(source, bytes)
	await writeManifest()
	return {
		root,
		write,
		assets,
		writeManifest,
		target: (app, relative = '') =>
			path.join(root, 'apps', app, 'public', relative)
	}
}

test('copies exact common assets to each independent app and avoids landing metadata collisions', async t => {
	const fixture = await createFixture(t)
	for (const app of ['landing', 'widgets', 'admin-panel']) {
		const result = await syncPublic({ root: fixture.root, app })
		assert.deepEqual(result, {
			app,
			files: app === 'landing' ? 2 : 5,
			removed: 0
		})
		for (const [source, bytes] of fixture.assets) {
			const relative = source.startsWith('public/')
				? source.slice(7)
				: path.basename(source)
			if (app === 'landing' && !source.startsWith('public/')) {
				await assert.rejects(fs.access(fixture.target(app, relative)))
			} else
				assert.equal(
					await fs.readFile(fixture.target(app, relative), 'utf8'),
					bytes
				)
		}
		const manifest = JSON.parse(
			await fs.readFile(fixture.target(app, OWNED), 'utf8')
		)
		assert.equal(manifest.app, app)
		assert.equal(manifest.owner, 'winwidget-public-sync')
		assert.equal(manifest.files.length, result.files)
		assert.deepEqual(
			manifest.files.map(file => file.path),
			[...manifest.files.map(file => file.path)].sort()
		)
	}
})

test('repeated synchronization is idempotent and does not rewrite unchanged assets', async t => {
	const fixture = await createFixture(t)
	await syncPublic({ root: fixture.root, app: 'widgets' })
	const before = await fs.stat(fixture.target('widgets', 'logo.svg'))
	const manifest = await fs.readFile(
		fixture.target('widgets', OWNED),
		'utf8'
	)
	assert.deepEqual(
		await syncPublic({ root: fixture.root, app: 'widgets' }),
		{ app: 'widgets', files: 5, removed: 0 }
	)
	const after = await fs.stat(fixture.target('widgets', 'logo.svg'))
	assert.equal(after.ino, before.ino)
	assert.equal(after.mtimeMs, before.mtimeMs)
	assert.equal(
		await fs.readFile(fixture.target('widgets', OWNED), 'utf8'),
		manifest
	)
})

test('updates reviewed source hashes and deletes only stale manifest-owned files and empty parents', async t => {
	const fixture = await createFixture(t)
	await syncPublic({ root: fixture.root, app: 'widgets' })
	fixture.assets.set('public/logo.svg', '<svg>updated fixture</svg>')
	await fixture.write(
		'public/logo.svg',
		fixture.assets.get('public/logo.svg')
	)
	fixture.assets.delete('public/images/card.png')
	await fixture.writeManifest()
	assert.deepEqual(
		await syncPublic({ root: fixture.root, app: 'widgets' }),
		{ app: 'widgets', files: 4, removed: 1 }
	)
	assert.equal(
		await fs.readFile(fixture.target('widgets', 'logo.svg'), 'utf8'),
		'<svg>updated fixture</svg>'
	)
	await assert.rejects(fs.access(fixture.target('widgets', 'images')))
	assert.equal(
		await fs.readFile(
			path.join(fixture.root, 'public/images/card.png'),
			'utf8'
		),
		'fixture-png'
	)
	await syncPublic({ root: fixture.root, app: 'widgets' })
})

test('source hash mismatch aborts before writing a destination', async t => {
	const fixture = await createFixture(t)
	await fixture.write('public/logo.svg', '<svg>unreviewed</svg>')
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'landing' }),
		errorCode('SOURCE_HASH_MISMATCH')
	)
	await assert.rejects(fs.access(fixture.target('landing')))
})

test('source files absent from the reviewed inventory are never traversed or copied', async t => {
	const fixture = await createFixture(t)
	await fixture.write('public/untracked.png', 'not in inventory')
	await fixture.write('public/TEMP/ignored.txt', 'fixture only')
	await fixture.write('public/.env', 'fixture only')
	await syncPublic({ root: fixture.root, app: 'landing' })
	for (const relative of ['untracked.png', 'TEMP', '.env']) {
		await assert.rejects(fs.access(fixture.target('landing', relative)))
	}
})

test('repository root and source manifest symlinks are rejected', async t => {
	const fixture = await createFixture(t)
	const rootLink = path.join(fixture.root, 'root-link')
	await fs.symlink(fixture.root, rootLink)
	await assert.rejects(
		syncPublic({ root: rootLink + path.sep, app: 'widgets' }),
		errorCode('UNSAFE_ROOT')
	)
	const sourceManifest = path.join(fixture.root, MANIFEST)
	await fs.rename(
		sourceManifest,
		path.join(fixture.root, 'manifest-copy.json')
	)
	await fs.symlink(
		path.join(fixture.root, 'manifest-copy.json'),
		sourceManifest
	)
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('UNSAFE_FILE')
	)
})

test('a late source hash mismatch leaves existing assets and ownership manifest unchanged', async t => {
	const fixture = await createFixture(t)
	await syncPublic({ root: fixture.root, app: 'widgets' })
	const before = await fs.readFile(
		fixture.target('widgets', OWNED),
		'utf8'
	)
	await fixture.write('public/logo.svg', 'modified')
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('SOURCE_HASH_MISMATCH')
	)
	assert.equal(
		await fs.readFile(fixture.target('widgets', 'logo.svg'), 'utf8'),
		'<svg>fixture</svg>'
	)
	assert.equal(
		await fs.readFile(fixture.target('widgets', OWNED), 'utf8'),
		before
	)
})

test('unknown destination files are preserved even when their bytes equal a desired asset', async t => {
	const fixture = await createFixture(t)
	await fixture.write('apps/widgets/public/logo.svg', '<svg>fixture</svg>')
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('UNKNOWN_FILE')
	)
	assert.equal(
		await fs.readFile(fixture.target('widgets', 'logo.svg'), 'utf8'),
		'<svg>fixture</svg>'
	)
	await assert.rejects(fs.access(fixture.target('widgets', OWNED)))
})

test('unknown nested files prevent cleanup without deleting stale owned files', async t => {
	const fixture = await createFixture(t)
	await syncPublic({ root: fixture.root, app: 'widgets' })
	await fixture.write('apps/widgets/public/images/personal.png', 'keep')
	fixture.assets.delete('public/images/card.png')
	await fixture.writeManifest()
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('UNKNOWN_FILE')
	)
	assert.equal(
		await fs.readFile(
			fixture.target('widgets', 'images/personal.png'),
			'utf8'
		),
		'keep'
	)
	assert.equal(
		await fs.readFile(
			fixture.target('widgets', 'images/card.png'),
			'utf8'
		),
		'fixture-png'
	)
})

test('locally modified owned files are never overwritten or deleted', async t => {
	const fixture = await createFixture(t)
	await syncPublic({ root: fixture.root, app: 'widgets' })
	await fixture.write('apps/widgets/public/logo.svg', 'local edit')
	fixture.assets.delete('public/logo.svg')
	await fixture.writeManifest()
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('DESTINATION_CHANGED')
	)
	assert.equal(
		await fs.readFile(fixture.target('widgets', 'logo.svg'), 'utf8'),
		'local edit'
	)
})

test('source file and source ancestor symlinks fail closed', async t => {
	for (const relative of ['public/logo.svg', 'public/images']) {
		const fixture = await createFixture(t)
		const original = path.join(fixture.root, relative)
		const moved = path.join(fixture.root, 'fixture-outside')
		await fs.rename(original, moved)
		await fs.symlink(moved, original)
		await assert.rejects(
			syncPublic({ root: fixture.root, app: 'widgets' }),
			errorCode(
				relative.endsWith('.svg') ? 'UNSAFE_FILE' : 'UNSAFE_DIRECTORY'
			)
		)
	}
})

test('destination root, nested directories and owned files cannot be symlinks', async t => {
	for (const relative of ['', 'images', 'logo.svg']) {
		const fixture = await createFixture(t)
		await syncPublic({ root: fixture.root, app: 'widgets' })
		const original = fixture.target('widgets', relative)
		const moved = path.join(fixture.root, 'fixture-outside')
		await fs.rename(original, moved)
		await fs.symlink(moved, original)
		await assert.rejects(
			syncPublic({ root: fixture.root, app: 'widgets' }),
			errorCode(relative ? 'UNSAFE_FILE' : 'UNSAFE_DIRECTORY')
		)
		assert.equal(
			await fs.readFile(
				relative === ''
					? path.join(moved, 'logo.svg')
					: relative === 'images'
						? path.join(moved, 'card.png')
						: moved,
				'utf8'
			),
			relative === 'images' ? 'fixture-png' : '<svg>fixture</svg>'
		)
	}
})

test('source hard links and symlink ownership manifests are rejected', async t => {
	const fixture = await createFixture(t)
	await fs.link(
		path.join(fixture.root, 'public/logo.svg'),
		path.join(fixture.root, 'hard-link.svg')
	)
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('UNSAFE_FILE')
	)
	await fs.unlink(path.join(fixture.root, 'hard-link.svg'))
	await syncPublic({ root: fixture.root, app: 'widgets' })
	await fs.rename(
		fixture.target('widgets', OWNED),
		path.join(fixture.root, 'owned-copy.json')
	)
	await fs.symlink(
		path.join(fixture.root, 'owned-copy.json'),
		fixture.target('widgets', OWNED)
	)
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('UNSAFE_FILE')
	)
})

test('source path traversal and forbidden directories are rejected without reading their contents', async t => {
	for (const source of [
		'public/../outside.png',
		'public/%2e%2e/outside.png',
		'/public/logo.svg',
		'public\\logo.svg',
		'public/.env',
		'public/TEMP/value.png',
		'public/other_files/value.png',
		'elsewhere/logo.svg'
	]) {
		const fixture = await createFixture(t)
		await fixture.write(
			MANIFEST,
			json({
				schemaVersion: 1,
				files: [{ source, sha256: hash('fixture') }]
			})
		)
		await assert.rejects(
			syncPublic({ root: fixture.root, app: 'widgets' }),
			error => error instanceof PublicAssetSyncError
		)
		await assert.rejects(fs.access(fixture.target('widgets')))
	}
})

test('malformed or duplicate inventory and metadata destination collisions fail before writes', async t => {
	for (const kind of [
		'duplicate',
		'extra',
		'collision',
		'landing-collision'
	]) {
		const fixture = await createFixture(t)
		let manifest = JSON.parse(
			await fs.readFile(path.join(fixture.root, MANIFEST), 'utf8')
		)
		if (kind === 'duplicate') manifest.files.push(manifest.files.at(-1))
		if (kind === 'extra') manifest.extra = true
		if (kind === 'collision')
			manifest.files.push({
				source: 'public/icon.png',
				sha256: hash('extra')
			})
		if (kind === 'landing-collision')
			manifest.files = [
				{ source: 'public/favicon.ico', sha256: hash('extra') }
			]
		manifest.files.sort((left, right) =>
			left.source < right.source ? -1 : left.source > right.source ? 1 : 0
		)
		await fixture.write(MANIFEST, json(manifest))
		await assert.rejects(
			syncPublic({ root: fixture.root, app: 'landing' }),
			error => error instanceof PublicAssetSyncError
		)
		await assert.rejects(fs.access(fixture.target('landing')))
	}
})

test('tampered ownership cannot authorize outside paths or another app', async t => {
	for (const change of ['path', 'app', 'hash', 'owner']) {
		const fixture = await createFixture(t)
		await syncPublic({ root: fixture.root, app: 'widgets' })
		const manifest = JSON.parse(
			await fs.readFile(fixture.target('widgets', OWNED), 'utf8')
		)
		if (change === 'path') manifest.files[0].path = '../../outside.png'
		if (change === 'app') manifest.app = 'landing'
		if (change === 'hash') manifest.files[0].sha256 = 'invalid'
		if (change === 'owner') manifest.owner = 'unknown'
		await fixture.write('apps/widgets/public/' + OWNED, json(manifest))
		await assert.rejects(
			syncPublic({ root: fixture.root, app: 'widgets' }),
			error => error instanceof PublicAssetSyncError
		)
		assert.equal(
			await fs.readFile(fixture.target('widgets', 'logo.svg'), 'utf8'),
			'<svg>fixture</svg>'
		)
	}
})

test('concurrent invocations either synchronize or report bounded busy, then replay cleanly', async t => {
	const fixture = await createFixture(t)
	const results = await Promise.allSettled([
		syncPublic({ root: fixture.root, app: 'widgets' }),
		syncPublic({ root: fixture.root, app: 'widgets' })
	])
	assert.ok(results.some(result => result.status === 'fulfilled'))
	for (const result of results)
		if (result.status === 'rejected')
			assert.equal(result.reason.code, 'SYNC_BUSY')
	await syncPublic({ root: fixture.root, app: 'widgets' })
	const files = await fs.readdir(fixture.target('widgets'))
	assert.ok(
		files.every(file => !file.endsWith('.tmp') && !file.endsWith('.lock'))
	)
})

test('existing abandoned lock is preserved and never expires automatically', async t => {
	const fixture = await createFixture(t)
	await fixture.write(
		'apps/widgets/public/.winwidget-public-sync.lock',
		'owned recovery needed'
	)
	await assert.rejects(
		syncPublic({ root: fixture.root, app: 'widgets' }),
		errorCode('SYNC_BUSY')
	)
	assert.equal(
		await fs.readFile(
			fixture.target('widgets', '.winwidget-public-sync.lock'),
			'utf8'
		),
		'owned recovery needed'
	)
})

test('application selection cannot target CRM or an arbitrary directory', async t => {
	const fixture = await createFixture(t)
	for (const app of ['crm', '../outside', '', null])
		await assert.rejects(
			syncPublic({ root: fixture.root, app }),
			errorCode('INVALID_APP')
		)
})
