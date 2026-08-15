#!/usr/bin/env node

import {
	constants as fsConstants,
	closeSync,
	existsSync,
	fsyncSync,
	fstatSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	readSync,
	realpathSync,
	renameSync,
	rmSync
} from 'node:fs'
import { createHash, randomUUID, sign, verify } from 'node:crypto'
import { get } from 'node:https'
import { basename, dirname, join, resolve } from 'node:path'
import {
	atomicWrite,
	provisionSigningKeyPair,
	readBoundedRegularFile,
	readEd25519PrivateKey,
	readEd25519PublicKey,
	readSignature,
	sha256,
	validateReleaseEvidenceRaw,
	validateRuntimeEvidenceRaw
} from './identity-avatar-client-release-evidence.mjs'

const SCHEMA_VERSION = 1
const SOAK_KIND = 'identity-avatar-client-log-soak'
const SOAK_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'releaseEvidenceSha256',
	'processStartedAt',
	'logConfigurationSha256',
	'sequence',
	'previousEvidenceSha256',
	'windowStartedAt',
	'windowEndedAt',
	'hosts',
	'probeClass',
	'probeRequestCount',
	'logFiles',
	'logSetSha256',
	'apiV1FilesRequestCount',
	'uploadsGetHeadRequestCount',
	'uploadsSuccessfulGetHeadCount',
	'rotationContinuityPassed',
	'futureSkewPassed',
	'generatedAt'
]
const LOG_FILE_KEYS = [
	'pathSha256',
	'device',
	'inode',
	'generation',
	'firstByteOffset',
	'lastByteOffset',
	'bytes',
	'sha256',
	'mtime'
]
const NGINX_LOG_KEYS = [
	'timestamp',
	'host',
	'pathClass',
	'method',
	'status'
]
const SOAK_HOSTS = ['winwidget.ru', 'www.winwidget.ru']
const JOURNAL_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'sequence',
	'previousJournalEntrySha256',
	'bodyBase64',
	'signatureFileBase64',
	'cursors'
]
const CURSOR_KEYS = [
	'path',
	'device',
	'inode',
	'generation',
	'offset',
	'mtime'
]
const PENDING_PROBE_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'releaseEvidenceSha256',
	'processStartedAt',
	'sequence',
	'windowStartedAt',
	'probeId'
]
const REVISION_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)$/
const PROBE_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000
const MAX_WINDOW_MS = 26 * 60 * 60 * 1000
const MAX_FRESHNESS_MS = 60 * 60 * 1000
const MIN_HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000
const MAX_LOG_FILES = 16
const MAX_LOG_FILE_BYTES = 64 * 1024 * 1024
const MAX_LOG_SLICE_BYTES = 32 * 1024 * 1024
const MAX_JOURNAL_BYTES = 16 * 1024 * 1024
const MAX_JOURNAL_ENTRIES = 64
const MAX_EVIDENCE_BYTES = 1024 * 1024
const ACCESS_LOG_PATH =
	'/var/log/nginx/winwidget.identity-avatar-client.access.log'
const RELEASE_ROOT =
	'/opt/winwidget/deploy/frontend/identity-avatar-client-release'
const SIGNING_PRIVATE =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-signing.private.pem'
const SIGNING_PUBLIC =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-signing.public.pem'
const NGINX_CONFIG_PATH =
	'/etc/nginx/conf.d/winwidget-identity-avatar-client-log-soak.conf'

const resolveSoakLocation = (revision, generation) => {
	if (generation === undefined) {
		return {
			root: join(RELEASE_ROOT, revision, 'soak'),
			publicPath: 'soak'
		}
	}
	if (
		!Number.isSafeInteger(generation) ||
		generation < 1 ||
		generation > MAX_JOURNAL_ENTRIES
	) {
		fail('Runtime-rebind log soak generation is invalid')
	}
	const name = `generation-${String(generation).padStart(6, '0')}`
	return {
		root: join(RELEASE_ROOT, revision, 'runtime-rebind', name),
		publicPath: `runtime-rebind/${name}`
	}
}

const heartbeatCheckpoint = ({
	revision,
	releaseSha,
	processStartedAt,
	generation,
	initialAnchorSha = releaseSha
}) => {
	if (
		typeof process.getuid !== 'function' ||
		process.getuid() !== 0 ||
		!REVISION_PATTERN.test(revision) ||
		!SHA256_PATTERN.test(releaseSha) ||
		!SHA256_PATTERN.test(initialAnchorSha) ||
		!isCanonicalTimestamp(processStartedAt)
	) {
		fail('Log soak checkpoint identity is invalid')
	}
	const { root: soakRoot } = resolveSoakLocation(revision, generation)
	mkdirSync(soakRoot, { recursive: true, mode: 0o755 })
	const soakRootMetadata = lstatSync(soakRoot)
	if (
		!soakRootMetadata.isDirectory() ||
		soakRootMetadata.isSymbolicLink() ||
		soakRootMetadata.uid !== 0 ||
		soakRootMetadata.gid !== 0 ||
		(soakRootMetadata.mode & 0o022) !== 0
	) {
		fail('Log soak checkpoint directory is not secure')
	}
	const journalRoot = join(soakRoot, '.journal-v1')
	const publicKey = readEd25519PublicKey(SIGNING_PUBLIC)
	const logConfigurationSha = readLogConfigurationSha()
	const entries = parseJournal({
		journalRoot,
		revision,
		releaseSha,
		processStartedAt,
		logConfigurationSha,
		initialAnchorSha,
		publicKey
	})
	const latestBodyPath = join(soakRoot, 'latest-v1.json')
	const latestSignaturePath = join(soakRoot, 'latest-v1.json.sig')
	if (entries.length === 0) {
		if (existsSync(latestBodyPath) || existsSync(latestSignaturePath)) {
			fail('Published log soak latest artifact exists without a journal')
		}
		return {
			sequence: 0,
			bodySha256: '0'.repeat(64),
			generatedAt: null
		}
	}
	const latest = entries.at(-1)
	// A previous deployment may have crashed after the signed journal append but
	// before publishing the immutable/latest files. Recover those bytes before
	// taking the new deployment checkpoint; the following heartbeat must still
	// advance to the next sequence.
	publishJournalEntry(soakRoot, latest)
	const sequence = String(latest.entry.sequence).padStart(6, '0')
	const immutableBody = readBoundedRegularFile(
		join(soakRoot, `heartbeat-${sequence}-v1.json`),
		MAX_EVIDENCE_BYTES,
		'Immutable log soak heartbeat'
	)
	const immutableSignature = readBoundedRegularFile(
		join(soakRoot, `heartbeat-${sequence}-v1.json.sig`),
		1024,
		'Immutable log soak heartbeat signature'
	)
	const latestBody = readBoundedRegularFile(
		latestBodyPath,
		MAX_EVIDENCE_BYTES,
		'Latest log soak heartbeat'
	)
	const latestSignature = readBoundedRegularFile(
		latestSignaturePath,
		1024,
		'Latest log soak heartbeat signature'
	)
	if (
		!immutableBody.equals(latest.body) ||
		!latestBody.equals(latest.body) ||
		!immutableSignature.equals(latest.signatureFile) ||
		!latestSignature.equals(latest.signatureFile)
	) {
		fail('Published log soak heartbeat differs from its signed journal')
	}
	verifySoakSignature(
		latestBody,
		latestSignature,
		publicKey,
		'Latest log soak heartbeat'
	)
	const value = validateSoakEvidenceRaw(latestBody, {
		expectedRevision: revision,
		expectedReleaseSha: releaseSha,
		expectedProcessStartedAt: processStartedAt,
		expectedLogConfigurationSha: logConfigurationSha,
		expectedInitialAnchorSha: initialAnchorSha,
		previousRaw: entries.at(-2)?.body
	})
	return {
		sequence: value.sequence,
		bodySha256: sha256(latestBody),
		generatedAt: value.generatedAt
	}
}

export const validateFreshHeartbeatCheckpoint = ({
	beforeSequence,
	beforeBodySha256,
	after,
	invokedAfter,
	nowMs = Date.now()
}) => {
	if (
		!Number.isSafeInteger(beforeSequence) ||
		beforeSequence < 0 ||
		beforeSequence >= MAX_JOURNAL_ENTRIES ||
		!SHA256_PATTERN.test(beforeBodySha256) ||
		!after ||
		after.sequence !== beforeSequence + 1 ||
		!SHA256_PATTERN.test(after.bodySha256) ||
		after.bodySha256 === beforeBodySha256 ||
		!isCanonicalTimestamp(after.generatedAt) ||
		!isCanonicalTimestamp(invokedAfter)
	) {
		fail('First log soak heartbeat did not advance exactly once')
	}
	const generatedAt = Date.parse(after.generatedAt)
	if (
		generatedAt < Date.parse(invokedAfter) ||
		generatedAt > nowMs + MAX_FUTURE_SKEW_MS
	) {
		fail('First log soak heartbeat is outside its deployment invocation')
	}
	return after
}
const LOGROTATE_POLICY_PATH =
	'/etc/logrotate.d/winwidget-identity-avatar-client-log-soak'
const PUBLIC_BASE =
	'https://winwidget.ru/.well-known/winwidget/identity-avatar-client'

const fail = message => {
	throw new Error(message)
}

const assertExactKeys = (value, expected, label) => {
	if (
		!value ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		JSON.stringify(Object.keys(value)) !== JSON.stringify(expected)
	) {
		fail(`${label} has unexpected keys or key order`)
	}
}

const isCanonicalTimestamp = value => {
	return (
		typeof value === 'string' &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
		!Number.isNaN(Date.parse(value)) &&
		new Date(value).toISOString() === value
	)
}

const parseCanonicalJson = (raw, maxBytes, label) => {
	if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > maxBytes) {
		fail(`${label} size is outside its bound`)
	}
	const text = new TextDecoder('utf-8', { fatal: true }).decode(raw)
	let value
	try {
		value = JSON.parse(text)
	} catch {
		fail(`${label} is not valid JSON`)
	}
	if (JSON.stringify(value) !== text) {
		fail(`${label} is not canonical compact JSON`)
	}
	return value
}

const decimal = (value, label) => {
	if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
		fail(`${label} must be a canonical decimal string`)
	}
	return BigInt(value)
}

export const validateSoakEvidenceRaw = (
	raw,
	{
		expectedRevision,
		expectedReleaseSha,
		expectedProcessStartedAt,
		expectedLogConfigurationSha,
		expectedInitialAnchorSha = expectedReleaseSha,
		previousRaw,
		nowMs = Date.now()
	}
) => {
	const value = parseCanonicalJson(
		raw,
		MAX_EVIDENCE_BYTES,
		'Log soak evidence'
	)
	assertExactKeys(value, SOAK_KEYS, 'Log soak evidence')
	if (
		value.schemaVersion !== SCHEMA_VERSION ||
		value.kind !== SOAK_KIND ||
		value.clientRevision !== expectedRevision ||
		value.releaseEvidenceSha256 !== expectedReleaseSha ||
		value.processStartedAt !== expectedProcessStartedAt ||
		value.logConfigurationSha256 !== expectedLogConfigurationSha ||
		!SHA256_PATTERN.test(value.logConfigurationSha256) ||
		!REVISION_PATTERN.test(value.clientRevision) ||
		!SHA256_PATTERN.test(value.releaseEvidenceSha256) ||
		!isCanonicalTimestamp(value.processStartedAt) ||
		!Number.isSafeInteger(value.sequence) ||
		value.sequence < 1 ||
		value.sequence > MAX_JOURNAL_ENTRIES ||
		!SHA256_PATTERN.test(value.previousEvidenceSha256) ||
		!isCanonicalTimestamp(value.windowStartedAt) ||
		!isCanonicalTimestamp(value.windowEndedAt) ||
		value.generatedAt !== value.windowEndedAt ||
		!isCanonicalTimestamp(value.generatedAt) ||
		JSON.stringify(value.hosts) !== JSON.stringify(SOAK_HOSTS) ||
		value.probeClass !== 'soak-probe' ||
		!Number.isSafeInteger(value.probeRequestCount) ||
		value.probeRequestCount !== 1 ||
		!Number.isSafeInteger(value.apiV1FilesRequestCount) ||
		value.apiV1FilesRequestCount !== 0 ||
		!Number.isSafeInteger(value.uploadsGetHeadRequestCount) ||
		value.uploadsGetHeadRequestCount < 0 ||
		!Number.isSafeInteger(value.uploadsSuccessfulGetHeadCount) ||
		value.uploadsSuccessfulGetHeadCount !== 0 ||
		value.rotationContinuityPassed !== true ||
		value.futureSkewPassed !== true
	) {
		fail('Log soak evidence identity or counters are invalid')
	}
	const startedAt = Date.parse(value.windowStartedAt)
	const endedAt = Date.parse(value.windowEndedAt)
	if (
		startedAt < Date.parse(value.processStartedAt) ||
		endedAt <= startedAt ||
		endedAt - startedAt > MAX_WINDOW_MS ||
		endedAt > nowMs + MAX_FUTURE_SKEW_MS
	) {
		fail('Log soak evidence window is invalid')
	}
	if (
		!Array.isArray(value.logFiles) ||
		value.logFiles.length > MAX_LOG_FILES
	) {
		fail('Log soak evidence log file set is outside its bound')
	}
	let previousPathSha = ''
	let totalSliceBytes = 0n
	for (const file of value.logFiles) {
		assertExactKeys(file, LOG_FILE_KEYS, 'Log soak file')
		if (
			!SHA256_PATTERN.test(file.pathSha256) ||
			(previousPathSha && file.pathSha256 <= previousPathSha) ||
			!SHA256_PATTERN.test(file.sha256) ||
			!isCanonicalTimestamp(file.mtime)
		) {
			fail('Log soak file identity or ordering is invalid')
		}
		previousPathSha = file.pathSha256
		decimal(file.device, 'Log device')
		decimal(file.inode, 'Log inode')
		decimal(file.generation, 'Log generation')
		const first = decimal(file.firstByteOffset, 'Log firstByteOffset')
		const last = decimal(file.lastByteOffset, 'Log lastByteOffset')
		const bytes = decimal(file.bytes, 'Log bytes')
		totalSliceBytes += bytes
		if (
			last < first ||
			bytes !== last - first ||
			last > BigInt(MAX_LOG_FILE_BYTES) ||
			bytes > BigInt(MAX_LOG_SLICE_BYTES) ||
			totalSliceBytes > BigInt(MAX_LOG_SLICE_BYTES)
		) {
			fail('Log soak file uses inconsistent exclusive offsets')
		}
	}
	if (value.logSetSha256 !== sha256(JSON.stringify(value.logFiles))) {
		fail('Log soak evidence logSetSha256 is invalid')
	}
	if (previousRaw) {
		const previous = parseCanonicalJson(
			previousRaw,
			MAX_EVIDENCE_BYTES,
			'Previous log soak evidence'
		)
		if (
			value.sequence !== previous.sequence + 1 ||
			value.previousEvidenceSha256 !== sha256(previousRaw) ||
			value.windowStartedAt !== previous.windowEndedAt ||
			value.logConfigurationSha256 !== previous.logConfigurationSha256
		) {
			fail('Log soak evidence chain or window continuity is invalid')
		}
	} else if (
		value.sequence !== 1 ||
		value.previousEvidenceSha256 !== expectedInitialAnchorSha
	) {
		fail(
			'First log soak evidence must chain from the frozen initial anchor'
		)
	}
	return value
}

const verifySoakSignature = (body, signatureFile, publicKey, context) => {
	const signature = readSignature(signatureFile)
	if (!verify(null, body, publicKey, signature)) {
		fail(`${context} Ed25519 signature is invalid`)
	}
}

const canonicalBase64 = (value, label) => {
	if (typeof value !== 'string' || value.length === 0) {
		fail(`${label} must be canonical base64`)
	}
	const raw = Buffer.from(value, 'base64')
	if (raw.toString('base64') !== value)
		fail(`${label} must be canonical base64`)
	return raw
}

const isTrackedLogPath = (path, accessLogPath) => {
	if (path === accessLogPath) return true
	const escaped = basename(accessLogPath).replace(
		/[.*+?^${}()|[\]\\]/g,
		'\\$&'
	)
	return (
		dirname(path) === dirname(accessLogPath) &&
		new RegExp(`^${escaped}\\.[1-9][0-9]*$`).test(basename(path))
	)
}

const validateCursor = (cursor, accessLogPath = ACCESS_LOG_PATH) => {
	assertExactKeys(cursor, CURSOR_KEYS, 'Log cursor')
	if (
		typeof cursor.path !== 'string' ||
		!isTrackedLogPath(cursor.path, accessLogPath) ||
		resolve(cursor.path) !== cursor.path ||
		!isCanonicalTimestamp(cursor.mtime)
	) {
		fail('Log cursor path or mtime is invalid')
	}
	decimal(cursor.device, 'Cursor device')
	decimal(cursor.inode, 'Cursor inode')
	decimal(cursor.generation, 'Cursor generation')
	decimal(cursor.offset, 'Cursor offset')
	return cursor
}

const fsyncDirectory = path => {
	const descriptor = openSync(path, fsConstants.O_RDONLY)
	try {
		fsyncSync(descriptor)
	} finally {
		closeSync(descriptor)
	}
}

const assertPendingProbeBinding = (
	pending,
	{ revision, releaseSha, processStartedAt, sequence, windowStartedAt }
) => {
	if (
		pending.clientRevision !== revision ||
		pending.releaseEvidenceSha256 !== releaseSha ||
		pending.processStartedAt !== processStartedAt ||
		pending.sequence !== sequence ||
		pending.windowStartedAt !== windowStartedAt
	) {
		fail('Pending soak probe does not match the active release window')
	}
}

export const readPendingProbe = (
	path,
	{ expectedUid = 0, expectedGid = 0 } = {}
) => {
	if (!existsSync(path)) return null
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.uid !== expectedUid ||
		metadata.gid !== expectedGid ||
		(metadata.mode & 0o777) !== 0o600 ||
		metadata.size <= 0 ||
		metadata.size > 64 * 1024
	) {
		fail('Pending soak probe must be a root-owned 0600 regular file')
	}
	const value = parseCanonicalJson(
		readFileSync(path),
		64 * 1024,
		'Pending soak probe'
	)
	assertExactKeys(value, PENDING_PROBE_KEYS, 'Pending soak probe')
	if (
		value.schemaVersion !== SCHEMA_VERSION ||
		value.kind !== 'identity-avatar-client-log-soak-pending-probe' ||
		!REVISION_PATTERN.test(value.clientRevision) ||
		!SHA256_PATTERN.test(value.releaseEvidenceSha256) ||
		!isCanonicalTimestamp(value.processStartedAt) ||
		!Number.isSafeInteger(value.sequence) ||
		value.sequence < 1 ||
		value.sequence > MAX_JOURNAL_ENTRIES ||
		!isCanonicalTimestamp(value.windowStartedAt) ||
		!PROBE_ID_PATTERN.test(value.probeId)
	) {
		fail('Pending soak probe violates its frozen private schema')
	}
	return value
}

export const loadOrCreatePendingProbe = ({
	path,
	revision,
	releaseSha,
	processStartedAt,
	sequence,
	windowStartedAt,
	probeIdFactory = randomUUID,
	expectedUid = 0,
	expectedGid = 0
}) => {
	const existing = readPendingProbe(path, { expectedUid, expectedGid })
	if (existing) {
		assertPendingProbeBinding(existing, {
			revision,
			releaseSha,
			processStartedAt,
			sequence,
			windowStartedAt
		})
		return existing
	}
	const value = {
		schemaVersion: SCHEMA_VERSION,
		kind: 'identity-avatar-client-log-soak-pending-probe',
		clientRevision: revision,
		releaseEvidenceSha256: releaseSha,
		processStartedAt,
		sequence,
		windowStartedAt,
		probeId: probeIdFactory()
	}
	assertExactKeys(value, PENDING_PROBE_KEYS, 'Pending soak probe')
	if (!PROBE_ID_PATTERN.test(value.probeId)) {
		fail('Pending soak probe ID must be a canonical UUID v4')
	}
	atomicWrite(path, Buffer.from(JSON.stringify(value)), 0o600)
	const installed = readPendingProbe(path, { expectedUid, expectedGid })
	assertPendingProbeBinding(installed, {
		revision,
		releaseSha,
		processStartedAt,
		sequence,
		windowStartedAt
	})
	return installed
}

export const clearPendingProbe = (
	path,
	expected,
	{ expectedUid = 0, expectedGid = 0 } = {}
) => {
	const pending = readPendingProbe(path, { expectedUid, expectedGid })
	if (!pending) return
	assertPendingProbeBinding(pending, expected)
	rmSync(path)
	fsyncDirectory(dirname(path))
}

export const validateProbeAttempt = ({ statusCode, pending, records }) => {
	if (!pending || (statusCode !== 204 && statusCode !== 409)) {
		fail('Soak probe response is not bound to a pending probe')
	}
	const probeRecords = records.filter(
		record => record.pathClass === 'soak-probe'
	)
	if (
		probeRecords.length !== 1 ||
		probeRecords[0].host !== 'winwidget.ru' ||
		probeRecords[0].method !== 'GET' ||
		probeRecords[0].status !== 204
	) {
		fail('Soak probe must have exactly one prior GET 204 log record')
	}
}

const validateJournalRoot = (
	journalRoot,
	{ expectedUid = 0, expectedGid = 0 } = {}
) => {
	if (!existsSync(journalRoot)) {
		mkdirSync(journalRoot, { mode: 0o700 })
		fsyncDirectory(dirname(journalRoot))
	}
	const metadata = lstatSync(journalRoot)
	if (
		!metadata.isDirectory() ||
		metadata.isSymbolicLink() ||
		metadata.uid !== expectedUid ||
		metadata.gid !== expectedGid ||
		(metadata.mode & 0o777) !== 0o700
	) {
		fail('Log soak journal root must be a root-owned 0700 real directory')
	}
}

export const parseJournal = ({
	journalRoot,
	revision,
	releaseSha,
	processStartedAt,
	logConfigurationSha,
	initialAnchorSha = releaseSha,
	publicKey,
	accessLogPath = ACCESS_LOG_PATH,
	expectedUid = 0,
	expectedGid = 0
}) => {
	validateJournalRoot(journalRoot, { expectedUid, expectedGid })
	const names = readdirSync(journalRoot)
	for (const name of names) {
		if (/^\.entry-[0-9]{6}-v1\.prepared\.tmp-[0-9]+-[0-9]+$/.test(name)) {
			const path = join(journalRoot, name)
			const metadata = lstatSync(path)
			if (
				!metadata.isFile() ||
				metadata.isSymbolicLink() ||
				metadata.nlink !== 1 ||
				metadata.uid !== expectedUid ||
				metadata.gid !== expectedGid ||
				(metadata.mode & 0o777) !== 0o600
			) {
				fail('Crash-temporary journal entry is not a secure regular file')
			}
			rmSync(path)
		}
	}
	fsyncDirectory(journalRoot)
	const remainingNames = readdirSync(journalRoot)
	const finalNames = remainingNames
		.filter(name => /^entry-[0-9]{6}-v1\.json$/.test(name))
		.sort()
	const preparedNames = remainingNames.filter(name =>
		/^\.entry-[0-9]{6}-v1\.prepared$/.test(name)
	)
	const knownNames = new Set([...finalNames, ...preparedNames])
	if (
		remainingNames.some(name => !knownNames.has(name)) ||
		preparedNames.length > 1 ||
		finalNames.length + preparedNames.length > MAX_JOURNAL_ENTRIES
	) {
		fail('Log soak journal contains unexpected or excessive entries')
	}
	const orderedNames = [...finalNames, ...preparedNames]
	const entries = []
	let totalJournalBytes = 0
	let previousLine
	let previousBody
	for (const [index, name] of orderedNames.entries()) {
		const expectedSequence = index + 1
		const expectedFinalName = `entry-${String(expectedSequence).padStart(6, '0')}-v1.json`
		const expectedPreparedName = `.${expectedFinalName.slice(0, -5)}.prepared`
		if (name !== expectedFinalName && name !== expectedPreparedName) {
			fail('Log soak journal sequence has a gap')
		}
		if (name.startsWith('.') && index !== orderedNames.length - 1) {
			fail('Only the newest log soak journal entry may be prepared')
		}
		const path = join(journalRoot, name)
		const metadata = lstatSync(path)
		if (
			!metadata.isFile() ||
			metadata.isSymbolicLink() ||
			metadata.nlink !== 1 ||
			metadata.uid !== expectedUid ||
			metadata.gid !== expectedGid ||
			(metadata.mode & 0o777) !== 0o600 ||
			metadata.size <= 0 ||
			metadata.size > MAX_JOURNAL_BYTES
		) {
			fail('Log soak journal entry must be a root-owned 0600 regular file')
		}
		totalJournalBytes += Number(metadata.size)
		if (totalJournalBytes > MAX_JOURNAL_BYTES) {
			fail('Log soak journal aggregate exceeds its byte bound')
		}
		const lineRaw = readFileSync(path)
		const entry = parseCanonicalJson(
			lineRaw,
			MAX_EVIDENCE_BYTES * 2,
			'Journal entry'
		)
		assertExactKeys(entry, JOURNAL_KEYS, 'Journal entry')
		if (
			entry.schemaVersion !== SCHEMA_VERSION ||
			entry.kind !== 'identity-avatar-client-log-soak-journal' ||
			entry.clientRevision !== revision ||
			entry.sequence !== expectedSequence ||
			entry.previousJournalEntrySha256 !==
				(previousLine ? sha256(previousLine) : '0'.repeat(64)) ||
			!Array.isArray(entry.cursors) ||
			entry.cursors.length > MAX_LOG_FILES
		) {
			fail('Log soak journal chain is invalid')
		}
		let previousCursorPath = ''
		for (const cursor of entry.cursors) {
			validateCursor(cursor, accessLogPath)
			if (
				previousCursorPath &&
				Buffer.from(cursor.path).compare(
					Buffer.from(previousCursorPath)
				) <= 0
			) {
				fail('Log soak journal cursors are not bytewise sorted')
			}
			previousCursorPath = cursor.path
		}
		const body = canonicalBase64(entry.bodyBase64, 'Journal body')
		const signatureFile = canonicalBase64(
			entry.signatureFileBase64,
			'Journal signature file'
		)
		validateSoakEvidenceRaw(body, {
			expectedRevision: revision,
			expectedReleaseSha: releaseSha,
			expectedProcessStartedAt: processStartedAt,
			expectedLogConfigurationSha: logConfigurationSha,
			expectedInitialAnchorSha: initialAnchorSha,
			previousRaw: previousBody
		})
		verifySoakSignature(
			body,
			signatureFile,
			publicKey,
			'Journal heartbeat'
		)
		entries.push({ entry, lineRaw, body, signatureFile })
		previousLine = lineRaw
		previousBody = body
	}
	if (preparedNames.length === 1) {
		const preparedPath = join(journalRoot, preparedNames[0])
		const finalPath = join(
			journalRoot,
			`entry-${String(entries.at(-1).entry.sequence).padStart(6, '0')}-v1.json`
		)
		renameSync(preparedPath, finalPath)
		fsyncDirectory(journalRoot)
	}
	return entries
}

export const appendJournalEntry = (
	journalRoot,
	entry,
	{ expectedUid = 0, expectedGid = 0 } = {}
) => {
	validateJournalRoot(journalRoot, { expectedUid, expectedGid })
	if (
		!Number.isSafeInteger(entry.sequence) ||
		entry.sequence > MAX_JOURNAL_ENTRIES
	) {
		fail('Log soak journal reached the frozen maximum sequence')
	}
	const sequence = String(entry.sequence).padStart(6, '0')
	const prepared = join(journalRoot, `.entry-${sequence}-v1.prepared`)
	const final = join(journalRoot, `entry-${sequence}-v1.json`)
	const raw = Buffer.from(JSON.stringify(entry))
	if (raw.length > MAX_EVIDENCE_BYTES * 2) {
		fail('Log soak journal entry exceeds its byte bound')
	}
	if (existsSync(final)) {
		if (!readFileSync(final).equals(raw))
			fail('Immutable journal entry already differs')
		return
	}
	if (existsSync(prepared)) {
		if (!readFileSync(prepared).equals(raw))
			fail('Prepared journal entry already differs')
	} else {
		atomicWrite(prepared, raw, 0o600)
	}
	renameSync(prepared, final)
	fsyncDirectory(journalRoot)
}

const installExact = (path, raw, mode, immutable) => {
	if (immutable && existsSync(path)) {
		const existing = readBoundedRegularFile(
			path,
			MAX_EVIDENCE_BYTES,
			'Immutable soak artifact'
		)
		if (!existing.equals(raw))
			fail('Immutable soak artifact already differs')
		return
	}
	atomicWrite(path, raw, mode)
}

export const publishJournalEntry = (soakRoot, item) => {
	const sequence = String(item.entry.sequence).padStart(6, '0')
	installExact(
		join(soakRoot, `heartbeat-${sequence}-v1.json`),
		item.body,
		0o644,
		true
	)
	installExact(
		join(soakRoot, `heartbeat-${sequence}-v1.json.sig`),
		item.signatureFile,
		0o644,
		true
	)
	installExact(join(soakRoot, 'latest-v1.json'), item.body, 0o644, false)
	installExact(
		join(soakRoot, 'latest-v1.json.sig'),
		item.signatureFile,
		0o644,
		false
	)
}

export const prepareAccessLogFile = (
	path,
	{ expectedUid = 0, expectedGid = 0 } = {}
) => {
	const parent = dirname(path)
	const parentMetadata = lstatSync(parent)
	if (
		realpathSync(parent) !== resolve(parent) ||
		!parentMetadata.isDirectory() ||
		parentMetadata.isSymbolicLink() ||
		parentMetadata.uid !== expectedUid ||
		(parentMetadata.mode & 0o022) !== 0
	) {
		fail('Dedicated Nginx log parent is not secure')
	}
	let metadata
	try {
		metadata = lstatSync(path)
	} catch (error) {
		if (!error || error.code !== 'ENOENT') throw error
	}
	if (!metadata) {
		atomicWrite(path, Buffer.alloc(0), 0o600)
		metadata = lstatSync(path)
	}
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.uid !== expectedUid ||
		metadata.gid !== expectedGid ||
		(metadata.mode & 0o777) !== 0o600 ||
		metadata.size > MAX_LOG_FILE_BYTES
	) {
		fail('Dedicated Nginx log must be a root-owned 0600 regular file')
	}
}

const readInstalledConfiguration = path => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.uid !== 0 ||
		metadata.gid !== 0 ||
		(metadata.mode & 0o777) !== 0o644 ||
		metadata.size <= 0 ||
		metadata.size > 64 * 1024
	) {
		fail(
			'Installed log configuration must be a root-owned 0644 regular file'
		)
	}
	return readFileSync(path)
}

const readLogConfigurationSha = () => {
	const nginx = readInstalledConfiguration(NGINX_CONFIG_PATH)
	const logrotate = readInstalledConfiguration(LOGROTATE_POLICY_PATH)
	return sha256(Buffer.concat([nginx, Buffer.from([0]), logrotate]))
}

const requestHttps = (
	url,
	{
		expectedStatus,
		expectedStatuses,
		expectedRevision,
		expectedContentType,
		expectBody,
		connectHost,
		returnStatus = false
	}
) => {
	return new Promise((resolvePromise, rejectPromise) => {
		const parsed = new URL(url)
		const request = get(
			{
				protocol: 'https:',
				hostname: connectHost || parsed.hostname,
				port: parsed.port || 443,
				path: `${parsed.pathname}${parsed.search}`,
				servername: parsed.hostname,
				headers: connectHost ? { Host: parsed.host } : undefined,
				timeout: 15_000
			},
			response => {
				const chunks = []
				let bytes = 0
				response.on('data', chunk => {
					bytes += chunk.length
					if (bytes > MAX_EVIDENCE_BYTES) {
						request.destroy(
							new Error('HTTPS evidence response is too large')
						)
						return
					}
					chunks.push(chunk)
				})
				response.on('end', () => {
					if (
						(expectedStatuses
							? !expectedStatuses.includes(response.statusCode)
							: response.statusCode !== expectedStatus) ||
						response.headers.location ||
						response.headers['cache-control'] !== 'no-store, max-age=0' ||
						response.headers['x-winwidget-revision'] !==
							expectedRevision ||
						(expectedContentType !== undefined &&
							response.headers['content-type'] !== expectedContentType)
					) {
						rejectPromise(
							new Error(
								'Public soak endpoint status or cache headers are invalid'
							)
						)
						return
					}
					const body = expectBody ? Buffer.concat(chunks) : Buffer.alloc(0)
					resolvePromise(
						returnStatus ? { body, statusCode: response.statusCode } : body
					)
				})
			}
		)
		request.on('timeout', () =>
			request.destroy(new Error('HTTPS evidence request timed out'))
		)
		request.on('error', rejectPromise)
	})
}

export const validateStableSoakArtifactPair = ({
	firstBody,
	signatureFile,
	secondBody,
	expectedBody,
	expectedRevision,
	expectedReleaseSha,
	expectedProcessStartedAt,
	expectedLogConfigurationSha,
	expectedInitialAnchorSha = expectedReleaseSha,
	previousRaw,
	publicKey
}) => {
	if (!firstBody.equals(secondBody)) {
		fail('Mutable log soak body changed between signature fetches')
	}
	if (expectedBody && !firstBody.equals(expectedBody)) {
		fail('Public log soak body differs from the published journal entry')
	}
	const value = validateSoakEvidenceRaw(firstBody, {
		expectedRevision,
		expectedReleaseSha,
		expectedProcessStartedAt,
		expectedLogConfigurationSha,
		expectedInitialAnchorSha,
		previousRaw
	})
	verifySoakSignature(
		firstBody,
		signatureFile,
		publicKey,
		'Public log soak artifact'
	)
	if (Date.now() - Date.parse(value.generatedAt) > MAX_FRESHNESS_MS) {
		fail('Public log soak latest evidence is older than one hour')
	}
	return value
}

const fetchPublicSoakPair = async ({
	revision,
	artifact,
	expectedBody,
	releaseSha,
	processStartedAt,
	logConfigurationSha,
	initialAnchorSha = releaseSha,
	publicPath = 'soak',
	previousRaw,
	publicKey,
	retries
}) => {
	const bodyUrl = `${PUBLIC_BASE}/${revision}/${publicPath}/${artifact}`
	let lastError
	for (let attempt = 1; attempt <= retries; attempt += 1) {
		try {
			const firstBody = await requestHttps(bodyUrl, {
				expectedStatus: 200,
				expectedRevision: revision,
				expectedContentType: 'application/json; charset=utf-8',
				expectBody: true
			})
			const signatureFile = await requestHttps(`${bodyUrl}.sig`, {
				expectedStatus: 200,
				expectedRevision: revision,
				expectedContentType: 'application/octet-stream',
				expectBody: true
			})
			const secondBody = await requestHttps(bodyUrl, {
				expectedStatus: 200,
				expectedRevision: revision,
				expectedContentType: 'application/json; charset=utf-8',
				expectBody: true
			})
			return validateStableSoakArtifactPair({
				firstBody,
				signatureFile,
				secondBody,
				expectedBody,
				expectedRevision: revision,
				expectedReleaseSha: releaseSha,
				expectedProcessStartedAt: processStartedAt,
				expectedLogConfigurationSha: logConfigurationSha,
				expectedInitialAnchorSha: initialAnchorSha,
				previousRaw,
				publicKey
			})
		} catch (error) {
			lastError = error
			if (attempt < retries) {
				await new Promise(resolvePromise =>
					setTimeout(resolvePromise, 200)
				)
			}
		}
	}
	throw lastError
}

const verifyPublishedJournalEntry = async ({
	revision,
	item,
	releaseSha,
	processStartedAt,
	logConfigurationSha,
	initialAnchorSha = releaseSha,
	publicPath = 'soak',
	previousRaw,
	publicKey
}) => {
	const immutable = `heartbeat-${String(item.entry.sequence).padStart(6, '0')}-v1.json`
	await fetchPublicSoakPair({
		revision,
		artifact: immutable,
		expectedBody: item.body,
		releaseSha,
		processStartedAt,
		logConfigurationSha,
		initialAnchorSha,
		publicPath,
		previousRaw,
		publicKey,
		retries: 1
	})
	await fetchPublicSoakPair({
		revision,
		artifact: 'latest-v1.json',
		expectedBody: item.body,
		releaseSha,
		processStartedAt,
		logConfigurationSha,
		initialAnchorSha,
		publicPath,
		previousRaw,
		publicKey,
		retries: 5
	})
}

const enumerateLogs = (
	windowStartedAt,
	accessLogPath = ACCESS_LOG_PATH
) => {
	const directory = dirname(accessLogPath)
	const name = basename(accessLogPath)
	const candidates = []
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry)
		if (isTrackedLogPath(path, accessLogPath)) {
			candidates.push(join(directory, entry))
		} else if (entry.startsWith(`${name}.`)) {
			const metadata = lstatSync(path)
			if (Number(metadata.mtimeMs) >= Date.parse(windowStartedAt)) {
				fail(`Recent unbounded rotated access log is unsupported: ${path}`)
			}
		}
	}
	if (!candidates.includes(accessLogPath))
		fail('Dedicated Nginx access log is missing')
	if (candidates.length > MAX_LOG_FILES)
		fail('Dedicated access log set exceeds its bound')
	return candidates.sort((left, right) =>
		Buffer.from(left).compare(Buffer.from(right))
	)
}

const rotationIndex = (path, accessLogPath) => {
	if (path === accessLogPath) return 0
	return Number(basename(path).slice(basename(accessLogPath).length + 1))
}

export const collectLogWindow = ({
	previousCursors,
	windowStartedAt,
	windowEndedAt,
	accessLogPath = ACCESS_LOG_PATH,
	expectedUid = 0,
	expectedGid = 0,
	onPinned
}) => {
	const paths = enumerateLogs(windowStartedAt, accessLogPath)
	let current = paths.map(path => {
		const metadata = lstatSync(path, { bigint: true })
		if (
			!metadata.isFile() ||
			metadata.isSymbolicLink() ||
			metadata.nlink !== 1n ||
			metadata.uid !== BigInt(expectedUid) ||
			metadata.gid !== BigInt(expectedGid) ||
			(metadata.mode & 0o777n) !== 0o600n
		) {
			fail(`Nginx log is not a single-link regular file: ${path}`)
		}
		if (metadata.size > BigInt(MAX_LOG_FILE_BYTES))
			fail('Nginx access log exceeds its file bound')
		return { path, metadata }
	})
	for (const cursor of previousCursors)
		validateCursor(cursor, accessLogPath)
	const previousByInode = new Map(
		previousCursors.map(cursor => [
			`${cursor.device}:${cursor.inode}`,
			cursor
		])
	)
	const currentByInode = new Map(
		current.map(file => [
			`${file.metadata.dev.toString()}:${file.metadata.ino.toString()}`,
			file
		])
	)
	const previousActive = previousCursors.find(
		cursor => cursor.path === accessLogPath
	)
	if (previousCursors.length > 0 && !previousActive) {
		fail('Previous log window has no active Nginx cursor')
	}
	let rotationDepth = 0
	if (previousActive) {
		const activeContinuation = currentByInode.get(
			`${previousActive.device}:${previousActive.inode}`
		)
		if (!activeContinuation) {
			fail('Active Nginx access-log inode disappeared across rotation')
		}
		rotationDepth = rotationIndex(activeContinuation.path, accessLogPath)
		const currentPaths = new Set(current.map(file => file.path))
		for (let index = 0; index <= rotationDepth; index += 1) {
			const expected =
				index === 0 ? accessLogPath : `${accessLogPath}.${index}`
			if (!currentPaths.has(expected)) {
				fail('Nginx numeric rotation chain has a gap')
			}
		}
	}
	let maxGeneration = previousCursors.reduce(
		(maximum, cursor) =>
			BigInt(cursor.generation) > maximum
				? BigInt(cursor.generation)
				: maximum,
		0n
	)
	const firstWindow = previousCursors.length === 0
	current = current.filter(file => {
		if (
			file.path === accessLogPath ||
			previousByInode.has(`${file.metadata.dev}:${file.metadata.ino}`)
		) {
			return true
		}
		const index = rotationIndex(file.path, accessLogPath)
		if (
			(!firstWindow && index <= rotationDepth) ||
			Number(file.metadata.mtimeNs / 1_000_000n) >=
				Date.parse(windowStartedAt)
		) {
			return true
		}
		return false
	})
	const newFilesOldestFirst = current
		.filter(
			file =>
				!previousByInode.has(`${file.metadata.dev}:${file.metadata.ino}`)
		)
		.sort(
			(left, right) =>
				rotationIndex(right.path, accessLogPath) -
				rotationIndex(left.path, accessLogPath)
		)
	const generationByInode = new Map()
	for (const file of newFilesOldestFirst) {
		maxGeneration += 1n
		generationByInode.set(
			`${file.metadata.dev}:${file.metadata.ino}`,
			maxGeneration
		)
	}
	const slices = []
	const cursors = []
	const records = []
	let totalSliceBytes = 0
	for (const file of current) {
		const identity = `${file.metadata.dev.toString()}:${file.metadata.ino.toString()}`
		const previous = previousByInode.get(identity)
		const generation = previous
			? BigInt(previous.generation)
			: generationByInode.get(identity)
		if (generation === undefined)
			fail('Nginx log generation was not assigned')
		const first = previous ? BigInt(previous.offset) : 0n
		const pinnedEnd = file.metadata.size
		if (first > pinnedEnd)
			fail('Nginx access log was truncated without a rotation boundary')
		const pinnedByteCount = pinnedEnd - first
		if (pinnedByteCount > BigInt(MAX_LOG_SLICE_BYTES))
			fail('Nginx log slice exceeds its byte bound')
		totalSliceBytes += Number(pinnedByteCount)
		if (totalSliceBytes > MAX_LOG_SLICE_BYTES)
			fail('Nginx log window exceeds its total byte bound')
		if (onPinned) onPinned({ path: file.path, first, pinnedEnd })
		let descriptor
		let content = Buffer.alloc(0)
		try {
			descriptor = openSync(
				file.path,
				fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
			)
			const before = fstatSync(descriptor, { bigint: true })
			if (
				before.dev !== file.metadata.dev ||
				before.ino !== file.metadata.ino ||
				before.size < pinnedEnd
			) {
				fail(
					'Nginx log inode changed or truncated before its bounded read'
				)
			}
			if (pinnedByteCount > 0n) {
				content = Buffer.alloc(Number(pinnedByteCount))
				let bytesRead = 0
				while (bytesRead < content.length) {
					const count = readSync(
						descriptor,
						content,
						bytesRead,
						content.length - bytesRead,
						Number(first) + bytesRead
					)
					if (count === 0) fail('Nginx log bounded read was incomplete')
					bytesRead += count
				}
			}
			const after = fstatSync(descriptor, { bigint: true })
			if (
				before.dev !== after.dev ||
				before.ino !== after.ino ||
				after.size < pinnedEnd
			) {
				fail(
					'Nginx log inode changed or truncated during its bounded read'
				)
			}
		} finally {
			if (descriptor !== undefined) closeSync(descriptor)
		}
		const lastNewline = content.lastIndexOf(0x0a)
		const boundedContent =
			lastNewline === -1
				? Buffer.alloc(0)
				: content.subarray(0, lastNewline + 1)
		const last = first + BigInt(boundedContent.length)
		const mtime = new Date(
			Number(file.metadata.mtimeNs / 1_000_000n)
		).toISOString()
		const parsedRecords = []
		if (boundedContent.length > 0) {
			let lineStart = 0
			for (
				let newline = boundedContent.indexOf(0x0a);
				newline >= 0;
				newline = boundedContent.indexOf(0x0a, lineStart)
			) {
				const line = new TextDecoder('utf-8', { fatal: true }).decode(
					boundedContent.subarray(lineStart, newline)
				)
				let record
				try {
					record = JSON.parse(line)
				} catch {
					fail('Nginx access log contains malformed JSON')
				}
				assertExactKeys(record, NGINX_LOG_KEYS, 'Nginx log record')
				if (
					!record ||
					!SOAK_HOSTS.includes(record.host) ||
					!['api-v1-files', 'uploads', 'soak-probe'].includes(
						record.pathClass
					) ||
					typeof record.method !== 'string' ||
					!Number.isInteger(record.status) ||
					record.status < 100 ||
					record.status > 599 ||
					Number.isNaN(Date.parse(record.timestamp)) ||
					Date.parse(record.timestamp) < Date.parse(windowStartedAt) ||
					Date.parse(record.timestamp) > Date.parse(windowEndedAt)
				) {
					fail(
						'Nginx access log record is outside the exact signed window'
					)
				}
				parsedRecords.push({ record, lineStart })
				lineStart = newline + 1
			}
		}
		records.push(...parsedRecords.map(item => item.record))
		const byteCount = last - first
		if (boundedContent.length > 0) {
			slices.push({
				pathSha256: sha256(file.path),
				device: file.metadata.dev.toString(),
				inode: file.metadata.ino.toString(),
				generation: generation.toString(),
				firstByteOffset: first.toString(),
				lastByteOffset: last.toString(),
				bytes: byteCount.toString(),
				sha256: sha256(boundedContent),
				mtime
			})
		}
		cursors.push({
			path: file.path,
			device: file.metadata.dev.toString(),
			inode: file.metadata.ino.toString(),
			generation: generation.toString(),
			offset: last.toString(),
			mtime
		})
	}
	slices.sort((left, right) =>
		left.pathSha256 < right.pathSha256
			? -1
			: left.pathSha256 > right.pathSha256
				? 1
				: 0
	)
	for (let index = 1; index < slices.length; index += 1) {
		if (slices[index - 1].pathSha256 === slices[index].pathSha256) {
			fail('Nginx log path hash collision detected')
		}
	}
	cursors.sort((left, right) =>
		Buffer.from(left.path).compare(Buffer.from(right.path))
	)
	return { slices, cursors, records }
}

export const buildHeartbeat = ({
	revision,
	releaseSha,
	processStartedAt,
	logConfigurationSha,
	sequence,
	initialAnchorSha = releaseSha,
	previousBody,
	windowStartedAt,
	windowEndedAt,
	logWindow
}) => {
	let probeRequestCount = 0
	let apiV1FilesRequestCount = 0
	let uploadsGetHeadRequestCount = 0
	let uploadsSuccessfulGetHeadCount = 0
	const startMs = Date.parse(windowStartedAt)
	const endMs = Date.parse(windowEndedAt)
	for (const record of logWindow.records) {
		const timestamp = Date.parse(record.timestamp)
		if (timestamp < startMs || timestamp > endMs) {
			fail('Nginx access log record is outside the heartbeat window')
		}
		if (record.pathClass === 'soak-probe') {
			if (
				record.host !== 'winwidget.ru' ||
				record.method !== 'GET' ||
				record.status !== 204
			) {
				fail('Soak probe log record must be exact GET 204')
			}
			probeRequestCount += 1
		}
		if (record.pathClass === 'api-v1-files') apiV1FilesRequestCount += 1
		if (
			record.pathClass === 'uploads' &&
			(record.method === 'GET' || record.method === 'HEAD')
		) {
			uploadsGetHeadRequestCount += 1
			if (record.status >= 200 && record.status <= 399) {
				uploadsSuccessfulGetHeadCount += 1
			}
		}
	}
	const value = {
		schemaVersion: SCHEMA_VERSION,
		kind: SOAK_KIND,
		clientRevision: revision,
		releaseEvidenceSha256: releaseSha,
		processStartedAt,
		logConfigurationSha256: logConfigurationSha,
		sequence,
		previousEvidenceSha256: previousBody
			? sha256(previousBody)
			: initialAnchorSha,
		windowStartedAt,
		windowEndedAt,
		hosts: SOAK_HOSTS,
		probeClass: 'soak-probe',
		probeRequestCount,
		logFiles: logWindow.slices,
		logSetSha256: sha256(JSON.stringify(logWindow.slices)),
		apiV1FilesRequestCount,
		uploadsGetHeadRequestCount,
		uploadsSuccessfulGetHeadCount,
		rotationContinuityPassed: true,
		futureSkewPassed: true,
		generatedAt: windowEndedAt
	}
	const raw = Buffer.from(JSON.stringify(value))
	validateSoakEvidenceRaw(raw, {
		expectedRevision: revision,
		expectedReleaseSha: releaseSha,
		expectedProcessStartedAt: processStartedAt,
		expectedLogConfigurationSha: logConfigurationSha,
		expectedInitialAnchorSha: initialAnchorSha,
		previousRaw: previousBody
	})
	return raw
}

const heartbeat = async ({
	revision,
	releaseSha,
	processStartedAt,
	minimumSequence,
	generation,
	initialAnchorSha = releaseSha
}) => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Log soak producer must run as root')
	}
	if (
		process.env.IDENTITY_AVATAR_SOAK_LOCK_HELD !== '1' ||
		!REVISION_PATTERN.test(revision) ||
		!SHA256_PATTERN.test(releaseSha) ||
		!SHA256_PATTERN.test(initialAnchorSha) ||
		!isCanonicalTimestamp(processStartedAt) ||
		(minimumSequence !== undefined &&
			(!Number.isSafeInteger(minimumSequence) ||
				minimumSequence < 1 ||
				minimumSequence > MAX_JOURNAL_ENTRIES))
	) {
		fail('Log soak producer lock or release identity is invalid')
	}
	provisionSigningKeyPair(SIGNING_PRIVATE, SIGNING_PUBLIC)
	const revisionRoot = join(RELEASE_ROOT, revision)
	const { root: soakRoot, publicPath } = resolveSoakLocation(
		revision,
		generation
	)
	mkdirSync(soakRoot, { recursive: true, mode: 0o755 })
	const rootMetadata = lstatSync(soakRoot)
	if (
		!rootMetadata.isDirectory() ||
		rootMetadata.isSymbolicLink() ||
		rootMetadata.uid !== 0 ||
		rootMetadata.gid !== 0 ||
		(rootMetadata.mode & 0o022) !== 0
	) {
		fail('Log soak artifact directory is not secure')
	}
	const manifest = readBoundedRegularFile(
		join(revisionRoot, 'release-evidence-v1.json'),
		16 * 1024 * 1024,
		'Release evidence'
	)
	const releaseSignature = readBoundedRegularFile(
		join(revisionRoot, 'release-evidence-v1.json.sig'),
		1024,
		'Release signature'
	)
	validateReleaseEvidenceRaw(manifest, revision)
	if (sha256(manifest) !== releaseSha)
		fail('Log soak release hash does not match the artifact')
	const publicKey = readEd25519PublicKey(SIGNING_PUBLIC)
	verifySoakSignature(
		manifest,
		releaseSignature,
		publicKey,
		'Release evidence'
	)
	const runtime = await requestHttps(`${PUBLIC_BASE}/runtime-v1.json`, {
		expectedStatus: 200,
		expectedRevision: revision,
		expectedContentType: 'application/json; charset=utf-8',
		expectBody: true
	})
	validateRuntimeEvidenceRaw(runtime, {
		expectedRevision: revision,
		releaseManifestRaw: manifest,
		releaseSignatureRaw: releaseSignature
	})
	const runtimeValue = JSON.parse(runtime.toString('utf8'))
	if (runtimeValue.processStartedAt !== processStartedAt) {
		fail('Frontend process restarted during the log soak window')
	}
	const logConfigurationSha = readLogConfigurationSha()

	const journalRoot = join(soakRoot, '.journal-v1')
	const entries = parseJournal({
		journalRoot,
		revision,
		releaseSha,
		processStartedAt,
		logConfigurationSha,
		initialAnchorSha,
		publicKey
	})
	const previous = entries.at(-1)
	const pendingProbePath = join(soakRoot, '.probe-pending-v1.json')
	let pendingProbe = readPendingProbe(pendingProbePath)
	if (previous) {
		publishJournalEntry(soakRoot, previous)
		if (pendingProbe?.sequence === previous.entry.sequence) {
			const previousValue = JSON.parse(previous.body.toString('utf8'))
			clearPendingProbe(pendingProbePath, {
				revision,
				releaseSha,
				processStartedAt,
				sequence: previous.entry.sequence,
				windowStartedAt: previousValue.windowStartedAt
			})
			pendingProbe = null
		}
	}
	if (pendingProbe && pendingProbe.sequence !== entries.length + 1) {
		fail('Pending soak probe does not match the next journal sequence')
	}
	if (minimumSequence !== undefined) {
		if (previous?.entry.sequence === minimumSequence) {
			await verifyPublishedJournalEntry({
				revision,
				item: previous,
				releaseSha,
				processStartedAt,
				logConfigurationSha,
				initialAnchorSha,
				publicPath,
				previousRaw: entries.at(-2)?.body,
				publicKey
			})
			return
		}
		if (entries.length + 1 !== minimumSequence) {
			fail('Required log soak heartbeat sequence is not the next entry')
		}
	}
	if (
		previous &&
		!pendingProbe &&
		minimumSequence === undefined &&
		Date.now() -
			Date.parse(
				JSON.parse(previous.body.toString('utf8')).windowEndedAt
			) <
			MIN_HEARTBEAT_INTERVAL_MS
	) {
		await verifyPublishedJournalEntry({
			revision,
			item: previous,
			releaseSha,
			processStartedAt,
			logConfigurationSha,
			initialAnchorSha,
			publicPath,
			previousRaw: entries.at(-2)?.body,
			publicKey
		})
		return
	}
	if (entries.length >= MAX_JOURNAL_ENTRIES) {
		fail('Log soak heartbeat reached the frozen maximum sequence of 64')
	}
	const sequence = entries.length + 1
	const windowStartedAt = previous
		? JSON.parse(previous.body.toString('utf8')).windowEndedAt
		: processStartedAt
	if (Date.now() - Date.parse(windowStartedAt) > MAX_WINDOW_MS) {
		fail('Log soak heartbeat gap exceeds 26 hours')
	}

	pendingProbe = loadOrCreatePendingProbe({
		path: pendingProbePath,
		revision,
		releaseSha,
		processStartedAt,
		sequence,
		windowStartedAt
	})
	const probePath = `/.well-known/winwidget/identity-avatar-client/soak-probe/${revision}/${pendingProbe.probeId}`
	const probeResponse = await requestHttps(
		`https://winwidget.ru${probePath}`,
		{
			expectedStatuses: [204, 409],
			expectedRevision: revision,
			connectHost: '127.0.0.1',
			expectBody: false,
			returnStatus: true
		}
	)

	let logWindow
	let windowEndedAt
	for (let attempt = 1; attempt <= 10; attempt += 1) {
		windowEndedAt = new Date().toISOString()
		logWindow = collectLogWindow({
			previousCursors: previous?.entry.cursors || [],
			windowStartedAt,
			windowEndedAt
		})
		if (
			logWindow.records.filter(record => record.pathClass === 'soak-probe')
				.length > 0
		) {
			break
		}
		if (attempt === 10)
			fail(
				'Harmless soak probe did not appear exactly in Nginx access log'
			)
		await new Promise(resolvePromise => setTimeout(resolvePromise, 1000))
	}
	validateProbeAttempt({
		statusCode: probeResponse.statusCode,
		pending: pendingProbe,
		records: logWindow.records
	})
	const body = buildHeartbeat({
		revision,
		releaseSha,
		processStartedAt,
		logConfigurationSha,
		sequence,
		previousBody: previous?.body,
		windowStartedAt,
		windowEndedAt,
		logWindow,
		initialAnchorSha
	})
	const privateKey = readEd25519PrivateKey(SIGNING_PRIVATE)
	const signature = sign(null, body, privateKey)
	const signatureFile = Buffer.from(`${signature.toString('base64')}\n`)
	verifySoakSignature(
		body,
		signatureFile,
		publicKey,
		'New log soak heartbeat'
	)
	const entry = {
		schemaVersion: SCHEMA_VERSION,
		kind: 'identity-avatar-client-log-soak-journal',
		clientRevision: revision,
		sequence,
		previousJournalEntrySha256: previous
			? sha256(previous.lineRaw)
			: '0'.repeat(64),
		bodyBase64: body.toString('base64'),
		signatureFileBase64: signatureFile.toString('base64'),
		cursors: logWindow.cursors
	}
	appendJournalEntry(journalRoot, entry)
	const item = { entry, body, signatureFile }
	publishJournalEntry(soakRoot, item)
	clearPendingProbe(pendingProbePath, {
		revision,
		releaseSha,
		processStartedAt,
		sequence,
		windowStartedAt
	})
	await verifyPublishedJournalEntry({
		revision,
		item,
		releaseSha,
		processStartedAt,
		logConfigurationSha,
		initialAnchorSha,
		publicPath,
		previousRaw: previous?.body,
		publicKey
	})
}

const parseArguments = args => {
	const options = {}
	for (let index = 0; index < args.length; index += 2) {
		const key = args[index]
		const value = args[index + 1]
		if (
			!key?.startsWith('--') ||
			value === undefined ||
			value.startsWith('--')
		) {
			fail('Every log soak option must use --name value form')
		}
		const name = key.slice(2)
		if (name in options) fail(`Duplicate log soak option: ${key}`)
		options[name] = value
	}
	return options
}

const main = async () => {
	const [command, ...args] = process.argv.slice(2)
	const options = parseArguments(args)
	if (command === 'prepare-access-log') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options)) !== JSON.stringify(['path']) ||
			options.path !== ACCESS_LOG_PATH
		) {
			fail(
				'Access-log preparation requires root and the frozen exact path'
			)
		}
		prepareAccessLogFile(options.path)
		return
	}
	if (command === 'heartbeat') {
		const generationOptions = options.generation
			? ['generation', 'initial-anchor-sha']
			: []
		const expectedKeys = [
			...(options['minimum-sequence'] ? ['minimum-sequence'] : []),
			...generationOptions,
			'process-started-at',
			'release-sha',
			'revision'
		].sort()
		if (
			JSON.stringify(Object.keys(options).sort()) !==
			JSON.stringify(expectedKeys)
		) {
			fail(
				'Log soak heartbeat requires revision, release-sha and process-started-at'
			)
		}
		await heartbeat({
			revision: options.revision,
			releaseSha: options['release-sha'],
			processStartedAt: options['process-started-at'],
			minimumSequence: options['minimum-sequence']
				? Number(options['minimum-sequence'])
				: undefined,
			generation: options.generation
				? Number(options.generation)
				: undefined,
			initialAnchorSha:
				options['initial-anchor-sha'] || options['release-sha']
		})
		return
	}
	if (command === 'checkpoint') {
		const generationOptions = options.generation
			? ['generation', 'initial-anchor-sha']
			: []
		if (
			JSON.stringify(Object.keys(options).sort()) !==
			JSON.stringify(
				[
					...generationOptions,
					'process-started-at',
					'release-sha',
					'revision'
				].sort()
			)
		) {
			fail(
				'Log soak checkpoint requires revision, release-sha and process-started-at'
			)
		}
		const checkpoint = heartbeatCheckpoint({
			revision: options.revision,
			releaseSha: options['release-sha'],
			processStartedAt: options['process-started-at'],
			generation: options.generation
				? Number(options.generation)
				: undefined,
			initialAnchorSha:
				options['initial-anchor-sha'] || options['release-sha']
		})
		process.stdout.write(
			`${checkpoint.sequence}\t${checkpoint.bodySha256}\t${checkpoint.generatedAt ?? 'absent'}\n`
		)
		return
	}
	if (command === 'verify-fresh-heartbeat') {
		const generationOptions = options.generation
			? ['generation', 'initial-anchor-sha']
			: []
		if (
			JSON.stringify(Object.keys(options).sort()) !==
			JSON.stringify(
				[
					'before-body-sha',
					'before-sequence',
					...generationOptions,
					'invoked-after',
					'process-started-at',
					'release-sha',
					'revision'
				].sort()
			)
		) {
			fail('Fresh log soak heartbeat verification options are invalid')
		}
		const checkpoint = heartbeatCheckpoint({
			revision: options.revision,
			releaseSha: options['release-sha'],
			processStartedAt: options['process-started-at'],
			generation: options.generation
				? Number(options.generation)
				: undefined,
			initialAnchorSha:
				options['initial-anchor-sha'] || options['release-sha']
		})
		validateFreshHeartbeatCheckpoint({
			beforeSequence: Number(options['before-sequence']),
			beforeBodySha256: options['before-body-sha'],
			after: checkpoint,
			invokedAfter: options['invoked-after']
		})
		process.stdout.write(
			`${checkpoint.sequence}\t${checkpoint.bodySha256}\t${checkpoint.generatedAt}\n`
		)
		return
	}
	fail('Unknown identity avatar client log soak command')
}

if (
	resolve(process.argv[1] || '') ===
	resolve(new URL(import.meta.url).pathname)
) {
	main().catch(error => {
		console.error(
			error instanceof Error ? error.message : 'Log soak producer failed'
		)
		process.exitCode = 1
	})
}
