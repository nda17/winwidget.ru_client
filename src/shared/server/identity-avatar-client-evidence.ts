import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TextDecoder } from 'node:util'

const RELEASE_ROOT = '/run/winwidget/identity-avatar-client-release'
const RELEASE_MANIFEST_NAME = 'release-evidence-v1.json'
const RELEASE_SIGNATURE_NAME = 'release-evidence-v1.json.sig'
const RETARGET_OUTCOME_NAME = 'soak-retarget-v1.json'
const RETARGET_OUTCOME_SIGNATURE_NAME = 'soak-retarget-v1.json.sig'
const IMAGE_ADOPTION_NAME = 'image-adoption-v1.json'
const IMAGE_ADOPTION_SIGNATURE_NAME = 'image-adoption-v1.json.sig'
const RELEASE_SCHEMA_VERSION = 1
const RELEASE_KIND = 'identity-avatar-client-release'
const RUNTIME_KIND = 'identity-avatar-client-runtime'
const RETARGET_KIND = 'identity-avatar-client-soak-retarget-applied'
const RUNTIME_REBIND_PREPARED_KIND =
	'identity-avatar-client-runtime-rebind-prepared-v1'
const RUNTIME_REBIND_ADOPTED_KIND =
	'identity-avatar-client-runtime-rebind-adopted-v1'
const RUNTIME_REBIND_MUTATION_START_KIND =
	'identity-avatar-client-runtime-rebind-mutation-start-v1'
const IMAGE_ADOPTION_KIND = 'identity-avatar-client-image-adoption-v1'
const SCAN_ROOTS = [
	'.next/server',
	'.next/standalone',
	'.next/static'
] as const
const RELEASE_CHECKS = [
	'full-next-server-tree-scanned',
	'full-next-standalone-tree-scanned',
	'full-next-static-tree-scanned',
	'legacy-api-v1-files-absent',
	'legacy-uploads-absent',
	'migration-credential-identifiers-absent',
	'identity-profile-avatar-api-present',
	'identity-admin-avatar-api-present'
] as const
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
] as const
const RETARGET_OUTCOME_KEYS = [
	'version',
	'kind',
	'initialClientRevision',
	'fromClientRevision',
	'toClientRevision',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'identityDatabaseId',
	'clientSwitchReceiptSha256',
	'retargetIntentSha256',
	'previousRetargetEvidenceSha256',
	'releaseEvidenceSha256',
	'releaseEvidenceSignatureSha256',
	'releaseTreeSha256',
	'releaseFullManifestSha256',
	'clientProcessStartedAt',
	'legacyReferencesAbsent',
	'fullBuildManifestPassed',
	'soakResetRequired',
	'verifiedAt'
] as const
const RUNTIME_REBIND_PREPARED_KEYS = [
	'schemaVersion',
	'kind',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'initialClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'currentFrontendRetargetEvidenceSha256',
	'currentFrontendRetargetEvidenceSignatureSha256',
	'previousFrontendRuntimeRebindEvidenceSha256',
	'previousFrontendRuntimeRebindEvidenceSignatureSha256',
	'previousRuntimeStabilityGeneration',
	'previousRuntimeStabilityEvidenceSha256',
	'backendCurrentEvidenceSha256',
	'backendCurrentEvidenceSignatureSha256',
	'backendCurrentPublishedAt',
	'generation',
	'rebindMode',
	'clientImageId',
	'releaseEvidenceSha256',
	'releaseEvidenceSignatureSha256',
	'releaseTreeSha256',
	'releaseFullManifestSha256',
	'previousClientProcessStartedAt',
	'observedClientProcessStartedAt',
	'legacyReferencesAbsent',
	'fullBuildManifestPassed',
	'preparedAt',
	'expiresAt'
] as const
const RUNTIME_REBIND_MUTATION_START_KEYS = [
	'schemaVersion',
	'kind',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'initialClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'generation',
	'rebindMode',
	'frontendPreparedEvidenceSha256',
	'frontendPreparedEvidenceSignatureSha256',
	'backendReadyEvidenceSha256',
	'backendReadyEvidenceSignatureSha256',
	'previousClientImageId',
	'previousClientProcessStartedAt',
	'mutationStartedAt'
] as const
const RUNTIME_REBIND_ADOPTED_KEYS = [
	'schemaVersion',
	'kind',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'initialClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'frontendPreparedEvidenceSha256',
	'frontendPreparedEvidenceSignatureSha256',
	'backendReadyEvidenceSha256',
	'backendReadyEvidenceSignatureSha256',
	'previousFrontendRuntimeRebindEvidenceSha256',
	'previousFrontendRuntimeRebindEvidenceSignatureSha256',
	'previousRuntimeStabilityEvidenceSha256',
	'generation',
	'rebindMode',
	'clientImageId',
	'releaseEvidenceSha256',
	'releaseEvidenceSignatureSha256',
	'releaseTreeSha256',
	'releaseFullManifestSha256',
	'previousClientProcessStartedAt',
	'clientProcessStartedAt',
	'firstHeartbeatEvidenceSha256',
	'firstHeartbeatEvidenceSignatureSha256',
	'firstHeartbeatWindowStartedAt',
	'firstHeartbeatWindowEndedAt',
	'logConfigurationSha256',
	'legacyReferencesAbsent',
	'fullBuildManifestPassed',
	'soakResetRequired',
	'adoptedAt'
] as const
const IMAGE_ADOPTION_KEYS = [
	'schemaVersion',
	'kind',
	'clientRevision',
	'clientImageId',
	'releaseEvidenceSha256',
	'releaseEvidenceSignatureSha256',
	'releaseTreeSha256',
	'releaseFullManifestSha256',
	'candidateTreeSha256',
	'clientLifecycleContractSha256',
	'adoptedAt'
] as const
const MAX_RELEASE_BYTES = 64 * 1024
const MAX_FILE_COUNT = 20_000
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
const REVISION_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const BUILD_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{86}==\n$/
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/
const SOAK_ARTIFACT_PATTERN =
	/^(heartbeat-([0-9]{6})-v1|latest-v1)\.json(\.sig)?$/
const RUNTIME_REBIND_ARTIFACT_PATTERN =
	/^(prepared-v1|mutation-start-v1|adopted-v1|heartbeat-000001-v1)\.json(\.sig)?$/
const RUNTIME_REBIND_GENERATION_PATTERN = /^generation-([0-9]{6})$/
const PROBE_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
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
] as const
const SOAK_LOG_FILE_KEYS = [
	'pathSha256',
	'device',
	'inode',
	'generation',
	'firstByteOffset',
	'lastByteOffset',
	'bytes',
	'sha256',
	'mtime'
] as const
const SOAK_HOSTS = ['winwidget.ru', 'www.winwidget.ru'] as const
const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)$/
const MAX_SOAK_FILES = 16
const MAX_SOAK_FILE_BYTES = BigInt(64 * 1024 * 1024)
const MAX_SOAK_SLICE_BYTES = BigInt(32 * 1024 * 1024)
const MAX_SOAK_WINDOW_MS = 26 * 60 * 60 * 1000
const MAX_SOAK_FUTURE_SKEW_MS = 2 * 60 * 1000
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

type ReleaseEvidence = {
	schemaVersion: number
	kind: string
	clientRevision: string
	nextBuildId: string
	scanRoots: string[]
	fileCount: number
	totalBytes: number
	treeSha256: string
	checks: string[]
	fullManifestSha256: string
	generatedAt: string
}

type RetargetOutcome = {
	version: number
	kind: string
	initialClientRevision: string
	fromClientRevision: string
	toClientRevision: string
	ownershipRevision: string
	currentBackendRuntimeRevision: string
	identityDatabaseId: string
	clientSwitchReceiptSha256: string
	retargetIntentSha256: string
	previousRetargetEvidenceSha256: string
	releaseEvidenceSha256: string
	releaseEvidenceSignatureSha256: string
	releaseTreeSha256: string
	releaseFullManifestSha256: string
	clientProcessStartedAt: string
	legacyReferencesAbsent: boolean
	fullBuildManifestPassed: boolean
	soakResetRequired: boolean
	verifiedAt: string
}

type ProcessEvidenceGlobal = typeof globalThis & {
	__winwidgetIdentityAvatarClientProcessStartedAt?: string
	__winwidgetIdentityAvatarClientSoakProbeClaims?: Map<string, number>
}

const processEvidenceGlobal = globalThis as ProcessEvidenceGlobal
const processStartedAt =
	processEvidenceGlobal.__winwidgetIdentityAvatarClientProcessStartedAt ||
	new Date().toISOString()
processEvidenceGlobal.__winwidgetIdentityAvatarClientProcessStartedAt =
	processStartedAt
const soakProbeClaims =
	processEvidenceGlobal.__winwidgetIdentityAvatarClientSoakProbeClaims ||
	new Map<string, number>()
processEvidenceGlobal.__winwidgetIdentityAvatarClientSoakProbeClaims =
	soakProbeClaims

const sha256 = (value: string | Buffer) =>
	createHash('sha256').update(value).digest('hex')

const isExactKeys = (value: unknown, expected: readonly string[]) => {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		JSON.stringify(Object.keys(value)) === JSON.stringify(expected)
	)
}

const isCanonicalTimestamp = (value: unknown): value is string => {
	return (
		typeof value === 'string' &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
		!Number.isNaN(Date.parse(value)) &&
		new Date(value).toISOString() === value
	)
}

const readRegularFile = (path: string, maxBytes: number) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.size <= 0 ||
		metadata.size > maxBytes
	) {
		throw new Error('Invalid client release evidence file')
	}
	return readFileSync(path)
}

const validateReleaseEvidence = (
	raw: Buffer,
	expectedRevision: string
): ReleaseEvidence => {
	if (raw.length === 0 || raw.length > MAX_RELEASE_BYTES) {
		throw new Error('Invalid client release evidence size')
	}
	const text = utf8Decoder.decode(raw)
	const value = JSON.parse(text) as ReleaseEvidence
	if (
		JSON.stringify(value) !== text ||
		!isExactKeys(value, RELEASE_KEYS)
	) {
		throw new Error('Client release evidence is not canonical')
	}
	if (
		value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
		value.kind !== RELEASE_KIND ||
		value.clientRevision !== expectedRevision ||
		!BUILD_ID_PATTERN.test(value.nextBuildId) ||
		JSON.stringify(value.scanRoots) !== JSON.stringify(SCAN_ROOTS) ||
		JSON.stringify(value.checks) !== JSON.stringify(RELEASE_CHECKS) ||
		!isCanonicalTimestamp(value.generatedAt) ||
		!Number.isSafeInteger(value.fileCount) ||
		value.fileCount < 1 ||
		value.fileCount > MAX_FILE_COUNT ||
		!Number.isSafeInteger(value.totalBytes) ||
		value.totalBytes < 0 ||
		value.totalBytes > MAX_TOTAL_BYTES ||
		!SHA256_PATTERN.test(value.treeSha256) ||
		!SHA256_PATTERN.test(value.fullManifestSha256)
	) {
		throw new Error('Client release evidence contract mismatch')
	}
	return value
}

const validateRetargetOutcome = (
	raw: Buffer,
	expectedRevision: string
): RetargetOutcome => {
	if (raw.length === 0 || raw.length > MAX_RELEASE_BYTES) {
		throw new Error('Invalid client retarget evidence size')
	}
	const text = utf8Decoder.decode(raw)
	const value = JSON.parse(text) as RetargetOutcome
	if (
		JSON.stringify(value) !== text ||
		!isExactKeys(value, RETARGET_OUTCOME_KEYS) ||
		value.version !== 1 ||
		value.kind !== RETARGET_KIND ||
		![
			value.initialClientRevision,
			value.fromClientRevision,
			value.toClientRevision,
			value.ownershipRevision,
			value.currentBackendRuntimeRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		value.fromClientRevision === value.toClientRevision ||
		value.toClientRevision !== expectedRevision ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		![
			value.clientSwitchReceiptSha256,
			value.retargetIntentSha256,
			value.previousRetargetEvidenceSha256,
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!isCanonicalTimestamp(value.clientProcessStartedAt) ||
		!isCanonicalTimestamp(value.verifiedAt) ||
		Date.parse(value.clientProcessStartedAt) >
			Date.parse(value.verifiedAt) ||
		value.legacyReferencesAbsent !== true ||
		value.fullBuildManifestPassed !== true ||
		value.soakResetRequired !== true
	) {
		throw new Error('Client retarget evidence contract mismatch')
	}
	return value
}

const validateImageAdoption = (raw: Buffer, expectedRevision: string) => {
	if (raw.length === 0 || raw.length > MAX_RELEASE_BYTES) {
		throw new Error('Invalid signed image-adoption evidence size')
	}
	const text = utf8Decoder.decode(raw)
	const value = JSON.parse(text) as Record<string, unknown>
	if (
		JSON.stringify(value) !== text ||
		!isExactKeys(value, IMAGE_ADOPTION_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== IMAGE_ADOPTION_KIND ||
		value.clientRevision !== expectedRevision ||
		!IMAGE_ID_PATTERN.test(String(value.clientImageId)) ||
		![
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256,
			value.candidateTreeSha256,
			value.clientLifecycleContractSha256
		].every(item => SHA256_PATTERN.test(String(item))) ||
		!isCanonicalTimestamp(value.adoptedAt)
	) {
		throw new Error('Signed image-adoption evidence contract mismatch')
	}
	return value
}

const getClientRevision = () => {
	const revision = process.env.APP_REVISION || ''
	if (!REVISION_PATTERN.test(revision)) {
		throw new Error('Client runtime revision is not pinned')
	}
	return revision
}

const readReleaseFiles = () => {
	const clientRevision = getClientRevision()
	const releaseDirectory = join(RELEASE_ROOT, clientRevision)
	const manifest = readRegularFile(
		join(releaseDirectory, RELEASE_MANIFEST_NAME),
		MAX_RELEASE_BYTES
	)
	const signature = readRegularFile(
		join(releaseDirectory, RELEASE_SIGNATURE_NAME),
		1024
	)
	validateReleaseEvidence(manifest, clientRevision)
	if (!SIGNATURE_PATTERN.test(signature.toString('ascii'))) {
		throw new Error('Client release evidence signature is not canonical')
	}
	const decodedSignature = Buffer.from(
		signature.subarray(0, signature.length - 1).toString('ascii'),
		'base64'
	)
	if (decodedSignature.length !== 64) {
		throw new Error(
			'Client release evidence signature has an invalid size'
		)
	}
	return { clientRevision, manifest, signature }
}

export const getReleaseArtifact = (
	requestedRevision: string,
	requestedArtifact: string
) => {
	const clientRevision = getClientRevision()
	if (requestedRevision !== clientRevision) return null
	const { manifest, signature } = readReleaseFiles()
	if (requestedArtifact === RELEASE_MANIFEST_NAME) {
		return {
			body: manifest,
			contentType: 'application/json; charset=utf-8'
		}
	}
	if (requestedArtifact === RELEASE_SIGNATURE_NAME) {
		return { body: signature, contentType: 'application/octet-stream' }
	}
	if (
		requestedArtifact === RETARGET_OUTCOME_NAME ||
		requestedArtifact === RETARGET_OUTCOME_SIGNATURE_NAME
	) {
		const releaseDirectory = join(RELEASE_ROOT, clientRevision)
		const outcome = readRegularFile(
			join(releaseDirectory, RETARGET_OUTCOME_NAME),
			MAX_RELEASE_BYTES
		)
		const outcomeSignature = readRegularFile(
			join(releaseDirectory, RETARGET_OUTCOME_SIGNATURE_NAME),
			1024
		)
		validateRetargetOutcome(outcome, clientRevision)
		if (!SIGNATURE_PATTERN.test(outcomeSignature.toString('ascii'))) {
			throw new Error('Client retarget signature is not canonical')
		}
		return requestedArtifact === RETARGET_OUTCOME_NAME
			? {
					body: outcome,
					contentType: 'application/json; charset=utf-8'
				}
			: {
					body: outcomeSignature,
					contentType: 'application/octet-stream'
				}
	}
	if (
		requestedArtifact === IMAGE_ADOPTION_NAME ||
		requestedArtifact === IMAGE_ADOPTION_SIGNATURE_NAME
	) {
		const releaseDirectory = join(RELEASE_ROOT, clientRevision)
		const evidence = readRegularFile(
			join(releaseDirectory, IMAGE_ADOPTION_NAME),
			MAX_RELEASE_BYTES
		)
		const evidenceSignature = readRegularFile(
			join(releaseDirectory, IMAGE_ADOPTION_SIGNATURE_NAME),
			1024
		)
		const value = validateImageAdoption(evidence, clientRevision)
		if (
			!SIGNATURE_PATTERN.test(evidenceSignature.toString('ascii')) ||
			value.releaseEvidenceSha256 !== sha256(manifest) ||
			value.releaseEvidenceSignatureSha256 !== sha256(signature)
		) {
			throw new Error('Signed image-adoption evidence binding is invalid')
		}
		return requestedArtifact === IMAGE_ADOPTION_NAME
			? {
					body: evidence,
					contentType: 'application/json; charset=utf-8'
				}
			: {
					body: evidenceSignature,
					contentType: 'application/octet-stream'
				}
	}
	return null
}

export const validateSoakArtifactBody = (
	body: Buffer,
	clientRevision: string,
	expectedSequence?: number,
	nowMs = Date.now(),
	expectedReleaseSha?: string,
	expectedProcessStartedAt?: string,
	expectedInitialAnchorSha = expectedReleaseSha
) => {
	const text = utf8Decoder.decode(body)
	const value = JSON.parse(text) as Record<string, unknown>
	if (
		JSON.stringify(value) !== text ||
		!isExactKeys(value, SOAK_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== 'identity-avatar-client-log-soak' ||
		value.clientRevision !== clientRevision ||
		!SHA256_PATTERN.test(String(value.releaseEvidenceSha256)) ||
		(expectedReleaseSha !== undefined &&
			value.releaseEvidenceSha256 !== expectedReleaseSha) ||
		!isCanonicalTimestamp(value.processStartedAt) ||
		(expectedProcessStartedAt !== undefined &&
			value.processStartedAt !== expectedProcessStartedAt) ||
		!SHA256_PATTERN.test(String(value.logConfigurationSha256)) ||
		typeof value.sequence !== 'number' ||
		!Number.isSafeInteger(value.sequence) ||
		value.sequence < 1 ||
		value.sequence > 64 ||
		(expectedSequence !== undefined &&
			value.sequence !== expectedSequence) ||
		!SHA256_PATTERN.test(String(value.previousEvidenceSha256)) ||
		!isCanonicalTimestamp(value.windowStartedAt) ||
		!isCanonicalTimestamp(value.windowEndedAt) ||
		value.generatedAt !== value.windowEndedAt ||
		!isCanonicalTimestamp(value.generatedAt) ||
		JSON.stringify(value.hosts) !== JSON.stringify(SOAK_HOSTS) ||
		value.probeClass !== 'soak-probe' ||
		value.probeRequestCount !== 1 ||
		typeof value.apiV1FilesRequestCount !== 'number' ||
		!Number.isSafeInteger(value.apiV1FilesRequestCount) ||
		value.apiV1FilesRequestCount !== 0 ||
		typeof value.uploadsGetHeadRequestCount !== 'number' ||
		!Number.isSafeInteger(value.uploadsGetHeadRequestCount) ||
		Number(value.uploadsGetHeadRequestCount) < 0 ||
		typeof value.uploadsSuccessfulGetHeadCount !== 'number' ||
		!Number.isSafeInteger(value.uploadsSuccessfulGetHeadCount) ||
		value.uploadsSuccessfulGetHeadCount !== 0 ||
		value.rotationContinuityPassed !== true ||
		value.futureSkewPassed !== true ||
		!Array.isArray(value.logFiles) ||
		value.logFiles.length > MAX_SOAK_FILES
	) {
		throw new Error('Client log soak artifact violates its frozen schema')
	}
	const processStartedAt = Date.parse(value.processStartedAt)
	const windowStartedAt = Date.parse(value.windowStartedAt)
	const windowEndedAt = Date.parse(value.windowEndedAt)
	if (
		windowStartedAt < processStartedAt ||
		windowEndedAt <= windowStartedAt ||
		windowEndedAt - windowStartedAt > MAX_SOAK_WINDOW_MS ||
		windowEndedAt > nowMs + MAX_SOAK_FUTURE_SKEW_MS
	) {
		throw new Error(
			'Client log soak artifact has an invalid process window'
		)
	}
	let previousPathSha = ''
	let totalSliceBytes = BigInt(0)
	for (const candidate of value.logFiles) {
		if (!isExactKeys(candidate, SOAK_LOG_FILE_KEYS)) {
			throw new Error('Client log soak file has unexpected keys')
		}
		const file = candidate as Record<string, unknown>
		if (
			!SHA256_PATTERN.test(String(file.pathSha256)) ||
			(Boolean(previousPathSha) &&
				String(file.pathSha256) <= previousPathSha) ||
			!SHA256_PATTERN.test(String(file.sha256)) ||
			!isCanonicalTimestamp(file.mtime)
		) {
			throw new Error('Client log soak file identity is invalid')
		}
		previousPathSha = String(file.pathSha256)
		for (const key of [
			'device',
			'inode',
			'generation',
			'firstByteOffset',
			'lastByteOffset',
			'bytes'
		]) {
			if (
				typeof file[key] !== 'string' ||
				!DECIMAL_PATTERN.test(file[key] as string)
			) {
				throw new Error('Client log soak file decimal is not canonical')
			}
		}
		const first = BigInt(file.firstByteOffset as string)
		const last = BigInt(file.lastByteOffset as string)
		const bytes = BigInt(file.bytes as string)
		if (last < first || bytes !== last - first) {
			throw new Error('Client log soak file exclusive offsets are invalid')
		}
		totalSliceBytes += bytes
		if (
			last > MAX_SOAK_FILE_BYTES ||
			bytes > MAX_SOAK_SLICE_BYTES ||
			totalSliceBytes > MAX_SOAK_SLICE_BYTES
		) {
			throw new Error('Client log soak file set exceeds its byte bound')
		}
	}
	if (value.logSetSha256 !== sha256(JSON.stringify(value.logFiles))) {
		throw new Error('Client log soak file-set hash is invalid')
	}
	if (
		value.sequence === 1 &&
		value.previousEvidenceSha256 !== expectedInitialAnchorSha
	) {
		throw new Error('First client log soak anchor is invalid')
	}
	return value
}

type RuntimeRebindPrepared = Record<string, unknown> & {
	generation: number
	previousRuntimeStabilityGeneration: number
	currentClientRevision: string
	clientImageId: string
	releaseEvidenceSha256: string
	releaseEvidenceSignatureSha256: string
	releaseTreeSha256: string
	releaseFullManifestSha256: string
	previousClientProcessStartedAt: string
	observedClientProcessStartedAt: string
	preparedAt: string
	expiresAt: string
	rebindMode: string
}

type RuntimeRebindMutationStart = Record<string, unknown> & {
	generation: number
	currentClientRevision: string
	previousClientImageId: string
	previousClientProcessStartedAt: string
	frontendPreparedEvidenceSha256: string
	frontendPreparedEvidenceSignatureSha256: string
	backendReadyEvidenceSha256: string
	backendReadyEvidenceSignatureSha256: string
	mutationStartedAt: string
}

type RuntimeRebindAdopted = Record<string, unknown> & {
	generation: number
	currentClientRevision: string
	clientImageId: string
	releaseEvidenceSha256: string
	releaseEvidenceSignatureSha256: string
	releaseTreeSha256: string
	releaseFullManifestSha256: string
	previousClientProcessStartedAt: string
	clientProcessStartedAt: string
	frontendPreparedEvidenceSha256: string
	frontendPreparedEvidenceSignatureSha256: string
	backendReadyEvidenceSha256: string
	firstHeartbeatEvidenceSha256: string
	firstHeartbeatEvidenceSignatureSha256: string
	firstHeartbeatWindowStartedAt: string
	firstHeartbeatWindowEndedAt: string
	logConfigurationSha256: string
	adoptedAt: string
}

const parseRuntimeRebindBody = (
	raw: Buffer,
	expectedKeys: readonly string[],
	label: string
) => {
	if (raw.length < 2 || raw.length > MAX_RELEASE_BYTES) {
		throw new Error(`${label} has an invalid size`)
	}
	const text = utf8Decoder.decode(raw)
	const value = JSON.parse(text) as Record<string, unknown>
	if (
		JSON.stringify(value) !== text ||
		!isExactKeys(value, expectedKeys)
	) {
		throw new Error(`${label} is not canonical`)
	}
	return value
}

const validateRuntimeRebindPreparedBody = (
	raw: Buffer,
	clientRevision: string,
	generation: number
) => {
	const value = parseRuntimeRebindBody(
		raw,
		RUNTIME_REBIND_PREPARED_KEYS,
		'Runtime rebind PREPARED'
	) as RuntimeRebindPrepared
	if (
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_PREPARED_KIND ||
		value.currentClientRevision !== clientRevision ||
		value.generation !== generation ||
		!Number.isSafeInteger(value.previousRuntimeStabilityGeneration) ||
		value.previousRuntimeStabilityGeneration < 0 ||
		value.previousRuntimeStabilityGeneration >= generation ||
		generation > Number(value.previousRuntimeStabilityGeneration) + 2 ||
		!['planned-restart', 'recovery-adoption'].includes(
			String(value.rebindMode)
		) ||
		!IMAGE_ID_PATTERN.test(value.clientImageId) ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(String(item))) ||
		!UUID_PATTERN.test(String(value.identityDatabaseId)) ||
		![
			value.previousRuntimeStabilityEvidenceSha256,
			value.backendCurrentEvidenceSha256,
			value.backendCurrentEvidenceSignatureSha256,
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256
		].every(item => SHA256_PATTERN.test(String(item))) ||
		!isCanonicalTimestamp(value.backendCurrentPublishedAt) ||
		!isCanonicalTimestamp(value.previousClientProcessStartedAt) ||
		!isCanonicalTimestamp(value.observedClientProcessStartedAt) ||
		!isCanonicalTimestamp(value.preparedAt) ||
		!isCanonicalTimestamp(value.expiresAt) ||
		Date.parse(String(value.preparedAt)) >
			Date.now() + MAX_SOAK_FUTURE_SKEW_MS ||
		Date.parse(String(value.expiresAt)) -
			Date.parse(String(value.preparedAt)) !==
			30 * 60 * 1000 ||
		Date.parse(String(value.backendCurrentPublishedAt)) <
			Date.parse(String(value.preparedAt)) - 5 * 60 * 1000 ||
		Date.parse(String(value.backendCurrentPublishedAt)) >
			Date.parse(String(value.preparedAt)) + 2 * 60 * 1000 ||
		Date.parse(String(value.backendCurrentPublishedAt)) >
			Date.now() + MAX_SOAK_FUTURE_SKEW_MS ||
		(value.rebindMode === 'planned-restart' &&
			value.observedClientProcessStartedAt !==
				value.previousClientProcessStartedAt) ||
		(value.rebindMode === 'recovery-adoption' &&
			Date.parse(value.observedClientProcessStartedAt) <=
				Date.parse(value.previousClientProcessStartedAt)) ||
		value.legacyReferencesAbsent !== true ||
		value.fullBuildManifestPassed !== true
	) {
		throw new Error('Runtime rebind PREPARED contract mismatch')
	}
	const hasRetarget =
		value.initialClientRevision !== value.currentClientRevision
	if (
		(hasRetarget &&
			(!SHA256_PATTERN.test(
				String(value.currentFrontendRetargetEvidenceSha256)
			) ||
				!SHA256_PATTERN.test(
					String(value.currentFrontendRetargetEvidenceSignatureSha256)
				))) ||
		(!hasRetarget &&
			(value.currentFrontendRetargetEvidenceSha256 !== null ||
				value.currentFrontendRetargetEvidenceSignatureSha256 !== null))
	) {
		throw new Error('Runtime rebind PREPARED retarget pair mismatch')
	}
	const previousRuntimePair = [
		value.previousFrontendRuntimeRebindEvidenceSha256,
		value.previousFrontendRuntimeRebindEvidenceSignatureSha256
	]
	if (
		previousRuntimePair.some(
			item => item !== null && !SHA256_PATTERN.test(String(item))
		) ||
		(previousRuntimePair[0] === null) !== (previousRuntimePair[1] === null)
	) {
		throw new Error('Runtime rebind PREPARED prior pair mismatch')
	}
	return value
}

const validateRuntimeRebindMutationStartBody = (
	raw: Buffer,
	clientRevision: string,
	generation: number,
	prepared: RuntimeRebindPrepared,
	preparedRaw: Buffer,
	preparedSignature: Buffer
) => {
	const value = parseRuntimeRebindBody(
		raw,
		RUNTIME_REBIND_MUTATION_START_KEYS,
		'Runtime rebind mutation-start'
	) as RuntimeRebindMutationStart
	if (
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_MUTATION_START_KIND ||
		value.currentClientRevision !== clientRevision ||
		value.generation !== generation ||
		value.rebindMode !== 'planned-restart' ||
		prepared.rebindMode !== 'planned-restart' ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(String(item))) ||
		!UUID_PATTERN.test(String(value.identityDatabaseId)) ||
		![
			value.frontendPreparedEvidenceSha256,
			value.frontendPreparedEvidenceSignatureSha256,
			value.backendReadyEvidenceSha256,
			value.backendReadyEvidenceSignatureSha256
		].every(item => SHA256_PATTERN.test(String(item))) ||
		!IMAGE_ID_PATTERN.test(value.previousClientImageId) ||
		!isCanonicalTimestamp(value.previousClientProcessStartedAt) ||
		!isCanonicalTimestamp(value.mutationStartedAt) ||
		Date.parse(value.mutationStartedAt) >
			Date.now() + MAX_SOAK_FUTURE_SKEW_MS ||
		value.ownershipRevision !== prepared.ownershipRevision ||
		value.currentBackendRuntimeRevision !==
			prepared.currentBackendRuntimeRevision ||
		value.initialClientRevision !== prepared.initialClientRevision ||
		value.identityDatabaseId !== prepared.identityDatabaseId ||
		value.frontendPreparedEvidenceSha256 !== sha256(preparedRaw) ||
		value.frontendPreparedEvidenceSignatureSha256 !==
			sha256(preparedSignature) ||
		value.previousClientImageId !== prepared.clientImageId ||
		value.previousClientProcessStartedAt !==
			prepared.previousClientProcessStartedAt ||
		Date.parse(value.mutationStartedAt) <=
			Date.parse(prepared.preparedAt) ||
		Date.parse(value.mutationStartedAt) > Date.parse(prepared.expiresAt)
	) {
		throw new Error('Runtime rebind mutation-start contract mismatch')
	}
	return value
}

const validateRuntimeRebindAdoptedBody = (
	raw: Buffer,
	clientRevision: string,
	generation: number
) => {
	const value = parseRuntimeRebindBody(
		raw,
		RUNTIME_REBIND_ADOPTED_KEYS,
		'Runtime rebind ADOPTED'
	) as RuntimeRebindAdopted
	if (
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_ADOPTED_KIND ||
		value.currentClientRevision !== clientRevision ||
		value.generation !== generation ||
		!['planned-restart', 'recovery-adoption'].includes(
			String(value.rebindMode)
		) ||
		!IMAGE_ID_PATTERN.test(value.clientImageId) ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(String(item))) ||
		!UUID_PATTERN.test(String(value.identityDatabaseId)) ||
		![
			value.frontendPreparedEvidenceSha256,
			value.frontendPreparedEvidenceSignatureSha256,
			value.backendReadyEvidenceSha256,
			value.backendReadyEvidenceSignatureSha256,
			value.previousRuntimeStabilityEvidenceSha256,
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256,
			value.firstHeartbeatEvidenceSha256,
			value.firstHeartbeatEvidenceSignatureSha256,
			value.logConfigurationSha256
		].every(item => SHA256_PATTERN.test(String(item))) ||
		!isCanonicalTimestamp(value.previousClientProcessStartedAt) ||
		!isCanonicalTimestamp(value.clientProcessStartedAt) ||
		Date.parse(value.clientProcessStartedAt) <=
			Date.parse(value.previousClientProcessStartedAt) ||
		!isCanonicalTimestamp(value.firstHeartbeatWindowStartedAt) ||
		!isCanonicalTimestamp(value.firstHeartbeatWindowEndedAt) ||
		!isCanonicalTimestamp(value.adoptedAt) ||
		Date.parse(value.firstHeartbeatWindowStartedAt) <
			Date.parse(value.clientProcessStartedAt) ||
		Date.parse(value.firstHeartbeatWindowEndedAt) <=
			Date.parse(value.firstHeartbeatWindowStartedAt) ||
		Date.parse(value.adoptedAt) <
			Date.parse(value.firstHeartbeatWindowEndedAt) ||
		Date.parse(value.adoptedAt) > Date.now() + MAX_SOAK_FUTURE_SKEW_MS ||
		value.legacyReferencesAbsent !== true ||
		value.fullBuildManifestPassed !== true ||
		value.soakResetRequired !== true
	) {
		throw new Error('Runtime rebind ADOPTED contract mismatch')
	}
	return value
}

export const getRuntimeRebindArtifact = (
	requestedRevision: string,
	requestedGeneration: string,
	requestedArtifact: string,
	{
		releaseRoot = RELEASE_ROOT,
		liveClientRevision = getClientRevision()
	}: { releaseRoot?: string; liveClientRevision?: string } = {}
) => {
	const clientRevision = liveClientRevision
	const generationMatch = requestedGeneration.match(
		RUNTIME_REBIND_GENERATION_PATTERN
	)
	const artifactMatch = requestedArtifact.match(
		RUNTIME_REBIND_ARTIFACT_PATTERN
	)
	if (
		requestedRevision !== clientRevision ||
		!generationMatch ||
		!artifactMatch
	) {
		return null
	}
	const generation = Number(generationMatch[1])
	if (generation < 1 || generation > 64) return null
	const root = join(
		releaseRoot,
		clientRevision,
		'runtime-rebind',
		requestedGeneration
	)
	const prepared = readRegularFile(
		join(root, 'prepared-v1.json'),
		MAX_RELEASE_BYTES
	)
	const preparedSignature = readRegularFile(
		join(root, 'prepared-v1.json.sig'),
		1024
	)
	const preparedValue = validateRuntimeRebindPreparedBody(
		prepared,
		clientRevision,
		generation
	)
	if (!SIGNATURE_PATTERN.test(preparedSignature.toString('ascii'))) {
		throw new Error('Runtime rebind PREPARED signature is not canonical')
	}
	const isSignature = Boolean(artifactMatch[2])
	if (artifactMatch[1] === 'prepared-v1') {
		return isSignature
			? {
					body: preparedSignature,
					contentType: 'application/octet-stream'
				}
			: {
					body: prepared,
					contentType: 'application/json; charset=utf-8'
				}
	}
	const mutationPath = join(root, 'mutation-start-v1.json')
	const mutationSignaturePath = join(root, 'mutation-start-v1.json.sig')
	const mutationExists = existsSync(mutationPath)
	const mutationSignatureExists = existsSync(mutationSignaturePath)
	if (mutationExists !== mutationSignatureExists) {
		throw new Error('Runtime rebind mutation-start pair is incomplete')
	}
	let mutation: Buffer | null = null
	let mutationSignature: Buffer | null = null
	let mutationValue: RuntimeRebindMutationStart | null = null
	if (mutationExists) {
		mutation = readRegularFile(mutationPath, MAX_RELEASE_BYTES)
		mutationSignature = readRegularFile(mutationSignaturePath, 1024)
		mutationValue = validateRuntimeRebindMutationStartBody(
			mutation,
			clientRevision,
			generation,
			preparedValue,
			prepared,
			preparedSignature
		)
		if (!SIGNATURE_PATTERN.test(mutationSignature.toString('ascii'))) {
			throw new Error(
				'Runtime rebind mutation-start signature is not canonical'
			)
		}
	}
	if (artifactMatch[1] === 'mutation-start-v1') {
		if (!mutation || !mutationSignature) return null
		return isSignature
			? {
					body: mutationSignature,
					contentType: 'application/octet-stream'
				}
			: {
					body: mutation,
					contentType: 'application/json; charset=utf-8'
				}
	}
	const adopted = readRegularFile(
		join(root, 'adopted-v1.json'),
		MAX_RELEASE_BYTES
	)
	const adoptedSignature = readRegularFile(
		join(root, 'adopted-v1.json.sig'),
		1024
	)
	const adoptedValue = validateRuntimeRebindAdoptedBody(
		adopted,
		clientRevision,
		generation
	)
	if (
		!SIGNATURE_PATTERN.test(adoptedSignature.toString('ascii')) ||
		adoptedValue.frontendPreparedEvidenceSha256 !== sha256(prepared) ||
		adoptedValue.frontendPreparedEvidenceSignatureSha256 !==
			sha256(preparedSignature) ||
		adoptedValue.ownershipRevision !== preparedValue.ownershipRevision ||
		adoptedValue.currentBackendRuntimeRevision !==
			preparedValue.currentBackendRuntimeRevision ||
		adoptedValue.initialClientRevision !==
			preparedValue.initialClientRevision ||
		adoptedValue.identityDatabaseId !== preparedValue.identityDatabaseId ||
		adoptedValue.rebindMode !== preparedValue.rebindMode ||
		adoptedValue.clientImageId !== preparedValue.clientImageId ||
		adoptedValue.releaseEvidenceSha256 !==
			preparedValue.releaseEvidenceSha256 ||
		adoptedValue.releaseEvidenceSignatureSha256 !==
			preparedValue.releaseEvidenceSignatureSha256 ||
		adoptedValue.releaseTreeSha256 !== preparedValue.releaseTreeSha256 ||
		adoptedValue.releaseFullManifestSha256 !==
			preparedValue.releaseFullManifestSha256 ||
		adoptedValue.previousClientProcessStartedAt !==
			preparedValue.previousClientProcessStartedAt ||
		(preparedValue.rebindMode === 'planned-restart' &&
			(!mutationValue ||
				adoptedValue.backendReadyEvidenceSha256 !==
					mutationValue.backendReadyEvidenceSha256 ||
				adoptedValue.backendReadyEvidenceSignatureSha256 !==
					mutationValue.backendReadyEvidenceSignatureSha256 ||
				Date.parse(adoptedValue.clientProcessStartedAt) <=
					Date.parse(mutationValue.mutationStartedAt) ||
				Date.parse(adoptedValue.clientProcessStartedAt) >
					Date.parse(preparedValue.expiresAt))) ||
		(preparedValue.rebindMode === 'recovery-adoption' &&
			(mutationValue !== null ||
				adoptedValue.clientProcessStartedAt !==
					preparedValue.observedClientProcessStartedAt))
	) {
		throw new Error('Runtime rebind ADOPTED signature/binding is invalid')
	}
	if (artifactMatch[1] === 'adopted-v1') {
		return isSignature
			? {
					body: adoptedSignature,
					contentType: 'application/octet-stream'
				}
			: {
					body: adopted,
					contentType: 'application/json; charset=utf-8'
				}
	}
	const heartbeat = readRegularFile(
		join(root, 'heartbeat-000001-v1.json'),
		1024 * 1024
	)
	const heartbeatSignature = readRegularFile(
		join(root, 'heartbeat-000001-v1.json.sig'),
		1024
	)
	const heartbeatValue = validateSoakArtifactBody(
		heartbeat,
		clientRevision,
		1,
		Date.now(),
		adoptedValue.releaseEvidenceSha256,
		adoptedValue.clientProcessStartedAt,
		adoptedValue.backendReadyEvidenceSha256
	)
	if (
		!SIGNATURE_PATTERN.test(heartbeatSignature.toString('ascii')) ||
		adoptedValue.firstHeartbeatEvidenceSha256 !== sha256(heartbeat) ||
		adoptedValue.firstHeartbeatEvidenceSignatureSha256 !==
			sha256(heartbeatSignature) ||
		adoptedValue.firstHeartbeatWindowStartedAt !==
			heartbeatValue.windowStartedAt ||
		adoptedValue.firstHeartbeatWindowEndedAt !==
			heartbeatValue.windowEndedAt
	) {
		throw new Error('Runtime rebind first heartbeat binding is invalid')
	}
	return isSignature
		? {
				body: heartbeatSignature,
				contentType: 'application/octet-stream'
			}
		: {
				body: heartbeat,
				contentType: 'application/json; charset=utf-8'
			}
}

export const getSoakArtifact = (
	requestedRevision: string,
	requestedArtifact: string
) => {
	const clientRevision = getClientRevision()
	if (requestedRevision !== clientRevision) return null
	const match = requestedArtifact.match(SOAK_ARTIFACT_PATTERN)
	if (!match) return null
	const isSignature = Boolean(match[3])
	const bodyName = `${match[1]}.json`
	const soakRoot = join(RELEASE_ROOT, clientRevision, 'soak')
	const body = readRegularFile(join(soakRoot, bodyName), 1024 * 1024)
	const signature = readRegularFile(
		join(soakRoot, `${bodyName}.sig`),
		1024
	)
	const { manifest: releaseManifest } = readReleaseFiles()
	const value = validateSoakArtifactBody(
		body,
		clientRevision,
		match[2] === undefined ? undefined : Number(match[2]),
		Date.now(),
		sha256(releaseManifest),
		processStartedAt
	)
	const sequence = value.sequence as number
	const immutableBody = readRegularFile(
		join(
			soakRoot,
			`heartbeat-${String(sequence).padStart(6, '0')}-v1.json`
		),
		1024 * 1024
	)
	if (!body.equals(immutableBody)) {
		throw new Error(
			'Client log soak latest body is not its immutable heartbeat'
		)
	}
	if (sequence === 1) {
		if (value.previousEvidenceSha256 !== sha256(releaseManifest)) {
			throw new Error(
				'First client log soak heartbeat does not bind release'
			)
		}
	} else {
		const previousBody = readRegularFile(
			join(
				soakRoot,
				`heartbeat-${String(sequence - 1).padStart(6, '0')}-v1.json`
			),
			1024 * 1024
		)
		const previous = validateSoakArtifactBody(
			previousBody,
			clientRevision,
			sequence - 1,
			Date.now(),
			sha256(releaseManifest),
			processStartedAt
		)
		if (
			value.previousEvidenceSha256 !== sha256(previousBody) ||
			value.windowStartedAt !== previous.windowEndedAt ||
			value.logConfigurationSha256 !== previous.logConfigurationSha256
		) {
			throw new Error('Client log soak chain continuity is invalid')
		}
	}
	if (
		!SIGNATURE_PATTERN.test(signature.toString('ascii')) ||
		Buffer.from(
			signature.subarray(0, signature.length - 1).toString('ascii'),
			'base64'
		).length !== 64
	) {
		throw new Error('Client log soak artifact is not canonical')
	}
	return isSignature
		? { body: signature, contentType: 'application/octet-stream' }
		: { body, contentType: 'application/json; charset=utf-8' }
}

export const isValidSoakProbe = (
	requestedRevision: string,
	probeId: string
) => {
	return (
		requestedRevision === getClientRevision() &&
		PROBE_ID_PATTERN.test(probeId)
	)
}

export const claimSoakProbe = (
	requestedRevision: string,
	probeId: string,
	nowMs = Date.now()
) => {
	if (!isValidSoakProbe(requestedRevision, probeId)) return null
	const expiry = nowMs - MAX_SOAK_WINDOW_MS
	for (const [key, claimedAt] of Array.from(soakProbeClaims.entries())) {
		if (claimedAt >= expiry) break
		soakProbeClaims.delete(key)
	}
	const key = `${requestedRevision}:${probeId}`
	if (soakProbeClaims.has(key)) return 409
	soakProbeClaims.set(key, nowMs)
	while (soakProbeClaims.size > 4096) {
		const oldest = soakProbeClaims.keys().next().value
		if (oldest === undefined) break
		soakProbeClaims.delete(oldest)
	}
	return 204
}

export const getRuntimeEvidence = () => {
	const { clientRevision, manifest, signature } = readReleaseFiles()
	return Buffer.from(
		JSON.stringify({
			schemaVersion: RELEASE_SCHEMA_VERSION,
			kind: RUNTIME_KIND,
			clientRevision,
			processStartedAt,
			releaseEvidenceSha256: sha256(manifest),
			releaseEvidenceSignatureSha256: sha256(signature)
		})
	)
}

export const getEvidenceHeaders = (
	contentType: string,
	clientRevision = getClientRevision()
) => {
	return {
		'Cache-Control': 'no-store, max-age=0',
		'Content-Type': contentType,
		Pragma: 'no-cache',
		'X-Content-Type-Options': 'nosniff',
		'X-Winwidget-Revision': clientRevision
	}
}

export const getRuntimeRebindArtifactResponse = (
	requestedRevision: string,
	requestedGeneration: string,
	requestedArtifact: string,
	options: { releaseRoot?: string; liveClientRevision?: string } = {}
) => {
	try {
		const artifact = getRuntimeRebindArtifact(
			requestedRevision,
			requestedGeneration,
			requestedArtifact,
			options
		)
		if (!artifact) {
			return new Response(null, {
				status: 404,
				headers: getEvidenceHeaders(
					'text/plain; charset=utf-8',
					options.liveClientRevision
				)
			})
		}
		return new Response(new Uint8Array(artifact.body), {
			status: 200,
			headers: getEvidenceHeaders(
				artifact.contentType,
				options.liveClientRevision
			)
		})
	} catch {
		return new Response(null, {
			status: 503,
			headers: {
				'Cache-Control': 'no-store, max-age=0',
				Pragma: 'no-cache',
				'X-Content-Type-Options': 'nosniff'
			}
		})
	}
}
