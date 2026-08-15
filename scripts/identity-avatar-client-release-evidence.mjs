#!/usr/bin/env node

import {
	constants as fsConstants,
	chmodSync,
	closeSync,
	copyFileSync,
	existsSync,
	fstatSync,
	fsyncSync,
	linkSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync
} from 'node:fs'
import {
	createHash,
	createPrivateKey,
	createPublicKey,
	generateKeyPairSync,
	sign,
	verify
} from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, join, posix, resolve, sep } from 'node:path'
import { TextDecoder } from 'node:util'

export const RELEASE_SCHEMA_VERSION = 1
export const RELEASE_KIND = 'identity-avatar-client-release'
export const FULL_MANIFEST_KIND =
	'identity-avatar-client-release-full-manifest'
export const RUNTIME_KIND = 'identity-avatar-client-runtime'
export const BACKEND_CLIENT_READY_KIND = 'identity-avatar-client-ready'
export const BACKEND_CLEANUP_COMPLETE_KIND =
	'identity-avatar-core-cleanup-complete'
export const BACKEND_TRUST_BOOTSTRAP_KIND =
	'identity-avatar-backend-trust-bootstrap'
export const CLIENT_SWITCH_RECEIPT_KIND =
	'identity-avatar-client-switch-receipt'
export const CLIENT_CLEANUP_FINALIZATION_KIND =
	'identity-avatar-client-cleanup-finalization'
export const CLIENT_CLEANUP_RETIRED_STATE_CONTRACT =
	'v1:units=not-found,inactive,not-found;paths=service,timer,nginx,logrotate,lock:absent;nginx=reloaded-active'
export const BACKEND_SIGNING_TRANSFER_PUBLIC_KEY =
	'/opt/winwidget/deploy/frontend/.identity-avatar-backend-signing.transfer.public.pem'
export const BACKEND_SIGNING_PUBLIC_KEY =
	'/opt/winwidget/deploy/frontend/.identity-avatar-backend-signing.public.pem'
export const BACKEND_TRUST_BOOTSTRAP_EVIDENCE =
	'/opt/winwidget/deploy/frontend/.identity-avatar-backend-trust-bootstrap-v1.json'
export const CLIENT_SWITCH_RECEIPT_PATH =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-switch-v1.json'
export const CLIENT_CLEANUP_FINALIZATION_PATH =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-cleanup-finalized-v1.json'
export const CLIENT_CLEANUP_FINALIZATION_SIGNATURE_PATH = `${CLIENT_CLEANUP_FINALIZATION_PATH}.sig`
export const CLIENT_RELEASE_EVIDENCE_ROOT =
	'/opt/winwidget/deploy/frontend/identity-avatar-client-release'
export const BACKEND_CLEANUP_COMPLETE_URL =
	'https://api.winwidget.ru/.well-known/winwidget/identity-avatar-media/cleanup-complete-v1.json'
export const FRONTEND_SIGNING_PRIVATE_KEY =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-signing.private.pem'
export const FRONTEND_SIGNING_PUBLIC_KEY =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-signing.public.pem'
export const SCAN_ROOTS = [
	'.next/server',
	'.next/standalone',
	'.next/static'
]
export const RELEASE_CHECKS = [
	'full-next-server-tree-scanned',
	'full-next-standalone-tree-scanned',
	'full-next-static-tree-scanned',
	'legacy-api-v1-files-absent',
	'legacy-uploads-absent',
	'migration-credential-identifiers-absent',
	'identity-profile-avatar-api-present',
	'identity-admin-avatar-api-present'
]

const RELEASE_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'nextBuildId',
	'scanRoots',
	'fileCount',
	'totalBytes',
	'treeSha256',
	'checks',
	'fullManifestSha256',
	'generatedAt'
]
const FULL_MANIFEST_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'nextBuildId',
	'scanRoots',
	'files',
	'fileCount',
	'totalBytes',
	'treeSha256',
	'checks',
	'generatedAt'
]
const FILE_KEYS = ['path', 'bytes', 'sha256']
const RUNTIME_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'processStartedAt',
	'releaseEvidenceSha256',
	'releaseEvidenceSignatureSha256'
]
const IMAGE_ADOPTION_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'imageId',
	'fullManifestSha256',
	'releaseEvidenceSha256'
]
const BACKEND_DEPLOYMENT_HEALTH_KEYS = ['service', 'revision']
const BACKEND_CLIENT_READY_KEYS = [
	'schemaVersion',
	'kind',
	'serverRevision',
	'ownershipPhase',
	'identityDatabaseId',
	'writerFenceEvidenceSha256',
	'storagePolicyEvidenceSha256',
	'uploadsSnapshotEvidenceSha256',
	'inventoryManifestSha256',
	'migrationManifestSha256',
	'statusManifestSha256',
	'revocationEvidenceSha256',
	'authenticatedSmokeEvidenceSha256',
	'referenceZeroEvidenceSha256',
	'legacyReferenceMatches',
	'legacyFileWriterFenced',
	'ownershipActivatedAt',
	'generatedAt',
	'expiresAt'
]
const BACKEND_CLIENT_READY_HASH_KEYS = [
	'writerFenceEvidenceSha256',
	'storagePolicyEvidenceSha256',
	'uploadsSnapshotEvidenceSha256',
	'inventoryManifestSha256',
	'migrationManifestSha256',
	'statusManifestSha256',
	'revocationEvidenceSha256',
	'authenticatedSmokeEvidenceSha256',
	'referenceZeroEvidenceSha256'
]
const BACKEND_CLEANUP_COMPLETE_KEYS = [
	'schemaVersion',
	'kind',
	'cleanupPhase',
	'ownershipRevision',
	'currentRuntimeRevision',
	'cleanupRevision',
	'initialClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'ownershipMarkerSha256',
	'runtimeStabilityCurrentEvidenceSha256',
	'runtimeStabilityCurrentEvidenceSignatureSha256',
	'runtimeStabilityGeneration',
	'runtimeStabilityEvidenceSha256',
	'runtimeStabilityLedgerGeneration',
	'runtimeStabilityLedgerTailState',
	'runtimeStabilityLedgerTailEvidenceSha256',
	'runtimeStableSince',
	'currentClientBindingEvidenceSha256',
	'runtimeRetargetEvidenceSha256',
	'clientRetargetEvidenceSha256',
	'frontendBinding',
	'clientReadyEvidenceSha256',
	'clientReadyEvidenceSignatureSha256',
	'clientSwitchEvidenceSha256',
	'soakEvidenceSha256',
	'preClientReferenceZeroEvidenceSha256',
	'predeployUploadsHandoffSha256',
	'cleanupRetargetEvidenceSha256',
	'cleanupReferenceZeroEvidenceSha256',
	'writerFenceEvidenceSha256',
	'retirementEvidenceSha256',
	'retirementConsumerRecoveryEvidenceCount',
	'retirementConsumerRecoveryEvidenceAggregateSha256',
	'revocationEvidenceSha256',
	'nginxEvidenceSha256',
	'smokeEvidenceSha256',
	'coreCleanupImageId',
	'legacyReferencesAbsent',
	'legacyRoutesAbsent',
	'legacyObjectsRetired',
	'ownershipActive',
	'completedAt'
]
const BACKEND_CLEANUP_FRONTEND_BINDING_KEYS = [
	'bindingKind',
	'evidenceSha256',
	'evidenceSignatureSha256',
	'clientRevision',
	'imageId',
	'releaseEvidenceSha256',
	'releaseEvidenceSignatureSha256',
	'releaseTreeSha256',
	'releaseFullManifestSha256',
	'processStartedAt'
]
const BACKEND_CLEANUP_HASH_KEYS = [
	'ownershipMarkerSha256',
	'runtimeStabilityCurrentEvidenceSha256',
	'runtimeStabilityCurrentEvidenceSignatureSha256',
	'runtimeStabilityEvidenceSha256',
	'runtimeStabilityLedgerTailEvidenceSha256',
	'currentClientBindingEvidenceSha256',
	'clientReadyEvidenceSha256',
	'clientReadyEvidenceSignatureSha256',
	'clientSwitchEvidenceSha256',
	'soakEvidenceSha256',
	'preClientReferenceZeroEvidenceSha256',
	'predeployUploadsHandoffSha256',
	'cleanupRetargetEvidenceSha256',
	'cleanupReferenceZeroEvidenceSha256',
	'writerFenceEvidenceSha256',
	'retirementEvidenceSha256',
	'retirementConsumerRecoveryEvidenceAggregateSha256',
	'revocationEvidenceSha256',
	'nginxEvidenceSha256',
	'smokeEvidenceSha256'
]
const BACKEND_TRUST_BOOTSTRAP_KEYS = [
	'version',
	'kind',
	'clientRevision',
	'sourcePathSha256',
	'sourcePublicKeySha256',
	'destinationPath',
	'destinationPublicKeySha256',
	'publicKeySpkiSha256',
	'installedAt',
	'signature'
]
const BACKEND_TRUST_BOOTSTRAP_PAYLOAD_KEYS =
	BACKEND_TRUST_BOOTSTRAP_KEYS.slice(0, -1)
const CLIENT_SWITCH_RECEIPT_KEYS = [
	'version',
	'kind',
	'state',
	'initialClientRevision',
	'initialReleaseEvidenceSha256',
	'backendServerRevision',
	'identityDatabaseId',
	'clientReadySha256',
	'clientReadySignatureSha256',
	'backendSigningPublicKeySha256',
	'clientProcessStartedAt',
	'soakPinnedAt',
	'cleanupRevision',
	'cleanupClientRevision',
	'cleanupCompleteSha256',
	'cleanupCompleteSignatureSha256',
	'releasedAt',
	'signature'
]
const CLIENT_SWITCH_RECEIPT_PAYLOAD_KEYS =
	CLIENT_SWITCH_RECEIPT_KEYS.slice(0, -1)
const CLIENT_CLEANUP_FINALIZATION_KEYS = [
	'version',
	'kind',
	'state',
	'cleanupRevision',
	'cleanupClientRevision',
	'clientSwitchReceiptSha256',
	'cleanupCompleteSha256',
	'cleanupCompleteSignatureSha256',
	'retiredStateContractSha256'
]
const REVISION_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const BUILD_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/
const MAX_FILE_COUNT = 20_000
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024
const MAX_KEY_BYTES = 64 * 1024
const BACKEND_READY_MAX_BYTES = 64 * 1024
const BACKEND_READY_VALIDITY_MS = 2 * 60 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000
const CLEANUP_REQUIRED_SOAK_MS = 7 * 24 * 60 * 60 * 1000
const MAX_RUNTIME_STABILITY_GENERATION = 64
const FORBIDDEN_CONTENT = [
	'/api/v1/files',
	'/uploads/',
	'IDENTITY_AVATAR_MIGRATION_',
	'IDENTITY_AVATAR_RETIREMENT_'
]
const LEGACY_RELATIVE_FILE_ENDPOINT_PATTERN = /["'`]\/files["'`]/
const LEGACY_FILE_QUERY_SHAPE_PATTERN =
	/(?:["'`])?(?:folder|filePath)(?:["'`])?\s*:/
const PROFILE_AVATAR_REFERENCE = '/profile/avatar'
const ADMIN_USER_REFERENCE = '/user/'
const ADMIN_AVATAR_REFERENCE = '/avatar'
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

const fail = message => {
	throw new Error(message)
}

const pathEntryExists = path => {
	try {
		lstatSync(path)
		return true
	} catch (error) {
		if (error?.code === 'ENOENT') return false
		throw error
	}
}

export const sha256 = value =>
	createHash('sha256').update(value).digest('hex')

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

const assertExactArray = (value, expected, label) => {
	if (
		!Array.isArray(value) ||
		JSON.stringify(value) !== JSON.stringify(expected)
	) {
		fail(`${label} does not match the frozen contract`)
	}
}

const assertIsoTimestamp = (value, label) => {
	if (
		typeof value !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
		Number.isNaN(Date.parse(value)) ||
		new Date(value).toISOString() !== value
	) {
		fail(`${label} must be a canonical UTC timestamp`)
	}
}

const assertCanonicalSecondsTimestamp = (value, label) => {
	if (
		typeof value !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ||
		Number.isNaN(Date.parse(value)) ||
		new Date(value).toISOString().replace('.000Z', 'Z') !== value
	) {
		fail(`${label} must be a canonical UTC seconds timestamp`)
	}
}

const decodeCanonicalJson = (raw, maxBytes, label) => {
	if (!Buffer.isBuffer(raw)) fail(`${label} must be raw bytes`)
	if (raw.length === 0 || raw.length > maxBytes) {
		fail(`${label} size is outside the allowed range`)
	}

	let text
	try {
		text = utf8Decoder.decode(raw)
	} catch {
		fail(`${label} is not valid UTF-8`)
	}

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

const validateManifestPath = path => {
	if (
		typeof path !== 'string' ||
		path.length === 0 ||
		path.length > 4096 ||
		path.includes('\\') ||
		path.includes('\0') ||
		posix.normalize(path) !== path ||
		path.endsWith('/.') ||
		path.endsWith('/..') ||
		!SCAN_ROOTS.some(root => path.startsWith(`${root}/`))
	) {
		fail(`Invalid release evidence path: ${String(path)}`)
	}
}

export const validateFullManifestRaw = (raw, expectedRevision) => {
	if (!REVISION_PATTERN.test(expectedRevision)) {
		fail(
			'Expected client revision must be exactly 40 lowercase hex characters'
		)
	}

	const value = decodeCanonicalJson(
		raw,
		MAX_MANIFEST_BYTES,
		'Full release manifest'
	)
	assertExactKeys(value, FULL_MANIFEST_KEYS, 'Full release manifest')
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== FULL_MANIFEST_KIND ||
		value.clientRevision !== expectedRevision ||
		!BUILD_ID_PATTERN.test(value.nextBuildId)
	) {
		fail('Release evidence identity does not match the frozen contract')
	}
	assertExactArray(value.scanRoots, SCAN_ROOTS, 'Release scan roots')
	assertExactArray(value.checks, RELEASE_CHECKS, 'Release checks')
	assertIsoTimestamp(value.generatedAt, 'Release generatedAt')

	if (!Array.isArray(value.files) || value.files.length > MAX_FILE_COUNT) {
		fail('Release files are missing or exceed the bounded file count')
	}
	let totalBytes = 0
	let previousPath = ''
	const coveredRoots = new Set()
	for (const file of value.files) {
		assertExactKeys(file, FILE_KEYS, 'Release file')
		validateManifestPath(file.path)
		if (
			previousPath &&
			Buffer.from(file.path).compare(Buffer.from(previousPath)) <= 0
		) {
			fail('Release files must be unique and bytewise sorted by path')
		}
		previousPath = file.path
		if (
			!Number.isSafeInteger(file.bytes) ||
			file.bytes < 0 ||
			file.bytes > MAX_TOTAL_BYTES ||
			!SHA256_PATTERN.test(file.sha256)
		) {
			fail(`Invalid release file metadata: ${file.path}`)
		}
		totalBytes += file.bytes
		if (totalBytes > MAX_TOTAL_BYTES) {
			fail('Release files exceed the bounded byte count')
		}
		for (const root of SCAN_ROOTS) {
			if (file.path.startsWith(`${root}/`)) coveredRoots.add(root)
		}
	}
	if (coveredRoots.size !== SCAN_ROOTS.length) {
		fail('Every frozen scan root must contain at least one regular file')
	}
	if (
		value.fileCount !== value.files.length ||
		value.totalBytes !== totalBytes ||
		value.treeSha256 !== sha256(JSON.stringify(value.files))
	) {
		fail(
			'Release aggregate counters or tree hash do not match the file list'
		)
	}
	return value
}

export const validateReleaseEvidenceRaw = (
	raw,
	expectedRevision,
	fullManifestRaw
) => {
	if (!REVISION_PATTERN.test(expectedRevision)) {
		fail(
			'Expected client revision must be exactly 40 lowercase hex characters'
		)
	}
	const value = decodeCanonicalJson(raw, 64 * 1024, 'Release evidence')
	assertExactKeys(value, RELEASE_KEYS, 'Release evidence')
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== RELEASE_KIND ||
		value.clientRevision !== expectedRevision ||
		!BUILD_ID_PATTERN.test(value.nextBuildId) ||
		!Number.isSafeInteger(value.fileCount) ||
		value.fileCount < 1 ||
		value.fileCount > MAX_FILE_COUNT ||
		!Number.isSafeInteger(value.totalBytes) ||
		value.totalBytes < 0 ||
		value.totalBytes > MAX_TOTAL_BYTES ||
		!SHA256_PATTERN.test(value.treeSha256) ||
		!SHA256_PATTERN.test(value.fullManifestSha256)
	) {
		fail('Release evidence identity or aggregate is invalid')
	}
	assertExactArray(value.scanRoots, SCAN_ROOTS, 'Release scan roots')
	assertExactArray(value.checks, RELEASE_CHECKS, 'Release checks')
	assertIsoTimestamp(value.generatedAt, 'Release generatedAt')
	if (fullManifestRaw !== undefined) {
		const full = validateFullManifestRaw(fullManifestRaw, expectedRevision)
		if (
			value.fullManifestSha256 !== sha256(fullManifestRaw) ||
			value.nextBuildId !== full.nextBuildId ||
			value.fileCount !== full.fileCount ||
			value.totalBytes !== full.totalBytes ||
			value.treeSha256 !== full.treeSha256 ||
			value.generatedAt !== full.generatedAt
		) {
			fail(
				'Release evidence does not exactly derive from the full manifest'
			)
		}
	}
	return value
}

export const deriveReleaseEvidence = (
	fullManifestRaw,
	expectedRevision
) => {
	const full = validateFullManifestRaw(fullManifestRaw, expectedRevision)
	const raw = Buffer.from(
		JSON.stringify({
			schemaVersion: RELEASE_SCHEMA_VERSION,
			kind: RELEASE_KIND,
			clientRevision: expectedRevision,
			nextBuildId: full.nextBuildId,
			scanRoots: SCAN_ROOTS,
			fileCount: full.fileCount,
			totalBytes: full.totalBytes,
			treeSha256: full.treeSha256,
			checks: RELEASE_CHECKS,
			fullManifestSha256: sha256(fullManifestRaw),
			generatedAt: full.generatedAt
		})
	)
	validateReleaseEvidenceRaw(raw, expectedRevision, fullManifestRaw)
	return raw
}

export const readSignature = raw => {
	if (
		!Buffer.isBuffer(raw) ||
		!/^([A-Za-z0-9+/]{86}==)\n$/.test(raw.toString('ascii'))
	) {
		fail('Detached signature must be one canonical base64 Ed25519 line')
	}
	const encoded = raw.subarray(0, raw.length - 1).toString('ascii')
	const signature = Buffer.from(encoded, 'base64')
	if (
		signature.length !== 64 ||
		signature.toString('base64') !== encoded
	) {
		fail('Detached signature is not a canonical raw 64-byte Ed25519 value')
	}
	return signature
}

export const readBoundedRegularFile = (path, maxBytes, label) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1
	) {
		fail(`${label} must be a non-hardlinked regular file`)
	}
	if (metadata.size <= 0 || metadata.size > maxBytes) {
		fail(`${label} size is outside the allowed range`)
	}
	return readFileSync(path)
}

export const readEd25519PublicKey = path => {
	const raw = readBoundedRegularFile(
		path,
		MAX_KEY_BYTES,
		'Ed25519 public key'
	)
	const key = createPublicKey(raw)
	if (key.asymmetricKeyType !== 'ed25519') {
		fail('Signing public key must use Ed25519')
	}
	return key
}

export const readEd25519PrivateKey = path => {
	const raw = readBoundedRegularFile(
		path,
		MAX_KEY_BYTES,
		'Ed25519 private key'
	)
	const key = createPrivateKey(raw)
	if (key.asymmetricKeyType !== 'ed25519') {
		fail('Signing private key must use Ed25519')
	}
	return key
}

export const verifyReleaseEvidenceSignature = (
	manifestRaw,
	signatureRaw,
	publicKeyPath,
	expectedRevision
) => {
	const value = validateReleaseEvidenceRaw(manifestRaw, expectedRevision)
	const signature = readSignature(signatureRaw)
	if (
		!verify(
			null,
			manifestRaw,
			readEd25519PublicKey(publicKeyPath),
			signature
		)
	) {
		fail('Detached Ed25519 release evidence signature is invalid')
	}
	return value
}

export const validateRuntimeEvidenceRaw = (
	raw,
	{
		expectedRevision,
		releaseManifestRaw,
		releaseSignatureRaw,
		previousRuntimeRaw
	}
) => {
	if (!REVISION_PATTERN.test(expectedRevision)) {
		fail(
			'Expected client revision must be exactly 40 lowercase hex characters'
		)
	}
	const value = decodeCanonicalJson(raw, 64 * 1024, 'Runtime evidence')
	assertExactKeys(value, RUNTIME_KEYS, 'Runtime evidence')
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== RUNTIME_KIND ||
		value.clientRevision !== expectedRevision ||
		value.releaseEvidenceSha256 !== sha256(releaseManifestRaw) ||
		value.releaseEvidenceSignatureSha256 !== sha256(releaseSignatureRaw)
	) {
		fail('Runtime evidence does not bind the expected release bytes')
	}
	assertIsoTimestamp(value.processStartedAt, 'Runtime processStartedAt')

	if (previousRuntimeRaw) {
		const previous = decodeCanonicalJson(
			previousRuntimeRaw,
			64 * 1024,
			'Previous runtime evidence'
		)
		assertExactKeys(previous, RUNTIME_KEYS, 'Previous runtime evidence')
		if (
			previous.clientRevision !== expectedRevision ||
			previous.processStartedAt !== value.processStartedAt ||
			previous.releaseEvidenceSha256 !== value.releaseEvidenceSha256 ||
			previous.releaseEvidenceSignatureSha256 !==
				value.releaseEvidenceSignatureSha256
		) {
			fail(
				'Runtime evidence changed without a pinned process restart boundary'
			)
		}
	}
	return value
}

const validateImageAdoptionRaw = (raw, expectedRevision) => {
	const value = decodeCanonicalJson(
		raw,
		64 * 1024,
		'Image adoption journal'
	)
	assertExactKeys(value, IMAGE_ADOPTION_KEYS, 'Image adoption journal')
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== 'identity-avatar-client-image-adoption' ||
		value.clientRevision !== expectedRevision ||
		!IMAGE_ID_PATTERN.test(value.imageId) ||
		!SHA256_PATTERN.test(value.fullManifestSha256) ||
		!SHA256_PATTERN.test(value.releaseEvidenceSha256)
	) {
		fail('Image adoption journal does not match the frozen contract')
	}
	return value
}

const readFileWithoutLinks = path => {
	let descriptor
	try {
		descriptor = openSync(
			path,
			fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
		)
		const before = fstatSync(descriptor)
		if (!before.isFile() || before.nlink !== 1) {
			fail(`Deploy artifact is not a single-link regular file: ${path}`)
		}
		if (before.size > MAX_TOTAL_BYTES) {
			fail(`Deploy artifact exceeds the bounded size: ${path}`)
		}
		const content = readFileSync(descriptor)
		const after = fstatSync(descriptor)
		if (
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.mtimeMs !== after.mtimeMs ||
			content.length !== after.size
		) {
			fail(`Deploy artifact changed while it was scanned: ${path}`)
		}
		return content
	} finally {
		if (descriptor !== undefined) closeSync(descriptor)
	}
}

const enumerateRegularFiles = (repositoryRoot, relativeRoot) => {
	const absoluteRoot = join(repositoryRoot, ...relativeRoot.split('/'))
	const rootMetadata = lstatSync(absoluteRoot)
	if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
		fail(`Frozen scan root is not a real directory: ${relativeRoot}`)
	}
	const files = []
	const visit = (absoluteDirectory, relativeDirectory) => {
		for (const name of readdirSync(absoluteDirectory).sort((left, right) =>
			Buffer.from(left).compare(Buffer.from(right))
		)) {
			const absolutePath = join(absoluteDirectory, name)
			const relativePath = posix.join(relativeDirectory, name)
			const metadata = lstatSync(absolutePath)
			if (metadata.isSymbolicLink()) {
				fail(`Symlinks are forbidden in release evidence: ${relativePath}`)
			}
			if (metadata.isDirectory()) {
				visit(absolutePath, relativePath)
			} else if (metadata.isFile()) {
				if (metadata.nlink !== 1) {
					fail(
						`Hardlinks are forbidden in release evidence: ${relativePath}`
					)
				}
				files.push({ absolutePath, relativePath })
			} else {
				fail(
					`Special files are forbidden in release evidence: ${relativePath}`
				)
			}
		}
	}
	visit(absoluteRoot, relativeRoot)
	return files
}

export const materializeStandaloneTree = (sourcePath, destinationPath) => {
	const source = realpathSync(sourcePath)
	const destination = resolve(destinationPath)
	if (
		destination === source ||
		destination.startsWith(`${source}${sep}`)
	) {
		fail(
			'Materialized standalone destination must be outside the source tree'
		)
	}
	if (existsSync(destinationPath)) {
		fail('Materialized standalone destination must not already exist')
	}
	const sourceMetadata = lstatSync(source)
	if (!sourceMetadata.isDirectory() || sourceMetadata.isSymbolicLink()) {
		fail('Standalone source must be a real directory')
	}

	const visit = (currentSource, currentDestination, activeDirectories) => {
		const sourceLstat = lstatSync(currentSource)
		const resolvedSource = sourceLstat.isSymbolicLink()
			? realpathSync(currentSource)
			: currentSource
		if (
			resolvedSource !== source &&
			!resolvedSource.startsWith(`${source}${sep}`)
		) {
			fail(`Standalone symlink escapes its deploy tree: ${currentSource}`)
		}
		const metadata = statSync(resolvedSource)
		if (metadata.isDirectory()) {
			const realDirectory = realpathSync(resolvedSource)
			if (activeDirectories.has(realDirectory)) {
				fail(
					`Standalone directory symlink cycle detected: ${currentSource}`
				)
			}
			const nextActiveDirectories = new Set(activeDirectories)
			nextActiveDirectories.add(realDirectory)
			mkdirSync(currentDestination, { mode: metadata.mode & 0o777 })
			for (const name of readdirSync(resolvedSource).sort((left, right) =>
				Buffer.from(left).compare(Buffer.from(right))
			)) {
				visit(
					join(resolvedSource, name),
					join(currentDestination, name),
					nextActiveDirectories
				)
			}
			chmodSync(currentDestination, metadata.mode & 0o777)
			return
		}
		if (!metadata.isFile()) {
			fail(
				`Special file found in standalone deploy tree: ${currentSource}`
			)
		}
		copyFileSync(
			resolvedSource,
			currentDestination,
			fsConstants.COPYFILE_EXCL
		)
		chmodSync(currentDestination, metadata.mode & 0o777)
		const copied = lstatSync(currentDestination)
		if (
			!copied.isFile() ||
			copied.isSymbolicLink() ||
			copied.nlink !== 1
		) {
			fail(
				`Materialized standalone entry is not a regular file: ${currentDestination}`
			)
		}
	}

	try {
		visit(source, destination, new Set())
	} catch (error) {
		if (existsSync(destination)) {
			rmSync(destination, { recursive: true, force: true })
		}
		throw error
	}
}

export const generateFullReleaseManifest = ({
	repositoryRoot,
	clientRevision,
	generatedAt = new Date().toISOString()
}) => {
	if (!REVISION_PATTERN.test(clientRevision)) {
		fail('Client revision must be exactly 40 lowercase hex characters')
	}
	assertIsoTimestamp(generatedAt, 'Release generatedAt')
	const root = realpathSync(repositoryRoot)
	const nextBuildId = readFileWithoutLinks(join(root, '.next', 'BUILD_ID'))
		.toString('utf8')
		.trim()
	if (!BUILD_ID_PATTERN.test(nextBuildId)) {
		fail('Next BUILD_ID does not match the bounded release contract')
	}

	const discovered = SCAN_ROOTS.flatMap(scanRoot =>
		enumerateRegularFiles(root, scanRoot)
	).sort((left, right) =>
		Buffer.from(left.relativePath).compare(Buffer.from(right.relativePath))
	)
	if (discovered.length === 0 || discovered.length > MAX_FILE_COUNT) {
		fail('Deploy tree is empty or exceeds the bounded file count')
	}

	let totalBytes = 0
	let profileAvatarPresent = false
	let adminAvatarPresent = false
	const files = discovered.map(({ absolutePath, relativePath }) => {
		const content = readFileWithoutLinks(absolutePath)
		const contentText = content.toString('utf8')
		totalBytes += content.length
		if (totalBytes > MAX_TOTAL_BYTES) {
			fail('Deploy tree exceeds the bounded byte count')
		}
		for (const forbidden of FORBIDDEN_CONTENT) {
			if (content.includes(Buffer.from(forbidden))) {
				fail(`Forbidden client reference found in ${relativePath}`)
			}
		}
		if (
			LEGACY_RELATIVE_FILE_ENDPOINT_PATTERN.test(contentText) &&
			LEGACY_FILE_QUERY_SHAPE_PATTERN.test(contentText)
		) {
			fail(`Legacy relative file endpoint shape found in ${relativePath}`)
		}
		if (content.includes(Buffer.from(PROFILE_AVATAR_REFERENCE))) {
			profileAvatarPresent = true
		}
		if (
			content.includes(Buffer.from(ADMIN_USER_REFERENCE)) &&
			content.includes(Buffer.from(ADMIN_AVATAR_REFERENCE))
		) {
			adminAvatarPresent = true
		}
		return {
			path: relativePath,
			bytes: content.length,
			sha256: sha256(content)
		}
	})
	if (!profileAvatarPresent || !adminAvatarPresent) {
		fail(
			'Identity profile/admin avatar API references are not both present'
		)
	}

	const value = {
		schemaVersion: RELEASE_SCHEMA_VERSION,
		kind: FULL_MANIFEST_KIND,
		clientRevision,
		nextBuildId,
		scanRoots: SCAN_ROOTS,
		files,
		fileCount: files.length,
		totalBytes,
		treeSha256: sha256(JSON.stringify(files)),
		checks: RELEASE_CHECKS,
		generatedAt
	}
	const raw = Buffer.from(JSON.stringify(value))
	validateFullManifestRaw(raw, clientRevision)
	return raw
}

export const atomicWrite = (destination, raw, mode) => {
	const parent = dirname(destination)
	mkdirSync(parent, { recursive: true })
	const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`
	let descriptor
	let directoryDescriptor
	try {
		descriptor = openSync(
			temporary,
			fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
			mode
		)
		writeFileSync(descriptor, raw)
		chmodSync(temporary, mode)
		fsyncSync(descriptor)
		closeSync(descriptor)
		descriptor = undefined
		renameSync(temporary, destination)
		directoryDescriptor = openSync(parent, fsConstants.O_RDONLY)
		fsyncSync(directoryDescriptor)
	} finally {
		if (descriptor !== undefined) closeSync(descriptor)
		if (directoryDescriptor !== undefined) closeSync(directoryDescriptor)
		if (existsSync(temporary)) rmSync(temporary)
	}
}

const assertOwnedPrivateKey = (
	path,
	label,
	{ expectedUid, expectedGid }
) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.uid !== expectedUid ||
		metadata.gid !== expectedGid ||
		(metadata.mode & 0o777) !== 0o600 ||
		metadata.size <= 0 ||
		metadata.size > MAX_KEY_BYTES
	) {
		fail(`${label} must be an owned 0600 single-link regular file`)
	}
}

const assertRootOwnedJournal = (path, label) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.uid !== 0 ||
		metadata.gid !== 0 ||
		(metadata.mode & 0o777) !== 0o600 ||
		metadata.size <= 0 ||
		metadata.size > 64 * 1024
	) {
		fail(`${label} must be a root-owned 0600 single-link regular file`)
	}
}

export const adoptReleaseImage = ({
	journalPath,
	clientRevision,
	imageId,
	fullManifestPath,
	releaseEvidencePath
}) => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Release image adoption journal may only be written by root')
	}
	const fullManifestRaw = readBoundedRegularFile(
		fullManifestPath,
		MAX_MANIFEST_BYTES,
		'Full release manifest'
	)
	const releaseEvidenceRaw = readBoundedRegularFile(
		releaseEvidencePath,
		64 * 1024,
		'Release evidence'
	)
	validateFullManifestRaw(fullManifestRaw, clientRevision)
	validateReleaseEvidenceRaw(
		releaseEvidenceRaw,
		clientRevision,
		fullManifestRaw
	)
	const raw = Buffer.from(
		JSON.stringify({
			schemaVersion: RELEASE_SCHEMA_VERSION,
			kind: 'identity-avatar-client-image-adoption',
			clientRevision,
			imageId,
			fullManifestSha256: sha256(fullManifestRaw),
			releaseEvidenceSha256: sha256(releaseEvidenceRaw)
		})
	)
	validateImageAdoptionRaw(raw, clientRevision)
	if (existsSync(journalPath)) {
		assertRootOwnedJournal(journalPath, 'Image adoption journal')
		const existing = readBoundedRegularFile(
			journalPath,
			64 * 1024,
			'Image adoption journal'
		)
		validateImageAdoptionRaw(existing, clientRevision)
		if (!existing.equals(raw)) {
			fail('First adopted image for this client revision must not change')
		}
		return
	}
	atomicWrite(journalPath, raw, 0o600)
	assertRootOwnedJournal(journalPath, 'Image adoption journal')
}

const validateSecureKeyParent = (path, { expectedUid, expectedGid }) => {
	const parent = dirname(path)
	if (realpathSync(parent) !== resolve(parent)) {
		fail(`Signing key directory must not traverse symlinks: ${parent}`)
	}
	const metadata = statSync(parent)
	if (
		!metadata.isDirectory() ||
		metadata.uid !== expectedUid ||
		metadata.gid !== expectedGid ||
		(metadata.mode & 0o022) !== 0
	) {
		fail(
			`Signing key directory must have the expected owner and not be group/world writable: ${parent}`
		)
	}
}

export const provisionSigningKeyPairForOwner = (
	privateKeyPath,
	publicKeyPath,
	{ expectedUid, expectedGid }
) => {
	if (
		!Number.isSafeInteger(expectedUid) ||
		expectedUid < 0 ||
		!Number.isSafeInteger(expectedGid) ||
		expectedGid < 0
	) {
		fail('Signing key owner identity is invalid')
	}
	const expectedOwner = { expectedUid, expectedGid }
	validateSecureKeyParent(privateKeyPath, expectedOwner)
	validateSecureKeyParent(publicKeyPath, expectedOwner)
	const privateExists = existsSync(privateKeyPath)
	const publicExists = existsSync(publicKeyPath)
	if (!privateExists && publicExists) {
		fail('Signing public key exists without its private key')
	}
	if (!privateExists) {
		const { privateKey, publicKey } = generateKeyPairSync('ed25519')
		atomicWrite(
			privateKeyPath,
			privateKey.export({ type: 'pkcs8', format: 'pem' }),
			0o600
		)
		atomicWrite(
			publicKeyPath,
			publicKey.export({ type: 'spki', format: 'pem' }),
			0o600
		)
	} else if (!publicExists) {
		assertOwnedPrivateKey(
			privateKeyPath,
			'Signing private key',
			expectedOwner
		)
		const privateKey = readEd25519PrivateKey(privateKeyPath)
		atomicWrite(
			publicKeyPath,
			createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }),
			0o600
		)
	}
	assertOwnedPrivateKey(
		privateKeyPath,
		'Signing private key',
		expectedOwner
	)
	assertOwnedPrivateKey(publicKeyPath, 'Signing public key', expectedOwner)
	const privateKey = readEd25519PrivateKey(privateKeyPath)
	const publicKey = readEd25519PublicKey(publicKeyPath)
	const derived = createPublicKey(privateKey).export({
		type: 'spki',
		format: 'der'
	})
	const configured = publicKey.export({ type: 'spki', format: 'der' })
	if (!Buffer.from(derived).equals(Buffer.from(configured))) {
		fail('Signing public key does not match the private key')
	}
}

export const provisionSigningKeyPair = (privateKeyPath, publicKeyPath) => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Signing keys may only be provisioned or validated by root')
	}
	provisionSigningKeyPairForOwner(privateKeyPath, publicKeyPath, {
		expectedUid: 0,
		expectedGid: 0
	})
}

const readInlineSignature = value => {
	if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) {
		fail('Inline signature must be canonical base64 Ed25519')
	}
	const signature = Buffer.from(value, 'base64')
	if (signature.length !== 64 || signature.toString('base64') !== value) {
		fail('Inline signature must encode one raw 64-byte Ed25519 value')
	}
	return signature
}

const parseCanonicalEd25519PublicKey = (raw, label) => {
	if (
		!Buffer.isBuffer(raw) ||
		raw.length === 0 ||
		raw.length > MAX_KEY_BYTES
	) {
		fail(`${label} size is outside the allowed range`)
	}
	const text = raw.toString('ascii')
	if (
		!/^-----BEGIN PUBLIC KEY-----\n(?:[A-Za-z0-9+/=]{1,64}\n)+-----END PUBLIC KEY-----\n$/.test(
			text
		)
	) {
		fail(`${label} must use canonical PEM encoding`)
	}
	let key
	try {
		key = createPublicKey(raw)
	} catch {
		fail(`${label} is not a public key`)
	}
	if (key.asymmetricKeyType !== 'ed25519') {
		fail(`${label} must use Ed25519`)
	}
	const canonical = Buffer.from(
		key.export({ type: 'spki', format: 'pem' })
	)
	if (!canonical.equals(raw)) {
		fail(`${label} PEM bytes are not canonical`)
	}
	return key
}

export const validateBackendDeploymentHealthRaw = raw => {
	const value = decodeCanonicalJson(
		raw,
		BACKEND_READY_MAX_BYTES,
		'Backend deployment health'
	)
	assertExactKeys(
		value,
		BACKEND_DEPLOYMENT_HEALTH_KEYS,
		'Backend deployment health'
	)
	if (value.service !== 'api' || !REVISION_PATTERN.test(value.revision)) {
		fail(
			'Backend deployment health does not identify an immutable API revision'
		)
	}
	return value
}

export const validateBackendClientReadyRaw = (
	raw,
	{ expectedServerRevision, nowMs = Date.now(), requireFresh = true }
) => {
	if (
		!REVISION_PATTERN.test(expectedServerRevision) ||
		!Number.isFinite(nowMs)
	) {
		fail('Backend client-ready verification inputs are invalid')
	}
	const value = decodeCanonicalJson(
		raw,
		BACKEND_READY_MAX_BYTES,
		'Backend client-ready attestation'
	)
	assertExactKeys(
		value,
		BACKEND_CLIENT_READY_KEYS,
		'Backend client-ready attestation'
	)
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== BACKEND_CLIENT_READY_KIND ||
		value.serverRevision !== expectedServerRevision ||
		value.ownershipPhase !== 'ACTIVE' ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		value.legacyReferenceMatches !== 0 ||
		value.legacyFileWriterFenced !== true
	) {
		fail(
			'Backend client-ready ownership state is not safe for client cutover'
		)
	}
	for (const key of BACKEND_CLIENT_READY_HASH_KEYS) {
		if (!SHA256_PATTERN.test(value[key])) {
			fail(`Backend client-ready ${key} must be a SHA-256 digest`)
		}
	}
	for (const key of ['ownershipActivatedAt', 'generatedAt', 'expiresAt']) {
		assertIsoTimestamp(value[key], `Backend client-ready ${key}`)
	}
	const ownershipActivatedAt = Date.parse(value.ownershipActivatedAt)
	const generatedAt = Date.parse(value.generatedAt)
	const expiresAt = Date.parse(value.expiresAt)
	const validityMs = expiresAt - generatedAt
	if (
		ownershipActivatedAt > generatedAt ||
		generatedAt > nowMs + MAX_FUTURE_SKEW_MS ||
		(requireFresh && expiresAt <= nowMs) ||
		validityMs <= 0 ||
		validityMs > BACKEND_READY_VALIDITY_MS
	) {
		fail(
			'Backend client-ready timestamps are stale or outside the frozen window'
		)
	}
	return value
}

export const verifyBackendClientReadyAttestation = (
	attestationRaw,
	signatureRaw,
	publicKeyPath,
	{ expectedServerRevision, nowMs = Date.now(), requireFresh = true }
) => {
	const value = validateBackendClientReadyRaw(attestationRaw, {
		expectedServerRevision,
		nowMs,
		requireFresh
	})
	const signature = readSignature(signatureRaw)
	if (
		!verify(
			null,
			attestationRaw,
			readEd25519PublicKey(publicKeyPath),
			signature
		)
	) {
		fail('Backend client-ready detached Ed25519 signature is invalid')
	}
	return value
}

export const validateBackendCleanupCompleteRaw = (
	raw,
	{ nowMs = Date.now() } = {}
) => {
	if (!Number.isFinite(nowMs)) {
		fail('Backend cleanup-complete verification time is invalid')
	}
	const value = decodeCanonicalJson(
		raw,
		BACKEND_READY_MAX_BYTES,
		'Backend cleanup-complete attestation'
	)
	assertExactKeys(
		value,
		BACKEND_CLEANUP_COMPLETE_KEYS,
		'Backend cleanup-complete attestation'
	)
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== BACKEND_CLEANUP_COMPLETE_KIND ||
		value.cleanupPhase !== 'COMPLETE' ||
		![
			value.ownershipRevision,
			value.currentRuntimeRevision,
			value.cleanupRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		value.ownershipRevision === value.cleanupRevision ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		!Number.isSafeInteger(value.runtimeStabilityGeneration) ||
		value.runtimeStabilityGeneration < 0 ||
		value.runtimeStabilityGeneration > MAX_RUNTIME_STABILITY_GENERATION ||
		!Number.isSafeInteger(value.runtimeStabilityLedgerGeneration) ||
		value.runtimeStabilityLedgerGeneration < 0 ||
		value.runtimeStabilityLedgerGeneration >
			MAX_RUNTIME_STABILITY_GENERATION ||
		!['applied', 'adopted', 'aborted'].includes(
			value.runtimeStabilityLedgerTailState
		) ||
		(value.runtimeStabilityLedgerTailState === 'aborted'
			? value.runtimeStabilityLedgerGeneration !==
					value.runtimeStabilityGeneration + 1 ||
				value.runtimeStabilityLedgerTailEvidenceSha256 ===
					value.runtimeStabilityEvidenceSha256
			: value.runtimeStabilityLedgerGeneration !==
					value.runtimeStabilityGeneration ||
				value.runtimeStabilityLedgerTailEvidenceSha256 !==
					value.runtimeStabilityEvidenceSha256) ||
		(value.runtimeRetargetEvidenceSha256 !== 'pending' &&
			!SHA256_PATTERN.test(value.runtimeRetargetEvidenceSha256)) ||
		(value.clientRetargetEvidenceSha256 !== 'pending' &&
			!SHA256_PATTERN.test(value.clientRetargetEvidenceSha256)) ||
		(value.currentRuntimeRevision !== value.ownershipRevision &&
			!SHA256_PATTERN.test(value.runtimeRetargetEvidenceSha256)) ||
		(value.currentClientRevision !== value.initialClientRevision &&
			!SHA256_PATTERN.test(value.clientRetargetEvidenceSha256)) ||
		(value.currentClientRevision === value.initialClientRevision
			? value.currentClientBindingEvidenceSha256 !==
					value.clientSwitchEvidenceSha256 ||
				value.clientRetargetEvidenceSha256 !== 'pending'
			: value.currentClientBindingEvidenceSha256 !==
				value.clientRetargetEvidenceSha256) ||
		!Number.isSafeInteger(value.retirementConsumerRecoveryEvidenceCount) ||
		value.retirementConsumerRecoveryEvidenceCount < 0 ||
		value.retirementConsumerRecoveryEvidenceCount > 64 ||
		!/^sha256:[0-9a-f]{64}$/.test(value.coreCleanupImageId) ||
		value.legacyReferencesAbsent !== true ||
		value.legacyRoutesAbsent !== true ||
		value.legacyObjectsRetired !== true ||
		value.ownershipActive !== true
	) {
		fail('Backend cleanup-complete state is not safe for client release')
	}
	for (const key of BACKEND_CLEANUP_HASH_KEYS) {
		if (!SHA256_PATTERN.test(value[key])) {
			fail(`Backend cleanup-complete ${key} must be a SHA-256 digest`)
		}
	}
	const binding = value.frontendBinding
	assertExactKeys(
		binding,
		BACKEND_CLEANUP_FRONTEND_BINDING_KEYS,
		'Backend cleanup-complete frontend binding'
	)
	if (
		![
			'initial-client-switch',
			'client-code-retarget',
			'frontend-runtime-rebind'
		].includes(binding.bindingKind) ||
		![
			binding.evidenceSha256,
			binding.evidenceSignatureSha256,
			binding.releaseEvidenceSha256,
			binding.releaseEvidenceSignatureSha256,
			binding.releaseTreeSha256,
			binding.releaseFullManifestSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		binding.clientRevision !== value.currentClientRevision ||
		!IMAGE_ID_PATTERN.test(binding.imageId) ||
		(binding.bindingKind === 'initial-client-switch' &&
			value.currentClientRevision !== value.initialClientRevision) ||
		(binding.bindingKind === 'client-code-retarget' &&
			value.currentClientRevision === value.initialClientRevision)
	) {
		fail('Backend cleanup-complete frontend binding is invalid')
	}
	assertIsoTimestamp(
		binding.processStartedAt,
		'Backend cleanup-complete frontend processStartedAt'
	)
	assertCanonicalSecondsTimestamp(
		value.runtimeStableSince,
		'Backend cleanup-complete runtimeStableSince'
	)
	assertCanonicalSecondsTimestamp(
		value.completedAt,
		'Backend cleanup-complete completedAt'
	)
	if (
		Date.parse(value.completedAt) <
			Date.parse(value.runtimeStableSince) + CLEANUP_REQUIRED_SOAK_MS ||
		Date.parse(value.completedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		Date.parse(binding.processStartedAt) >
			Date.parse(value.runtimeStableSince)
	) {
		fail('Backend cleanup-complete timestamps are invalid')
	}
	return value
}

export const verifyBackendCleanupCompleteAttestation = (
	attestationRaw,
	signatureRaw,
	publicKeyPath,
	{ nowMs = Date.now() } = {}
) => {
	const value = validateBackendCleanupCompleteRaw(attestationRaw, {
		nowMs
	})
	if (
		!verify(
			null,
			attestationRaw,
			readEd25519PublicKey(publicKeyPath),
			readSignature(signatureRaw)
		)
	) {
		fail('Backend cleanup-complete detached Ed25519 signature is invalid')
	}
	return value
}

const assertOwnedRegularFile = (
	path,
	label,
	{ expectedUid, expectedGid, mode = 0o600, allowedLinks = [1] }
) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		!allowedLinks.includes(metadata.nlink) ||
		metadata.uid !== expectedUid ||
		metadata.gid !== expectedGid ||
		(metadata.mode & 0o777) !== mode ||
		metadata.size <= 0 ||
		metadata.size > MAX_KEY_BYTES
	) {
		fail(`${label} must be an owned ${mode.toString(8)} regular file`)
	}
	return metadata
}

const fsyncDirectory = path => {
	const descriptor = openSync(path, fsConstants.O_RDONLY)
	try {
		fsyncSync(descriptor)
	} finally {
		closeSync(descriptor)
	}
}

const durableUnlink = path => {
	if (!pathEntryExists(path)) return
	unlinkSync(path)
	fsyncDirectory(dirname(path))
}

const durablePublishNoClobber = ({
	destination,
	pending,
	raw,
	mode,
	owner,
	label
}) => {
	if (pathEntryExists(pending)) {
		const pendingMetadata = assertOwnedRegularFile(
			pending,
			`${label} pending`,
			{
				...owner,
				mode,
				allowedLinks: [1, 2]
			}
		)
		if (!readFileSync(pending).equals(raw)) {
			fail(`${label} pending bytes do not match the frozen value`)
		}
		if (pendingMetadata.nlink === 2 && !pathEntryExists(destination)) {
			fail(`${label} pending hardlink has no destination`)
		}
	} else {
		atomicWrite(pending, raw, mode)
		assertOwnedRegularFile(pending, `${label} pending`, {
			...owner,
			mode
		})
	}

	if (!pathEntryExists(destination)) {
		linkSync(pending, destination)
		fsyncDirectory(dirname(destination))
	}
	const destinationMetadata = assertOwnedRegularFile(destination, label, {
		...owner,
		mode,
		allowedLinks: [1, 2]
	})
	if (!readFileSync(destination).equals(raw)) {
		fail(`${label} already exists with different bytes`)
	}
	const pendingMetadata = lstatSync(pending)
	if (
		destinationMetadata.nlink === 2 &&
		(destinationMetadata.dev !== pendingMetadata.dev ||
			destinationMetadata.ino !== pendingMetadata.ino)
	) {
		fail(`${label} has an unexplained hardlink`)
	}
	durableUnlink(pending)
	assertOwnedRegularFile(destination, label, { ...owner, mode })
}

export const validateBackendTrustBootstrapRaw = (
	raw,
	{
		destinationPublicKeyRaw,
		frontendLifecyclePublicKeyPath,
		currentClientRevision,
		contractSourcePath = BACKEND_SIGNING_TRANSFER_PUBLIC_KEY,
		contractDestinationPath = BACKEND_SIGNING_PUBLIC_KEY,
		isRevisionAncestor = (ancestor, current) => ancestor === current
	}
) => {
	if (!REVISION_PATTERN.test(currentClientRevision)) {
		fail(
			'Current client revision must be exactly 40 lowercase hex characters'
		)
	}
	const value = decodeCanonicalJson(
		raw,
		64 * 1024,
		'Backend trust bootstrap evidence'
	)
	assertExactKeys(
		value,
		BACKEND_TRUST_BOOTSTRAP_KEYS,
		'Backend trust bootstrap evidence'
	)
	const backendPublicKey = parseCanonicalEd25519PublicKey(
		destinationPublicKeyRaw,
		'Pinned backend public key'
	)
	const publicKeySha = sha256(destinationPublicKeyRaw)
	const spkiSha = sha256(
		backendPublicKey.export({ type: 'spki', format: 'der' })
	)
	if (
		value.version !== 1 ||
		value.kind !== BACKEND_TRUST_BOOTSTRAP_KIND ||
		!REVISION_PATTERN.test(value.clientRevision) ||
		!isRevisionAncestor(value.clientRevision, currentClientRevision) ||
		value.sourcePathSha256 !== sha256(Buffer.from(contractSourcePath)) ||
		value.sourcePublicKeySha256 !== publicKeySha ||
		value.destinationPath !== contractDestinationPath ||
		value.destinationPublicKeySha256 !== publicKeySha ||
		value.publicKeySpkiSha256 !== spkiSha
	) {
		fail('Backend trust bootstrap does not bind the pinned backend key')
	}
	assertIsoTimestamp(
		value.installedAt,
		'Backend trust bootstrap installedAt'
	)
	const { signature, ...payload } = value
	assertExactKeys(
		payload,
		BACKEND_TRUST_BOOTSTRAP_PAYLOAD_KEYS,
		'Backend trust bootstrap payload'
	)
	if (
		!verify(
			null,
			Buffer.from(JSON.stringify(payload)),
			readEd25519PublicKey(frontendLifecyclePublicKeyPath),
			readInlineSignature(signature)
		)
	) {
		fail('Backend trust bootstrap lifecycle signature is invalid')
	}
	return value
}

export const bootstrapBackendTrustForOwner = ({
	sourcePath,
	destinationPath,
	evidencePath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	currentClientRevision,
	installedAt = new Date().toISOString(),
	expectedUid,
	expectedGid,
	contractSourcePath = sourcePath,
	contractDestinationPath = destinationPath,
	isRevisionAncestor = (ancestor, current) => ancestor === current
}) => {
	if (!REVISION_PATTERN.test(currentClientRevision)) {
		fail(
			'Current client revision must be exactly 40 lowercase hex characters'
		)
	}
	assertIsoTimestamp(installedAt, 'Backend trust bootstrap installedAt')
	const owner = { expectedUid, expectedGid }
	for (const path of [
		sourcePath,
		destinationPath,
		evidencePath,
		frontendPrivateKeyPath,
		frontendPublicKeyPath
	]) {
		validateSecureKeyParent(path, owner)
	}
	assertOwnedRegularFile(
		frontendPrivateKeyPath,
		'Frontend lifecycle private key',
		owner
	)
	assertOwnedRegularFile(
		frontendPublicKeyPath,
		'Frontend lifecycle public key',
		owner
	)
	const frontendPrivateKey = readEd25519PrivateKey(frontendPrivateKeyPath)
	const frontendPublicKey = readEd25519PublicKey(frontendPublicKeyPath)
	if (
		!Buffer.from(
			createPublicKey(frontendPrivateKey).export({
				type: 'spki',
				format: 'der'
			})
		).equals(
			Buffer.from(
				frontendPublicKey.export({ type: 'spki', format: 'der' })
			)
		)
	) {
		fail('Frontend lifecycle public key does not match its private key')
	}

	const destinationPending = `${destinationPath}.bootstrap-v1.pending`
	const evidencePending = `${evidencePath}.pending`
	const sourceExists = pathEntryExists(sourcePath)
	const destinationExists = pathEntryExists(destinationPath)
	const destinationPendingExists = pathEntryExists(destinationPending)
	const evidenceExists = pathEntryExists(evidencePath)
	if (evidenceExists && !destinationExists) {
		fail('Backend trust evidence exists without its pinned public key')
	}
	if (
		destinationExists &&
		!evidenceExists &&
		!sourceExists &&
		!destinationPendingExists
	) {
		fail('Pinned backend public key has no recoverable trust evidence')
	}
	if (!destinationExists && !sourceExists && !destinationPendingExists) {
		fail('Backend public-key transfer file has not been staged')
	}

	let candidateRaw
	if (sourceExists) {
		assertOwnedRegularFile(
			sourcePath,
			'Transferred backend public key',
			owner
		)
		candidateRaw = readFileSync(sourcePath)
		parseCanonicalEd25519PublicKey(
			candidateRaw,
			'Transferred backend public key'
		)
	}
	if (destinationPendingExists) {
		assertOwnedRegularFile(
			destinationPending,
			'Backend public key pending',
			{ ...owner, allowedLinks: [1, 2] }
		)
		const pendingRaw = readFileSync(destinationPending)
		parseCanonicalEd25519PublicKey(
			pendingRaw,
			'Backend public key pending'
		)
		if (candidateRaw && !candidateRaw.equals(pendingRaw)) {
			fail('Transferred and pending backend public keys differ')
		}
		candidateRaw = pendingRaw
	}
	if (destinationExists) {
		assertOwnedRegularFile(destinationPath, 'Pinned backend public key', {
			...owner,
			allowedLinks: destinationPendingExists ? [1, 2] : [1]
		})
		const destinationRaw = readFileSync(destinationPath)
		parseCanonicalEd25519PublicKey(
			destinationRaw,
			'Pinned backend public key'
		)
		if (candidateRaw && !candidateRaw.equals(destinationRaw)) {
			fail('Pinned backend public key already has a different fingerprint')
		}
		candidateRaw = destinationRaw
	}
	if (!candidateRaw) fail('Backend public key bootstrap has no key bytes')

	if (!destinationExists || destinationPendingExists) {
		durablePublishNoClobber({
			destination: destinationPath,
			pending: destinationPending,
			raw: candidateRaw,
			mode: 0o600,
			owner,
			label: 'Pinned backend public key'
		})
	}
	assertOwnedRegularFile(
		destinationPath,
		'Pinned backend public key',
		owner
	)
	const destinationRaw = readFileSync(destinationPath)

	if (!pathEntryExists(evidencePath)) {
		let evidenceRaw
		if (pathEntryExists(evidencePending)) {
			assertOwnedRegularFile(
				evidencePending,
				'Backend trust bootstrap evidence pending',
				{ ...owner, allowedLinks: [1, 2] }
			)
			evidenceRaw = readFileSync(evidencePending)
			validateBackendTrustBootstrapRaw(evidenceRaw, {
				destinationPublicKeyRaw: destinationRaw,
				frontendLifecyclePublicKeyPath: frontendPublicKeyPath,
				currentClientRevision,
				contractSourcePath,
				contractDestinationPath,
				isRevisionAncestor
			})
		} else {
			const backendPublicKey = parseCanonicalEd25519PublicKey(
				destinationRaw,
				'Pinned backend public key'
			)
			const publicKeySha = sha256(destinationRaw)
			const payload = {
				version: 1,
				kind: BACKEND_TRUST_BOOTSTRAP_KIND,
				clientRevision: currentClientRevision,
				sourcePathSha256: sha256(Buffer.from(contractSourcePath)),
				sourcePublicKeySha256: publicKeySha,
				destinationPath: contractDestinationPath,
				destinationPublicKeySha256: publicKeySha,
				publicKeySpkiSha256: sha256(
					backendPublicKey.export({ type: 'spki', format: 'der' })
				),
				installedAt
			}
			assertExactKeys(
				payload,
				BACKEND_TRUST_BOOTSTRAP_PAYLOAD_KEYS,
				'Backend trust bootstrap payload'
			)
			const signature = sign(
				null,
				Buffer.from(JSON.stringify(payload)),
				frontendPrivateKey
			).toString('base64')
			readInlineSignature(signature)
			evidenceRaw = Buffer.from(JSON.stringify({ ...payload, signature }))
		}
		durablePublishNoClobber({
			destination: evidencePath,
			pending: evidencePending,
			raw: evidenceRaw,
			mode: 0o600,
			owner,
			label: 'Backend trust bootstrap evidence'
		})
	} else if (pathEntryExists(evidencePending)) {
		const evidenceRaw = readFileSync(evidencePath)
		durablePublishNoClobber({
			destination: evidencePath,
			pending: evidencePending,
			raw: evidenceRaw,
			mode: 0o600,
			owner,
			label: 'Backend trust bootstrap evidence'
		})
	}
	assertOwnedRegularFile(
		evidencePath,
		'Backend trust bootstrap evidence',
		owner
	)
	const evidenceRaw = readFileSync(evidencePath)
	const value = validateBackendTrustBootstrapRaw(evidenceRaw, {
		destinationPublicKeyRaw: destinationRaw,
		frontendLifecyclePublicKeyPath: frontendPublicKeyPath,
		currentClientRevision,
		contractSourcePath,
		contractDestinationPath,
		isRevisionAncestor
	})
	if (sourceExists) durableUnlink(sourcePath)
	return value
}

export const bootstrapBackendTrust = ({
	currentClientRevision,
	repositoryRoot
}) => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Backend public-key trust may only be bootstrapped by root')
	}
	const root = realpathSync(repositoryRoot)
	return bootstrapBackendTrustForOwner({
		sourcePath: BACKEND_SIGNING_TRANSFER_PUBLIC_KEY,
		destinationPath: BACKEND_SIGNING_PUBLIC_KEY,
		evidencePath: BACKEND_TRUST_BOOTSTRAP_EVIDENCE,
		frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		currentClientRevision,
		expectedUid: 0,
		expectedGid: 0,
		contractSourcePath: BACKEND_SIGNING_TRANSFER_PUBLIC_KEY,
		contractDestinationPath: BACKEND_SIGNING_PUBLIC_KEY,
		isRevisionAncestor: (ancestor, current) => {
			const result = spawnSync(
				'git',
				['-C', root, 'merge-base', '--is-ancestor', ancestor, current],
				{ stdio: 'ignore' }
			)
			return result.status === 0
		}
	})
}

const clientReadyArchivePaths = clientRevision => ({
	attestationPath: join(
		CLIENT_RELEASE_EVIDENCE_ROOT,
		clientRevision,
		'backend-client-ready-v1.json'
	),
	signaturePath: join(
		CLIENT_RELEASE_EVIDENCE_ROOT,
		clientRevision,
		'backend-client-ready-v1.json.sig'
	)
})

const cleanupCompleteArchivePaths = clientRevision => ({
	attestationPath: join(
		CLIENT_RELEASE_EVIDENCE_ROOT,
		clientRevision,
		'backend-cleanup-complete-v1.json'
	),
	signaturePath: join(
		CLIENT_RELEASE_EVIDENCE_ROOT,
		clientRevision,
		'backend-cleanup-complete-v1.json.sig'
	)
})

export const validateClientSwitchReceiptRaw = (
	raw,
	{
		backendPublicKeyRaw,
		frontendLifecyclePublicKeyPath,
		nowMs = Date.now()
	}
) => {
	if (!Number.isFinite(nowMs))
		fail('Client switch receipt time is invalid')
	const value = decodeCanonicalJson(
		raw,
		64 * 1024,
		'Client switch receipt'
	)
	assertExactKeys(
		value,
		CLIENT_SWITCH_RECEIPT_KEYS,
		'Client switch receipt'
	)
	parseCanonicalEd25519PublicKey(
		backendPublicKeyRaw,
		'Pinned backend public key'
	)
	if (
		value.version !== 1 ||
		value.kind !== CLIENT_SWITCH_RECEIPT_KIND ||
		!['soak-pinned', 'released'].includes(value.state) ||
		!REVISION_PATTERN.test(value.initialClientRevision) ||
		!SHA256_PATTERN.test(value.initialReleaseEvidenceSha256) ||
		!REVISION_PATTERN.test(value.backendServerRevision) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		!SHA256_PATTERN.test(value.clientReadySha256) ||
		!SHA256_PATTERN.test(value.clientReadySignatureSha256) ||
		value.backendSigningPublicKeySha256 !== sha256(backendPublicKeyRaw)
	) {
		fail('Client switch receipt does not bind its initial trust state')
	}
	assertIsoTimestamp(
		value.clientProcessStartedAt,
		'Client switch receipt clientProcessStartedAt'
	)
	assertIsoTimestamp(
		value.soakPinnedAt,
		'Client switch receipt soakPinnedAt'
	)
	if (
		Date.parse(value.clientProcessStartedAt) >
			Date.parse(value.soakPinnedAt) ||
		Date.parse(value.soakPinnedAt) > nowMs + MAX_FUTURE_SKEW_MS
	) {
		fail('Client switch receipt initial timestamps are invalid')
	}
	if (value.state === 'soak-pinned') {
		if (
			value.cleanupRevision !== null ||
			value.cleanupClientRevision !== null ||
			value.cleanupCompleteSha256 !== null ||
			value.cleanupCompleteSignatureSha256 !== null ||
			value.releasedAt !== null
		) {
			fail('Soak-pinned client switch receipt must not claim cleanup')
		}
	} else {
		if (
			!REVISION_PATTERN.test(value.cleanupRevision) ||
			!REVISION_PATTERN.test(value.cleanupClientRevision) ||
			!SHA256_PATTERN.test(value.cleanupCompleteSha256) ||
			!SHA256_PATTERN.test(value.cleanupCompleteSignatureSha256)
		) {
			fail('Released client switch receipt cleanup binding is invalid')
		}
		assertIsoTimestamp(
			value.releasedAt,
			'Client switch receipt releasedAt'
		)
		if (
			Date.parse(value.releasedAt) < Date.parse(value.soakPinnedAt) ||
			Date.parse(value.releasedAt) > nowMs + MAX_FUTURE_SKEW_MS
		) {
			fail('Released client switch receipt timestamp is invalid')
		}
	}
	const { signature, ...payload } = value
	assertExactKeys(
		payload,
		CLIENT_SWITCH_RECEIPT_PAYLOAD_KEYS,
		'Client switch receipt payload'
	)
	if (
		!verify(
			null,
			Buffer.from(JSON.stringify(payload)),
			readEd25519PublicKey(frontendLifecyclePublicKeyPath),
			readInlineSignature(signature)
		)
	) {
		fail('Client switch receipt lifecycle signature is invalid')
	}
	return value
}

const readClientSwitchContextForOwner = ({
	receiptPath,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	expectedUid,
	expectedGid,
	nowMs = Date.now(),
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	const owner = { expectedUid, expectedGid }
	for (const [path, label] of [
		[receiptPath, 'Client switch receipt'],
		[backendPublicKeyPath, 'Pinned backend public key'],
		[frontendPublicKeyPath, 'Frontend lifecycle public key']
	]) {
		validateSecureKeyParent(path, owner)
		assertOwnedRegularFile(path, label, owner)
	}
	const backendPublicKeyRaw = readFileSync(backendPublicKeyPath)
	const receiptRaw = readFileSync(receiptPath)
	const receipt = validateClientSwitchReceiptRaw(receiptRaw, {
		backendPublicKeyRaw,
		frontendLifecyclePublicKeyPath: frontendPublicKeyPath,
		nowMs
	})
	const paths = archivePaths(receipt.initialClientRevision)
	validateSecureKeyParent(paths.attestationPath, owner)
	validateSecureKeyParent(paths.signaturePath, owner)
	assertOwnedRegularFile(
		paths.attestationPath,
		'Archived backend client-ready attestation',
		owner
	)
	assertOwnedRegularFile(
		paths.signaturePath,
		'Archived backend client-ready signature',
		owner
	)
	const clientReadyRaw = readFileSync(paths.attestationPath)
	const clientReadySignatureRaw = readFileSync(paths.signaturePath)
	const clientReady = verifyBackendClientReadyAttestation(
		clientReadyRaw,
		clientReadySignatureRaw,
		backendPublicKeyPath,
		{
			expectedServerRevision: receipt.backendServerRevision,
			nowMs,
			requireFresh: false
		}
	)
	if (
		sha256(clientReadyRaw) !== receipt.clientReadySha256 ||
		sha256(clientReadySignatureRaw) !==
			receipt.clientReadySignatureSha256 ||
		clientReady.identityDatabaseId !== receipt.identityDatabaseId
	) {
		fail(
			'Archived backend client-ready bytes do not match the switch receipt'
		)
	}
	if (receipt.state === 'released') {
		const cleanupPaths = cleanupArchivePaths(receipt.cleanupClientRevision)
		if (
			!pathEntryExists(cleanupPaths.attestationPath) ||
			!pathEntryExists(cleanupPaths.signaturePath)
		) {
			fail(
				'Released client switch receipt lacks its permanent cleanup pair'
			)
		}
		validateSecureKeyParent(cleanupPaths.attestationPath, owner)
		validateSecureKeyParent(cleanupPaths.signaturePath, owner)
		assertOwnedRegularFile(
			cleanupPaths.attestationPath,
			'Permanent backend cleanup-complete attestation',
			owner
		)
		assertOwnedRegularFile(
			cleanupPaths.signaturePath,
			'Permanent backend cleanup-complete signature',
			owner
		)
		const cleanupRaw = readFileSync(cleanupPaths.attestationPath)
		const cleanupSignatureRaw = readFileSync(cleanupPaths.signaturePath)
		const cleanup = verifyBackendCleanupCompleteAttestation(
			cleanupRaw,
			cleanupSignatureRaw,
			backendPublicKeyPath,
			{ nowMs }
		)
		if (
			sha256(cleanupRaw) !== receipt.cleanupCompleteSha256 ||
			sha256(cleanupSignatureRaw) !==
				receipt.cleanupCompleteSignatureSha256 ||
			cleanup.cleanupRevision !== receipt.cleanupRevision ||
			cleanup.currentClientRevision !== receipt.cleanupClientRevision ||
			cleanup.initialClientRevision !== receipt.initialClientRevision ||
			cleanup.ownershipRevision !== receipt.backendServerRevision ||
			cleanup.identityDatabaseId !== receipt.identityDatabaseId
		) {
			fail('Permanent cleanup pair differs from the released receipt')
		}
	}
	return {
		backendPublicKeyRaw,
		receiptRaw,
		receipt,
		clientReadyRaw,
		clientReadySignatureRaw,
		clientReady,
		archivePaths: paths
	}
}

const deriveClientCleanupFinalization = context => {
	if (context.receipt.state !== 'released') {
		fail('Cleanup finalization requires a released client switch receipt')
	}
	const value = {
		version: 1,
		kind: CLIENT_CLEANUP_FINALIZATION_KIND,
		state: 'finalized',
		cleanupRevision: context.receipt.cleanupRevision,
		cleanupClientRevision: context.receipt.cleanupClientRevision,
		clientSwitchReceiptSha256: sha256(context.receiptRaw),
		cleanupCompleteSha256: context.receipt.cleanupCompleteSha256,
		cleanupCompleteSignatureSha256:
			context.receipt.cleanupCompleteSignatureSha256,
		retiredStateContractSha256: sha256(
			CLIENT_CLEANUP_RETIRED_STATE_CONTRACT
		)
	}
	assertExactKeys(
		value,
		CLIENT_CLEANUP_FINALIZATION_KEYS,
		'Client cleanup finalization proof'
	)
	return value
}

export const validateClientCleanupFinalizationRaw = (
	raw,
	signatureRaw,
	{ context, frontendPublicKeyPath }
) => {
	const value = decodeCanonicalJson(
		raw,
		64 * 1024,
		'Client cleanup finalization proof'
	)
	assertExactKeys(
		value,
		CLIENT_CLEANUP_FINALIZATION_KEYS,
		'Client cleanup finalization proof'
	)
	const expected = deriveClientCleanupFinalization(context)
	if (
		value.version !== 1 ||
		value.kind !== CLIENT_CLEANUP_FINALIZATION_KIND ||
		value.state !== 'finalized' ||
		!REVISION_PATTERN.test(value.cleanupRevision) ||
		!REVISION_PATTERN.test(value.cleanupClientRevision) ||
		!SHA256_PATTERN.test(value.clientSwitchReceiptSha256) ||
		!SHA256_PATTERN.test(value.cleanupCompleteSha256) ||
		!SHA256_PATTERN.test(value.cleanupCompleteSignatureSha256) ||
		!SHA256_PATTERN.test(value.retiredStateContractSha256) ||
		JSON.stringify(value) !== JSON.stringify(expected)
	) {
		fail(
			'Client cleanup finalization proof differs from the released receipt'
		)
	}
	if (
		!verify(
			null,
			raw,
			readEd25519PublicKey(frontendPublicKeyPath),
			readSignature(signatureRaw)
		)
	) {
		fail('Client cleanup finalization signature is invalid')
	}
	return value
}

export const readClientCleanupFinalizationForOwner = ({
	proofPath,
	proofSignaturePath,
	receiptPath,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	expectedUid,
	expectedGid,
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	const owner = { expectedUid, expectedGid }
	const context = readClientSwitchContextForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		...owner,
		archivePaths,
		cleanupArchivePaths
	})
	for (const [path, label] of [
		[proofPath, 'Client cleanup finalization proof'],
		[proofSignaturePath, 'Client cleanup finalization signature']
	]) {
		validateSecureKeyParent(path, owner)
		assertOwnedRegularFile(path, label, owner)
	}
	return validateClientCleanupFinalizationRaw(
		readFileSync(proofPath),
		readFileSync(proofSignaturePath),
		{ context, frontendPublicKeyPath }
	)
}

export const writeClientCleanupFinalizationForOwner = ({
	proofPath,
	proofSignaturePath,
	receiptPath,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	expectedUid,
	expectedGid,
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	const owner = { expectedUid, expectedGid }
	for (const path of [
		proofPath,
		proofSignaturePath,
		frontendPrivateKeyPath
	]) {
		validateSecureKeyParent(path, owner)
	}
	assertOwnedRegularFile(
		frontendPrivateKeyPath,
		'Frontend lifecycle private key',
		owner
	)
	const context = readClientSwitchContextForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		...owner,
		archivePaths,
		cleanupArchivePaths
	})
	const raw = Buffer.from(
		JSON.stringify(deriveClientCleanupFinalization(context))
	)
	const signatureRaw = Buffer.from(
		`${sign(
			null,
			raw,
			readEd25519PrivateKey(frontendPrivateKeyPath)
		).toString('base64')}\n`
	)
	validateClientCleanupFinalizationRaw(raw, signatureRaw, {
		context,
		frontendPublicKeyPath
	})
	if (pathEntryExists(proofPath) && !pathEntryExists(proofSignaturePath)) {
		fail('Client cleanup finalization body exists without its signature')
	}
	// The signature is durable first; the proof body is the completion marker
	// and is published only after every external teardown check has succeeded.
	durablePublishNoClobber({
		destination: proofSignaturePath,
		pending: `${proofSignaturePath}.pending`,
		raw: signatureRaw,
		mode: 0o600,
		owner,
		label: 'Client cleanup finalization signature'
	})
	durablePublishNoClobber({
		destination: proofPath,
		pending: `${proofPath}.pending`,
		raw,
		mode: 0o600,
		owner,
		label: 'Client cleanup finalization proof'
	})
	return readClientCleanupFinalizationForOwner({
		proofPath,
		proofSignaturePath,
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		...owner,
		archivePaths,
		cleanupArchivePaths
	})
}

export const createClientSwitchReceiptForOwner = ({
	receiptPath,
	archiveAttestationPath,
	archiveSignaturePath,
	clientReadyRaw,
	clientReadySignatureRaw,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	clientRevision,
	releaseEvidenceSha256,
	expectedBackendServerRevision,
	expectedClientReadySha256,
	expectedClientReadySignatureSha256,
	clientProcessStartedAt,
	soakPinnedAt = new Date().toISOString(),
	expectedUid,
	expectedGid
}) => {
	if (
		!REVISION_PATTERN.test(clientRevision) ||
		!SHA256_PATTERN.test(releaseEvidenceSha256) ||
		!REVISION_PATTERN.test(expectedBackendServerRevision) ||
		!SHA256_PATTERN.test(expectedClientReadySha256) ||
		!SHA256_PATTERN.test(expectedClientReadySignatureSha256)
	) {
		fail('Client switch receipt release identity is invalid')
	}
	assertIsoTimestamp(
		clientProcessStartedAt,
		'Client switch receipt clientProcessStartedAt'
	)
	assertIsoTimestamp(soakPinnedAt, 'Client switch receipt soakPinnedAt')
	if (Date.parse(clientProcessStartedAt) > Date.parse(soakPinnedAt)) {
		fail('Client switch receipt cannot predate its client process')
	}
	const owner = { expectedUid, expectedGid }
	for (const path of [
		receiptPath,
		archiveAttestationPath,
		archiveSignaturePath,
		backendPublicKeyPath,
		frontendPrivateKeyPath,
		frontendPublicKeyPath
	]) {
		validateSecureKeyParent(path, owner)
	}
	for (const [path, label] of [
		[backendPublicKeyPath, 'Pinned backend public key'],
		[frontendPrivateKeyPath, 'Frontend lifecycle private key'],
		[frontendPublicKeyPath, 'Frontend lifecycle public key']
	]) {
		assertOwnedRegularFile(path, label, owner)
	}
	const clientReady = verifyBackendClientReadyAttestation(
		clientReadyRaw,
		clientReadySignatureRaw,
		backendPublicKeyPath,
		{
			expectedServerRevision: expectedBackendServerRevision,
			nowMs: Date.parse(soakPinnedAt)
		}
	)
	if (
		sha256(clientReadyRaw) !== expectedClientReadySha256 ||
		sha256(clientReadySignatureRaw) !== expectedClientReadySignatureSha256
	) {
		fail('Backend client-ready bytes changed after the pre-compose gate')
	}
	durablePublishNoClobber({
		destination: archiveAttestationPath,
		pending: `${archiveAttestationPath}.pending`,
		raw: clientReadyRaw,
		mode: 0o600,
		owner,
		label: 'Archived backend client-ready attestation'
	})
	durablePublishNoClobber({
		destination: archiveSignaturePath,
		pending: `${archiveSignaturePath}.pending`,
		raw: clientReadySignatureRaw,
		mode: 0o600,
		owner,
		label: 'Archived backend client-ready signature'
	})
	const backendPublicKeyRaw = readFileSync(backendPublicKeyPath)
	parseCanonicalEd25519PublicKey(
		backendPublicKeyRaw,
		'Pinned backend public key'
	)
	const payload = {
		version: 1,
		kind: CLIENT_SWITCH_RECEIPT_KIND,
		state: 'soak-pinned',
		initialClientRevision: clientRevision,
		initialReleaseEvidenceSha256: releaseEvidenceSha256,
		backendServerRevision: clientReady.serverRevision,
		identityDatabaseId: clientReady.identityDatabaseId,
		clientReadySha256: sha256(clientReadyRaw),
		clientReadySignatureSha256: sha256(clientReadySignatureRaw),
		backendSigningPublicKeySha256: sha256(backendPublicKeyRaw),
		clientProcessStartedAt,
		soakPinnedAt,
		cleanupRevision: null,
		cleanupClientRevision: null,
		cleanupCompleteSha256: null,
		cleanupCompleteSignatureSha256: null,
		releasedAt: null
	}
	assertExactKeys(
		payload,
		CLIENT_SWITCH_RECEIPT_PAYLOAD_KEYS,
		'Client switch receipt payload'
	)
	const signature = sign(
		null,
		Buffer.from(JSON.stringify(payload)),
		readEd25519PrivateKey(frontendPrivateKeyPath)
	).toString('base64')
	readInlineSignature(signature)
	const receiptRaw = Buffer.from(JSON.stringify({ ...payload, signature }))
	if (pathEntryExists(receiptPath)) {
		const existing = readClientSwitchContextForOwner({
			receiptPath,
			backendPublicKeyPath,
			frontendPublicKeyPath,
			...owner,
			nowMs: Date.parse(soakPinnedAt),
			archivePaths: () => ({
				attestationPath: archiveAttestationPath,
				signaturePath: archiveSignaturePath
			})
		})
		if (!existing.receiptRaw.equals(receiptRaw)) {
			fail(
				'Existing client switch receipt differs from the initial deploy'
			)
		}
		return existing.receipt
	}
	durablePublishNoClobber({
		destination: receiptPath,
		pending: `${receiptPath}.pending`,
		raw: receiptRaw,
		mode: 0o600,
		owner,
		label: 'Client switch receipt'
	})
	return validateClientSwitchReceiptRaw(receiptRaw, {
		backendPublicKeyRaw,
		frontendLifecyclePublicKeyPath: frontendPublicKeyPath,
		nowMs: Date.parse(soakPinnedAt)
	})
}

const promoteVerifiedClientSwitchReceiptForOwner = ({
	receiptPath,
	cleanupRaw,
	cleanupSignatureRaw,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	expectedCleanupClientRevision,
	expectedCleanupFrontendBinding,
	releasedAt = new Date().toISOString(),
	expectedUid,
	expectedGid,
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	assertIsoTimestamp(releasedAt, 'Client switch receipt releasedAt')
	const owner = { expectedUid, expectedGid }
	assertOwnedRegularFile(
		frontendPrivateKeyPath,
		'Frontend lifecycle private key',
		owner
	)
	const context = readClientSwitchContextForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		...owner,
		nowMs: Date.parse(releasedAt),
		archivePaths,
		cleanupArchivePaths
	})
	const cleanup = verifyBackendCleanupCompleteAttestation(
		cleanupRaw,
		cleanupSignatureRaw,
		backendPublicKeyPath,
		{ nowMs: Date.parse(releasedAt) }
	)
	const cleanupClientRevision = expectedCleanupClientRevision
	if (!REVISION_PATTERN.test(cleanupClientRevision)) {
		fail('Expected cleanup client revision is invalid')
	}
	if (
		cleanup.ownershipRevision !== context.receipt.backendServerRevision ||
		cleanup.initialClientRevision !==
			context.receipt.initialClientRevision ||
		cleanup.currentClientRevision !== cleanupClientRevision ||
		cleanup.identityDatabaseId !== context.receipt.identityDatabaseId ||
		!expectedCleanupFrontendBinding ||
		JSON.stringify(cleanup.frontendBinding) !==
			JSON.stringify(expectedCleanupFrontendBinding) ||
		cleanup.clientReadyEvidenceSha256 !==
			context.receipt.clientReadySha256 ||
		cleanup.clientReadyEvidenceSignatureSha256 !==
			context.receipt.clientReadySignatureSha256 ||
		Date.parse(cleanup.completedAt) > Date.parse(releasedAt)
	) {
		fail(
			'Backend cleanup-complete does not bind the initial client switch'
		)
	}
	const cleanupSha = sha256(cleanupRaw)
	const cleanupSignatureSha = sha256(cleanupSignatureRaw)
	if (context.receipt.state === 'released') {
		if (
			context.receipt.cleanupRevision !== cleanup.cleanupRevision ||
			context.receipt.cleanupClientRevision !==
				cleanup.currentClientRevision ||
			context.receipt.cleanupCompleteSha256 !== cleanupSha ||
			context.receipt.cleanupCompleteSignatureSha256 !==
				cleanupSignatureSha
		) {
			fail(
				'Released client switch receipt binds a different cleanup proof'
			)
		}
		return context.receipt
	}
	const cleanupPaths = cleanupArchivePaths(cleanup.currentClientRevision)
	if (
		pathEntryExists(cleanupPaths.attestationPath) &&
		!pathEntryExists(cleanupPaths.signaturePath)
	) {
		fail('Permanent cleanup body exists without its signature')
	}
	durablePublishNoClobber({
		destination: cleanupPaths.signaturePath,
		pending: `${cleanupPaths.signaturePath}.pending`,
		raw: cleanupSignatureRaw,
		mode: 0o600,
		owner,
		label: 'Permanent backend cleanup-complete signature'
	})
	durablePublishNoClobber({
		destination: cleanupPaths.attestationPath,
		pending: `${cleanupPaths.attestationPath}.pending`,
		raw: cleanupRaw,
		mode: 0o600,
		owner,
		label: 'Permanent backend cleanup-complete attestation'
	})
	const payload = {
		version: 1,
		kind: CLIENT_SWITCH_RECEIPT_KIND,
		state: 'released',
		initialClientRevision: context.receipt.initialClientRevision,
		initialReleaseEvidenceSha256:
			context.receipt.initialReleaseEvidenceSha256,
		backendServerRevision: context.receipt.backendServerRevision,
		identityDatabaseId: context.receipt.identityDatabaseId,
		clientReadySha256: context.receipt.clientReadySha256,
		clientReadySignatureSha256: context.receipt.clientReadySignatureSha256,
		backendSigningPublicKeySha256:
			context.receipt.backendSigningPublicKeySha256,
		clientProcessStartedAt: context.receipt.clientProcessStartedAt,
		soakPinnedAt: context.receipt.soakPinnedAt,
		cleanupRevision: cleanup.cleanupRevision,
		cleanupClientRevision: cleanup.currentClientRevision,
		cleanupCompleteSha256: cleanupSha,
		cleanupCompleteSignatureSha256: cleanupSignatureSha,
		releasedAt
	}
	assertExactKeys(
		payload,
		CLIENT_SWITCH_RECEIPT_PAYLOAD_KEYS,
		'Released client switch receipt payload'
	)
	const signature = sign(
		null,
		Buffer.from(JSON.stringify(payload)),
		readEd25519PrivateKey(frontendPrivateKeyPath)
	).toString('base64')
	readInlineSignature(signature)
	const releasedRaw = Buffer.from(
		JSON.stringify({ ...payload, signature })
	)
	atomicWrite(receiptPath, releasedRaw, 0o600)
	assertOwnedRegularFile(receiptPath, 'Client switch receipt', owner)
	return validateClientSwitchReceiptRaw(releasedRaw, {
		backendPublicKeyRaw: context.backendPublicKeyRaw,
		frontendLifecyclePublicKeyPath: frontendPublicKeyPath,
		nowMs: Date.parse(releasedAt)
	})
}

export const verifyAndPromoteClientSwitchReceiptForOwner = async ({
	repositoryRoot,
	receiptPath,
	cleanupRaw,
	cleanupSignatureRaw,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	retargetStatePath,
	retargetRoot,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	runtimeRebindPrivateRoot,
	releasedAt = new Date().toISOString(),
	expectedUid,
	expectedGid,
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	assertIsoTimestamp(releasedAt, 'Client switch receipt releasedAt')
	const nowMs = Date.parse(releasedAt)
	const cleanup = verifyBackendCleanupCompleteAttestation(
		cleanupRaw,
		cleanupSignatureRaw,
		backendPublicKeyPath,
		{ nowMs }
	)
	const context = readClientSwitchContextForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		expectedUid,
		expectedGid,
		nowMs,
		archivePaths,
		cleanupArchivePaths
	})
	const { verifyCleanupFrontendBindingForOwner } =
		await import('./identity-avatar-client-runtime-rebind.mjs')
	const expectedCleanupFrontendBinding =
		verifyCleanupFrontendBindingForOwner({
			cleanup,
			receipt: context.receipt,
			...(repositoryRoot ? { repositoryRoot } : {}),
			receiptPath,
			...(retargetStatePath ? { retargetStatePath } : {}),
			...(retargetRoot ? { retargetRoot } : {}),
			releaseRoot,
			...(runtimeRebindPrivateRoot
				? { privateRoot: runtimeRebindPrivateRoot }
				: {}),
			frontendPublicKeyPath,
			backendPublicKeyPath,
			owner: { uid: expectedUid, gid: expectedGid }
		})
	return promoteVerifiedClientSwitchReceiptForOwner({
		receiptPath,
		cleanupRaw,
		cleanupSignatureRaw,
		backendPublicKeyPath,
		frontendPrivateKeyPath,
		frontendPublicKeyPath,
		expectedCleanupClientRevision: cleanup.currentClientRevision,
		expectedCleanupFrontendBinding,
		releasedAt,
		expectedUid,
		expectedGid,
		archivePaths,
		cleanupArchivePaths
	})
}

const gitRevisionIsAncestor = (repositoryRoot, ancestor, current) => {
	const root = realpathSync(repositoryRoot)
	const result = spawnSync(
		'git',
		['-C', root, 'merge-base', '--is-ancestor', ancestor, current],
		{ stdio: 'ignore' }
	)
	return result.status === 0
}

export const readClientSwitchGuardForOwner = ({
	receiptPath,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	currentClientRevision,
	expectedUid,
	expectedGid,
	isRevisionAncestor,
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	if (!REVISION_PATTERN.test(currentClientRevision)) {
		fail(
			'Current client revision must be exactly 40 lowercase hex characters'
		)
	}
	if (!pathEntryExists(receiptPath)) return 'initial'
	const context = readClientSwitchContextForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		expectedUid,
		expectedGid,
		archivePaths,
		cleanupArchivePaths
	})
	if (context.receipt.state === 'soak-pinned') {
		return currentClientRevision === context.receipt.initialClientRevision
			? 'soak-pinned'
			: 'cleanup-required'
	}
	if (
		!isRevisionAncestor(
			context.receipt.cleanupClientRevision,
			currentClientRevision
		)
	) {
		fail(
			'Released frontend revisions must descend from cleanupClientRevision'
		)
	}
	return 'released'
}

export const readClientSwitchGuard = ({
	currentClientRevision,
	repositoryRoot
}) => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client switch guard may only be evaluated by root')
	}
	return readClientSwitchGuardForOwner({
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		currentClientRevision,
		expectedUid: 0,
		expectedGid: 0,
		isRevisionAncestor: (ancestor, current) =>
			gitRevisionIsAncestor(repositoryRoot, ancestor, current)
	})
}

export const createClientSwitchReceipt = ({
	clientRevision,
	releaseEvidenceSha256,
	backendServerRevision,
	clientReadySha256,
	clientReadySignatureSha256,
	clientProcessStartedAt,
	clientReadyPath,
	clientReadySignaturePath
}) => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client switch receipt may only be written by root')
	}
	const paths = clientReadyArchivePaths(clientRevision)
	return createClientSwitchReceiptForOwner({
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		archiveAttestationPath: paths.attestationPath,
		archiveSignaturePath: paths.signaturePath,
		clientReadyRaw: readBoundedRegularFile(
			clientReadyPath,
			BACKEND_READY_MAX_BYTES,
			'Backend client-ready attestation'
		),
		clientReadySignatureRaw: readBoundedRegularFile(
			clientReadySignaturePath,
			1024,
			'Backend client-ready signature'
		),
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		clientRevision,
		releaseEvidenceSha256,
		expectedBackendServerRevision: backendServerRevision,
		expectedClientReadySha256: clientReadySha256,
		expectedClientReadySignatureSha256: clientReadySignatureSha256,
		clientProcessStartedAt,
		expectedUid: 0,
		expectedGid: 0
	})
}

const assertBackendAttestationHeaders = (
	response,
	{ expectedContentType, expectedRevision, label }
) => {
	const cacheTokens = (response.headers.get('cache-control') ?? '')
		.split(',')
		.map(value => value.trim().toLowerCase())
	const responseRevision =
		response.headers.get('x-winwidget-revision') ?? ''
	if (
		response.status !== 200 ||
		response.redirected === true ||
		response.headers.has('location') ||
		cacheTokens.length !== 2 ||
		new Set(cacheTokens).size !== 2 ||
		!cacheTokens.includes('no-store') ||
		!cacheTokens.includes('max-age=0') ||
		response.headers.get('content-type') !== expectedContentType ||
		(
			response.headers.get('x-content-type-options') ?? ''
		).toLowerCase() !== 'nosniff' ||
		(expectedRevision
			? responseRevision !== expectedRevision
			: !REVISION_PATTERN.test(responseRevision))
	) {
		fail(`${label} HTTPS headers do not match the frozen contract`)
	}
	return responseRevision
}

const readBoundedResponse = async (
	response,
	label,
	maxBytes = BACKEND_READY_MAX_BYTES
) => {
	const declaredLength = response.headers.get('content-length')
	if (
		declaredLength !== null &&
		(!/^(0|[1-9][0-9]*)$/.test(declaredLength) ||
			Number(declaredLength) > maxBytes)
	) {
		fail(`${label} declared size is outside the allowed range`)
	}
	const raw = Buffer.from(await response.arrayBuffer())
	if (raw.length === 0 || raw.length > maxBytes) {
		fail(`${label} size is outside the allowed range`)
	}
	return raw
}

export const fetchStableBackendCleanupComplete = async ({
	fetchImpl = globalThis.fetch,
	nowMs = Date.now()
} = {}) => {
	if (typeof fetchImpl !== 'function' || !Number.isFinite(nowMs)) {
		fail('Backend cleanup-complete fetch inputs are invalid')
	}
	const fetchArtifact = async (
		url,
		expectedContentType,
		expectedRevision,
		label,
		maxBytes = BACKEND_READY_MAX_BYTES
	) => {
		const response = await fetchImpl(url, {
			method: 'GET',
			redirect: 'manual',
			signal: AbortSignal.timeout(30_000),
			headers: { accept: expectedContentType }
		})
		const responseRevision = assertBackendAttestationHeaders(response, {
			expectedContentType,
			expectedRevision,
			label
		})
		return {
			raw: await readBoundedResponse(response, label, maxBytes),
			responseRevision
		}
	}

	const first = await fetchArtifact(
		BACKEND_CLEANUP_COMPLETE_URL,
		'application/json; charset=utf-8',
		undefined,
		'Backend cleanup-complete attestation'
	)
	const cleanup = validateBackendCleanupCompleteRaw(first.raw, { nowMs })
	if (first.responseRevision !== cleanup.cleanupRevision) {
		fail(
			'Backend cleanup-complete revision header does not match its body'
		)
	}
	const signature = await fetchArtifact(
		`${BACKEND_CLEANUP_COMPLETE_URL}.sig`,
		'application/octet-stream',
		cleanup.cleanupRevision,
		'Backend cleanup-complete signature',
		1024
	)
	const second = await fetchArtifact(
		BACKEND_CLEANUP_COMPLETE_URL,
		'application/json; charset=utf-8',
		cleanup.cleanupRevision,
		'Backend cleanup-complete attestation'
	)
	if (!first.raw.equals(second.raw)) {
		fail('Backend cleanup-complete body changed during stable-pair fetch')
	}
	return {
		attestationRaw: first.raw,
		signatureRaw: signature.raw,
		cleanup
	}
}

export const prefetchClientSwitchForOwner = async ({
	receiptPath,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	candidateClientRevision,
	expectedUid,
	expectedGid,
	fetchImpl = globalThis.fetch,
	nowMs = Date.now(),
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	runtimeRebindPrivateRoot
}) => {
	if (!REVISION_PATTERN.test(candidateClientRevision)) {
		fail(
			'Candidate client revision must be exactly 40 lowercase hex characters'
		)
	}
	if (!pathEntryExists(receiptPath)) return 'initial'
	const action = readClientSwitchGuardForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		currentClientRevision: candidateClientRevision,
		expectedUid,
		expectedGid,
		isRevisionAncestor: () => true,
		archivePaths,
		cleanupArchivePaths
	})
	if (action !== 'cleanup-required') return action
	const cleanup = await fetchStableBackendCleanupComplete({
		fetchImpl,
		nowMs
	})
	await verifyAndPromoteClientSwitchReceiptForOwner({
		receiptPath,
		cleanupRaw: cleanup.attestationRaw,
		cleanupSignatureRaw: cleanup.signatureRaw,
		backendPublicKeyPath,
		frontendPrivateKeyPath,
		frontendPublicKeyPath,
		releasedAt: new Date(nowMs).toISOString(),
		expectedUid,
		expectedGid,
		archivePaths,
		cleanupArchivePaths,
		releaseRoot,
		runtimeRebindPrivateRoot
	})
	return 'released'
}

export const prefetchClientSwitch = async candidateClientRevision => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client switch prefetch guard may only be evaluated by root')
	}
	return prefetchClientSwitchForOwner({
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		candidateClientRevision,
		expectedUid: 0,
		expectedGid: 0
	})
}

export const readClientSwitchHashes = () => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client switch receipt may only be read by root')
	}
	const context = readClientSwitchContextForOwner({
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		expectedUid: 0,
		expectedGid: 0
	})
	return {
		clientReadySha256: context.receipt.clientReadySha256,
		clientReadySignatureSha256: context.receipt.clientReadySignatureSha256
	}
}

export const readReleasedClientSwitchBindingForOwner = ({
	receiptPath,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	expectedUid,
	expectedGid,
	archivePaths = clientReadyArchivePaths,
	cleanupArchivePaths = cleanupCompleteArchivePaths
}) => {
	const context = readClientSwitchContextForOwner({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		expectedUid,
		expectedGid,
		archivePaths,
		cleanupArchivePaths
	})
	if (context.receipt.state !== 'released') {
		fail('Client switch receipt is not released')
	}
	return {
		cleanupRevision: context.receipt.cleanupRevision,
		cleanupClientRevision: context.receipt.cleanupClientRevision,
		clientSwitchReceiptSha256: sha256(context.receiptRaw),
		cleanupCompleteSha256: context.receipt.cleanupCompleteSha256,
		cleanupCompleteSignatureSha256:
			context.receipt.cleanupCompleteSignatureSha256
	}
}

export const readReleasedClientSwitchBinding = () => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Released client switch binding may only be read by root')
	}
	return readReleasedClientSwitchBindingForOwner({
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		expectedUid: 0,
		expectedGid: 0
	})
}

export const writeClientCleanupFinalization = () => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client cleanup finalization proof may only be written by root')
	}
	return writeClientCleanupFinalizationForOwner({
		proofPath: CLIENT_CLEANUP_FINALIZATION_PATH,
		proofSignaturePath: CLIENT_CLEANUP_FINALIZATION_SIGNATURE_PATH,
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		expectedUid: 0,
		expectedGid: 0
	})
}

export const readClientCleanupFinalization = () => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client cleanup finalization proof may only be read by root')
	}
	return readClientCleanupFinalizationForOwner({
		proofPath: CLIENT_CLEANUP_FINALIZATION_PATH,
		proofSignaturePath: CLIENT_CLEANUP_FINALIZATION_SIGNATURE_PATH,
		receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
		backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
		frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
		expectedUid: 0,
		expectedGid: 0
	})
}

const parseArguments = args => {
	const result = {}
	for (let index = 0; index < args.length; index += 2) {
		const key = args[index]
		const value = args[index + 1]
		if (
			!key?.startsWith('--') ||
			value === undefined ||
			value.startsWith('--')
		) {
			fail('Every CLI option must use --name value form')
		}
		const name = key.slice(2)
		if (name in result) fail(`Duplicate CLI option: ${key}`)
		result[name] = value
	}
	return result
}

const requireOptions = (options, expected) => {
	if (
		JSON.stringify(Object.keys(options).sort()) !==
		JSON.stringify([...expected].sort())
	) {
		fail(`Expected only these CLI options: ${expected.join(', ')}`)
	}
}

const runCli = async () => {
	const [command, ...args] = process.argv.slice(2)
	const options = parseArguments(args)
	switch (command) {
		case 'generate-full-manifest': {
			requireOptions(options, ['root', 'revision', 'output'])
			const raw = generateFullReleaseManifest({
				repositoryRoot: options.root,
				clientRevision: options.revision
			})
			atomicWrite(options.output, raw, 0o600)
			break
		}
		case 'derive-release': {
			requireOptions(options, ['full-manifest', 'revision', 'output'])
			const fullManifestRaw = readBoundedRegularFile(
				options['full-manifest'],
				MAX_MANIFEST_BYTES,
				'Full release manifest'
			)
			atomicWrite(
				options.output,
				deriveReleaseEvidence(fullManifestRaw, options.revision),
				0o644
			)
			break
		}
		case 'materialize-standalone': {
			requireOptions(options, ['source', 'destination'])
			materializeStandaloneTree(options.source, options.destination)
			break
		}
		case 'provision-signing-key': {
			requireOptions(options, ['private-key', 'public-key'])
			provisionSigningKeyPair(
				options['private-key'],
				options['public-key']
			)
			break
		}
		case 'bootstrap-backend-trust': {
			requireOptions(options, ['revision', 'repository-root'])
			bootstrapBackendTrust({
				currentClientRevision: options.revision,
				repositoryRoot: options['repository-root']
			})
			break
		}
		case 'read-backend-deployment-revision': {
			requireOptions(options, ['health'])
			const value = validateBackendDeploymentHealthRaw(
				readBoundedRegularFile(
					options.health,
					BACKEND_READY_MAX_BYTES,
					'Backend deployment health'
				)
			)
			process.stdout.write(value.revision)
			break
		}
		case 'verify-backend-client-ready': {
			requireOptions(options, [
				'attestation',
				'signature',
				'public-key',
				'server-revision'
			])
			verifyBackendClientReadyAttestation(
				readBoundedRegularFile(
					options.attestation,
					BACKEND_READY_MAX_BYTES,
					'Backend client-ready attestation'
				),
				readBoundedRegularFile(
					options.signature,
					1024,
					'Backend client-ready signature'
				),
				options['public-key'],
				{ expectedServerRevision: options['server-revision'] }
			)
			break
		}
		case 'read-backend-cleanup-revision': {
			requireOptions(options, ['attestation'])
			const value = validateBackendCleanupCompleteRaw(
				readBoundedRegularFile(
					options.attestation,
					BACKEND_READY_MAX_BYTES,
					'Backend cleanup-complete attestation'
				)
			)
			process.stdout.write(value.cleanupRevision)
			break
		}
		case 'client-switch-guard': {
			requireOptions(options, ['revision', 'repository-root'])
			process.stdout.write(
				readClientSwitchGuard({
					currentClientRevision: options.revision,
					repositoryRoot: options['repository-root']
				})
			)
			break
		}
		case 'prefetch-client-switch': {
			requireOptions(options, ['revision'])
			process.stdout.write(await prefetchClientSwitch(options.revision))
			break
		}
		case 'create-client-switch-receipt': {
			requireOptions(options, [
				'revision',
				'release-sha',
				'backend-revision',
				'client-ready-sha',
				'client-ready-signature-sha',
				'process-started-at',
				'client-ready',
				'client-ready-signature'
			])
			createClientSwitchReceipt({
				clientRevision: options.revision,
				releaseEvidenceSha256: options['release-sha'],
				backendServerRevision: options['backend-revision'],
				clientReadySha256: options['client-ready-sha'],
				clientReadySignatureSha256: options['client-ready-signature-sha'],
				clientProcessStartedAt: options['process-started-at'],
				clientReadyPath: options['client-ready'],
				clientReadySignaturePath: options['client-ready-signature']
			})
			break
		}
		case 'read-client-switch-hashes': {
			requireOptions(options, [])
			const value = readClientSwitchHashes()
			process.stdout.write(
				`${value.clientReadySha256} ${value.clientReadySignatureSha256}`
			)
			break
		}
		case 'read-released-client-switch-binding': {
			requireOptions(options, [])
			const value = readReleasedClientSwitchBinding()
			process.stdout.write(
				`${value.cleanupRevision} ${value.cleanupClientRevision} ${value.clientSwitchReceiptSha256} ${value.cleanupCompleteSha256} ${value.cleanupCompleteSignatureSha256}`
			)
			break
		}
		case 'write-cleanup-finalization': {
			requireOptions(options, [])
			writeClientCleanupFinalization()
			process.stdout.write('finalized')
			break
		}
		case 'verify-cleanup-finalization': {
			requireOptions(options, [])
			readClientCleanupFinalization()
			process.stdout.write('finalized')
			break
		}
		case 'adopt-image': {
			requireOptions(options, [
				'journal',
				'revision',
				'image-id',
				'full-manifest',
				'release-evidence'
			])
			adoptReleaseImage({
				journalPath: options.journal,
				clientRevision: options.revision,
				imageId: options['image-id'],
				fullManifestPath: options['full-manifest'],
				releaseEvidencePath: options['release-evidence']
			})
			break
		}
		case 'read-adopted-image-id': {
			requireOptions(options, ['journal', 'revision'])
			assertRootOwnedJournal(options.journal, 'Image adoption journal')
			const value = validateImageAdoptionRaw(
				readBoundedRegularFile(
					options.journal,
					64 * 1024,
					'Image adoption journal'
				),
				options.revision
			)
			process.stdout.write(value.imageId)
			break
		}
		case 'sign-release': {
			requireOptions(options, [
				'manifest',
				'private-key',
				'public-key',
				'revision',
				'signature'
			])
			const manifestRaw = readBoundedRegularFile(
				options.manifest,
				64 * 1024,
				'Release evidence'
			)
			validateReleaseEvidenceRaw(manifestRaw, options.revision)
			const privateKey = readEd25519PrivateKey(options['private-key'])
			const signature = sign(null, manifestRaw, privateKey)
			const signatureRaw = Buffer.from(`${signature.toString('base64')}\n`)
			if (
				!verify(
					null,
					manifestRaw,
					readEd25519PublicKey(options['public-key']),
					signature
				)
			) {
				fail('New release evidence signature did not verify')
			}
			atomicWrite(options.signature, signatureRaw, 0o644)
			break
		}
		case 'verify-release': {
			requireOptions(options, [
				'manifest',
				'public-key',
				'revision',
				'signature'
			])
			verifyReleaseEvidenceSignature(
				readBoundedRegularFile(
					options.manifest,
					64 * 1024,
					'Release evidence'
				),
				readBoundedRegularFile(
					options.signature,
					1024,
					'Release signature'
				),
				options['public-key'],
				options.revision
			)
			break
		}
		case 'verify-runtime': {
			const expected = ['runtime', 'manifest', 'signature', 'revision']
			if ('previous-runtime' in options) expected.push('previous-runtime')
			requireOptions(options, expected)
			validateRuntimeEvidenceRaw(
				readBoundedRegularFile(
					options.runtime,
					64 * 1024,
					'Runtime evidence'
				),
				{
					expectedRevision: options.revision,
					releaseManifestRaw: readBoundedRegularFile(
						options.manifest,
						64 * 1024,
						'Release evidence'
					),
					releaseSignatureRaw: readBoundedRegularFile(
						options.signature,
						1024,
						'Release signature'
					),
					previousRuntimeRaw: options['previous-runtime']
						? readBoundedRegularFile(
								options['previous-runtime'],
								64 * 1024,
								'Previous runtime evidence'
							)
						: undefined
				}
			)
			break
		}
		default:
			fail('Unknown identity avatar client release evidence command')
	}
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (
	invokedPath &&
	invokedPath === resolve(new URL(import.meta.url).pathname)
) {
	try {
		await runCli()
	} catch (error) {
		console.error(
			error instanceof Error
				? error.message
				: 'Release evidence command failed'
		)
		process.exitCode = 1
	}
}
