#!/usr/bin/env node

import {
	constants as fsConstants,
	closeSync,
	fsyncSync,
	linkSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs'
import { createHash, sign, verify } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { TextDecoder } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
	BACKEND_SIGNING_PUBLIC_KEY,
	CLIENT_SWITCH_RECEIPT_PATH,
	CLIENT_RELEASE_EVIDENCE_ROOT,
	FRONTEND_SIGNING_PRIVATE_KEY,
	FRONTEND_SIGNING_PUBLIC_KEY,
	fetchStableBackendCleanupComplete,
	readBoundedRegularFile,
	readEd25519PrivateKey,
	readEd25519PublicKey,
	readSignature,
	validateBackendDeploymentHealthRaw,
	validateClientSwitchReceiptRaw,
	validateRuntimeEvidenceRaw,
	verifyAndPromoteClientSwitchReceiptForOwner,
	verifyReleaseEvidenceSignature
} from './identity-avatar-client-release-evidence.mjs'
import { validateSoakEvidenceRaw } from './identity-avatar-client-log-soak.mjs'

export const RETARGET_KIND = 'identity-avatar-client-soak-retarget-applied'
export const RETARGET_INTENT_KIND =
	'identity-avatar-client-soak-retarget-intent'
export const RETARGET_STATE_KIND =
	'identity-avatar-client-soak-retarget-state'
export const RETARGET_ROOT =
	'/opt/winwidget/deploy/frontend/identity-avatar-client-retarget'
export const RETARGET_STATE_PATH =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-soak-retarget-v1.json'
export const BACKEND_HEALTH_URL =
	'https://api.winwidget.ru/api/v1/health/deployment'
export const BACKEND_RETARGET_ACK_URL =
	'https://api.winwidget.ru/.well-known/winwidget/identity-avatar-media/client-retarget-ack-v1.json'
export const RETARGET_ACK_KIND = 'identity-avatar-client-soak-retarget-ack'

export const RETARGET_INTENT_KEYS = [
	'version',
	'kind',
	'initialClientRevision',
	'fromClientRevision',
	'toClientRevision',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'identityDatabaseId',
	'clientSwitchReceiptSha256',
	'previousRetargetEvidenceSha256',
	'previousBackendAckEvidenceSha256',
	'previousBackendAckEvidenceSignatureSha256',
	'candidateTreeSha256',
	'candidateTreeEntryCount',
	'candidateTreeTotalBytes',
	'candidateTreeLargestBlobBytes',
	'clientLifecycleContractSha256',
	'retargetSequence',
	'soakResetRequired',
	'preparedAt',
	'signature'
]

export const RETARGET_STATE_KEYS = [
	'version',
	'kind',
	'state',
	'initialClientRevision',
	'currentClientRevision',
	'candidateClientRevision',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'identityDatabaseId',
	'clientSwitchReceiptSha256',
	'retargetSequence',
	'previousRetargetEvidenceSha256',
	'stagedRetargetIntentSha256',
	'appliedRetargetEvidenceSha256',
	'updatedAt',
	'signature'
]

export const RETARGET_OUTCOME_KEYS = [
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
]

export const RETARGET_ACK_KEYS = [
	'schemaVersion',
	'kind',
	'ownershipRevision',
	'currentBackendRuntimeRevision',
	'initialClientRevision',
	'previousClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'clientSwitchEvidenceSha256',
	'clientRetargetEvidenceSha256',
	'frontendRetargetEvidenceSha256',
	'frontendRetargetEvidenceSignatureSha256',
	'retargetSequence',
	'soakResetAt',
	'acknowledgedAt'
]

const RETARGET_INTENT_PAYLOAD_KEYS = RETARGET_INTENT_KEYS.slice(0, -1)
const RETARGET_STATE_PAYLOAD_KEYS = RETARGET_STATE_KEYS.slice(0, -1)
const REVISION_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000
const MAX_RETARGETS = 4
const MAX_TREE_ENTRIES = 20_000
const MAX_TREE_BYTES = 512 * 1024 * 1024
const MAX_TREE_BLOB_BYTES = 32 * 1024 * 1024
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

export const CLIENT_RETARGET_CRITICAL_FILES = [
	'.github/workflows/deploy-production.yml',
	'Dockerfile',
	'deploy/docker-compose.prod.yml',
	'deploy/identity-avatar-client-log-soak.logrotate',
	'deploy/identity-avatar-client-log-soak.nginx.conf',
	'next.config.mjs',
	'package.json',
	'scripts/deploy-production.sh',
	'scripts/frontend-production-deploy-lock.sh',
	'scripts/identity-avatar-client-log-soak.mjs',
	'scripts/identity-avatar-client-release-evidence.mjs',
	'scripts/identity-avatar-client-runtime-rebind.mjs',
	'scripts/identity-avatar-client-soak-retarget.mjs',
	'scripts/test-identity-avatar-client-log-soak.mjs',
	'scripts/test-identity-avatar-client-release-evidence.mjs',
	'scripts/test-identity-avatar-client-runtime-rebind.mjs',
	'scripts/test-identity-avatar-client-soak-retarget.mjs',
	'src/app/.well-known/winwidget/identity-avatar-client/[clientRevision]/[artifact]/route.ts',
	'src/app/.well-known/winwidget/identity-avatar-client/[clientRevision]/runtime-rebind/[generation]/[artifact]/route.ts',
	'src/app/.well-known/winwidget/identity-avatar-client/[clientRevision]/soak/[artifact]/route.ts',
	'src/app/.well-known/winwidget/identity-avatar-client/runtime-v1.json/route.ts',
	'src/app/.well-known/winwidget/identity-avatar-client/soak-probe/[clientRevision]/[probeId]/route.ts',
	'src/entities/user/api/user.api.ts',
	'src/features/upload-file/index.ts',
	'src/features/upload-file/model/useUploadFile.ts',
	'src/features/upload-file/ui/FieldUploadFile.tsx',
	'src/screens/admin/model/user/useUserEdit.ts',
	'src/screens/admin/ui/user/edit/UserEdit.tsx',
	'src/screens/cabinet/ui/CabinetProfile.tsx',
	'src/shared/server/identity-avatar-client-evidence.ts'
]

const REQUIRED_ABSENT = ['src/features/upload-file/api/file.api.ts']

const CONTRACT_CHECKS = [
	'avatar-api-callers-frozen',
	'backend-activation-receipt-guard-frozen',
	'client-retarget-guard-frozen',
	'first-heartbeat-freshness-gate-frozen',
	'full-build-release-evidence-frozen',
	'legacy-api-v1-files-absent',
	'legacy-uploads-rewrite-absent',
	'log-soak-nginx-logrotate-frozen',
	'public-compact-evidence-frozen',
	'signed-image-adoption-proof-frozen',
	'signed-log-soak-chain-frozen',
	'unified-runtime-stability-rebind-frozen'
]

const fail = message => {
	throw new Error(message)
}

const sha256 = value => createHash('sha256').update(value).digest('hex')

const canonicalTimestamp = value =>
	typeof value === 'string' &&
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
	Number.isFinite(Date.parse(value)) &&
	new Date(Date.parse(value)).toISOString() === value

const canonicalSecondTimestamp = value =>
	typeof value === 'string' &&
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) &&
	Number.isFinite(Date.parse(value)) &&
	new Date(Date.parse(value)).toISOString().replace('.000Z', 'Z') === value

const exactKeys = (value, keys) =>
	value &&
	typeof value === 'object' &&
	!Array.isArray(value) &&
	JSON.stringify(Object.keys(value)) === JSON.stringify(keys)

const canonicalJson = (raw, maxBytes, label) => {
	if (!Buffer.isBuffer(raw) || raw.length < 2 || raw.length > maxBytes) {
		fail(`${label} size is outside the frozen bound`)
	}
	let text
	let value
	try {
		text = utf8Decoder.decode(raw)
		value = JSON.parse(text)
	} catch {
		fail(`${label} is not canonical UTF-8 JSON`)
	}
	if (text !== JSON.stringify(value)) {
		fail(`${label} is not compact canonical JSON`)
	}
	return value
}

const pathExists = path => {
	try {
		lstatSync(path)
		return true
	} catch (error) {
		if (error?.code === 'ENOENT') return false
		throw error
	}
}

const assertOwnedFile = (
	path,
	label,
	{
		mode = 0o600,
		maxBytes = 64 * 1024,
		uid = 0,
		gid = 0,
		allowedLinks = [1]
	} = {}
) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		!allowedLinks.includes(metadata.nlink) ||
		metadata.uid !== uid ||
		metadata.gid !== gid ||
		(metadata.mode & 0o777) !== mode ||
		metadata.size < 1 ||
		metadata.size > maxBytes
	) {
		fail(`${label} must be an owned single-link regular file`)
	}
	return readFileSync(path)
}

const fsyncDirectory = path => {
	const descriptor = openSync(path, fsConstants.O_RDONLY)
	try {
		fsyncSync(descriptor)
	} finally {
		closeSync(descriptor)
	}
}

const assertOwnedDirectory = (path, label, { uid = 0, gid = 0 } = {}) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isDirectory() ||
		metadata.isSymbolicLink() ||
		metadata.nlink < 2 ||
		metadata.uid !== uid ||
		metadata.gid !== gid ||
		(metadata.mode & 0o022) !== 0 ||
		realpathSync(path) !== resolve(path)
	) {
		fail(`${label} must be an owned real directory`)
	}
}

const atomicOwnedWrite = (
	path,
	raw,
	mode = 0o600,
	owner = { uid: 0, gid: 0 }
) => {
	const parent = dirname(path)
	mkdirSync(parent, { recursive: true, mode: 0o700 })
	assertOwnedDirectory(parent, 'Retarget artifact directory', owner)
	if (pathExists(path)) {
		assertOwnedFile(path, 'Existing retarget artifact', {
			...owner,
			mode,
			maxBytes: 1024 * 1024
		})
	}
	const temporary = `${path}.tmp-${process.pid}`
	if (pathExists(temporary)) fail('Retarget temporary file already exists')
	let descriptor
	try {
		descriptor = openSync(
			temporary,
			fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
			mode
		)
		writeFileSync(descriptor, raw)
		fsyncSync(descriptor)
		closeSync(descriptor)
		descriptor = undefined
		assertOwnedFile(temporary, 'Retarget temporary artifact', {
			...owner,
			mode,
			maxBytes: 1024 * 1024
		})
		renameSync(temporary, path)
		fsyncDirectory(parent)
	} finally {
		if (descriptor !== undefined) closeSync(descriptor)
		if (pathExists(temporary)) rmSync(temporary)
	}
}

const durableNoClobber = (
	path,
	raw,
	mode = 0o600,
	owner = { uid: 0, gid: 0 }
) => {
	const parent = dirname(path)
	mkdirSync(parent, { recursive: true, mode: 0o700 })
	assertOwnedDirectory(parent, 'Retarget immutable directory', owner)
	const pending = `${path}.pending`
	if (pathExists(path) && !pathExists(pending)) {
		if (
			!assertOwnedFile(path, 'Retarget immutable evidence', {
				...owner,
				mode
			}).equals(raw)
		) {
			fail(
				'Retarget immutable evidence already exists with different bytes'
			)
		}
		return
	}
	if (!pathExists(pending)) atomicOwnedWrite(pending, raw, mode, owner)
	if (
		!assertOwnedFile(pending, 'Retarget pending evidence', {
			...owner,
			mode,
			allowedLinks: [1, 2]
		}).equals(raw)
	) {
		fail('Retarget pending evidence differs from the frozen bytes')
	}
	if (!pathExists(path)) {
		linkSync(pending, path)
		fsyncDirectory(parent)
	}
	const current = lstatSync(path)
	const pendingMetadata = lstatSync(pending)
	if (
		!current.isFile() ||
		current.isSymbolicLink() ||
		current.nlink !== 2 ||
		current.dev !== pendingMetadata.dev ||
		current.ino !== pendingMetadata.ino ||
		!readFileSync(path).equals(raw)
	) {
		fail('Retarget immutable publication is not the prepared hardlink')
	}
	rmSync(pending)
	fsyncDirectory(parent)
	assertOwnedFile(path, 'Retarget immutable evidence', { ...owner, mode })
}

const signInline = (payload, privateKeyPath) => {
	const signature = sign(
		null,
		Buffer.from(JSON.stringify(payload)),
		readEd25519PrivateKey(privateKeyPath)
	).toString('base64')
	if (readSignature(Buffer.from(`${signature}\n`)).length !== 64) {
		fail('Retarget inline signature is invalid')
	}
	return signature
}

const verifyInline = (value, payloadKeys, publicKeyPath, label) => {
	const { signature, ...payload } = value
	if (
		!exactKeys(payload, payloadKeys) ||
		typeof signature !== 'string' ||
		!verify(
			null,
			Buffer.from(JSON.stringify(payload)),
			readEd25519PublicKey(publicKeyPath),
			readSignature(Buffer.from(`${signature}\n`))
		)
	) {
		fail(`${label} inline signature is invalid`)
	}
	return payload
}

export const retargetPaths = (
	toClientRevision,
	root = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT
) => {
	if (!REVISION_PATTERN.test(toClientRevision)) {
		fail('Retarget revision is invalid')
	}
	return {
		intent: join(root, `staged-${toClientRevision}.json`),
		outcome: join(releaseRoot, toClientRevision, 'soak-retarget-v1.json'),
		outcomeSignature: join(
			releaseRoot,
			toClientRevision,
			'soak-retarget-v1.json.sig'
		)
	}
}

export const validateRetargetIntentRaw = (
	raw,
	{
		frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
		nowMs = Date.now()
	} = {}
) => {
	const value = canonicalJson(raw, 64 * 1024, 'Client retarget intent')
	if (
		!exactKeys(value, RETARGET_INTENT_KEYS) ||
		value.version !== 1 ||
		value.kind !== RETARGET_INTENT_KIND ||
		![
			value.initialClientRevision,
			value.fromClientRevision,
			value.toClientRevision,
			value.ownershipRevision,
			value.currentBackendRuntimeRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		value.fromClientRevision === value.toClientRevision ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		![
			value.clientSwitchReceiptSha256,
			value.previousRetargetEvidenceSha256,
			value.candidateTreeSha256,
			value.clientLifecycleContractSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		(value.retargetSequence === 1 &&
			(value.previousBackendAckEvidenceSha256 !== null ||
				value.previousBackendAckEvidenceSignatureSha256 !== null)) ||
		(value.retargetSequence > 1 &&
			(!SHA256_PATTERN.test(value.previousBackendAckEvidenceSha256) ||
				!SHA256_PATTERN.test(
					value.previousBackendAckEvidenceSignatureSha256
				))) ||
		!Number.isSafeInteger(value.candidateTreeEntryCount) ||
		value.candidateTreeEntryCount < 1 ||
		value.candidateTreeEntryCount > MAX_TREE_ENTRIES ||
		!Number.isSafeInteger(value.candidateTreeTotalBytes) ||
		value.candidateTreeTotalBytes < 1 ||
		value.candidateTreeTotalBytes > MAX_TREE_BYTES ||
		!Number.isSafeInteger(value.candidateTreeLargestBlobBytes) ||
		value.candidateTreeLargestBlobBytes < 0 ||
		value.candidateTreeLargestBlobBytes > MAX_TREE_BLOB_BYTES ||
		!Number.isSafeInteger(value.retargetSequence) ||
		value.retargetSequence < 1 ||
		value.retargetSequence > MAX_RETARGETS ||
		value.soakResetRequired !== true ||
		!canonicalTimestamp(value.preparedAt) ||
		Date.parse(value.preparedAt) > nowMs + MAX_FUTURE_SKEW_MS
	) {
		fail('Client retarget intent contract is invalid')
	}
	verifyInline(
		value,
		RETARGET_INTENT_PAYLOAD_KEYS,
		frontendPublicKeyPath,
		'Client retarget intent'
	)
	return value
}

export const validateRetargetStateRaw = (
	raw,
	{
		frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
		nowMs = Date.now()
	} = {}
) => {
	const value = canonicalJson(raw, 64 * 1024, 'Client retarget state')
	if (
		!exactKeys(value, RETARGET_STATE_KEYS) ||
		value.version !== 1 ||
		value.kind !== RETARGET_STATE_KIND ||
		!['staged', 'applied'].includes(value.state) ||
		![
			value.initialClientRevision,
			value.currentClientRevision,
			value.ownershipRevision,
			value.currentBackendRuntimeRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		![
			value.clientSwitchReceiptSha256,
			value.previousRetargetEvidenceSha256,
			value.stagedRetargetIntentSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!Number.isSafeInteger(value.retargetSequence) ||
		value.retargetSequence < 1 ||
		value.retargetSequence > MAX_RETARGETS ||
		!canonicalTimestamp(value.updatedAt) ||
		Date.parse(value.updatedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		(value.state === 'staged' &&
			(!REVISION_PATTERN.test(value.candidateClientRevision) ||
				value.candidateClientRevision === value.currentClientRevision ||
				value.appliedRetargetEvidenceSha256 !== null)) ||
		(value.state === 'applied' &&
			(value.candidateClientRevision !== null ||
				!SHA256_PATTERN.test(value.appliedRetargetEvidenceSha256)))
	) {
		fail('Client retarget state contract is invalid')
	}
	verifyInline(
		value,
		RETARGET_STATE_PAYLOAD_KEYS,
		frontendPublicKeyPath,
		'Client retarget state'
	)
	return value
}

export const validateRetargetOutcomeRaw = (
	raw,
	{ expectedClientRevision, expectedBodySha256, nowMs = Date.now() } = {}
) => {
	const value = canonicalJson(raw, 64 * 1024, 'Client retarget outcome')
	if (
		!exactKeys(value, RETARGET_OUTCOME_KEYS) ||
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
		(expectedClientRevision !== undefined &&
			value.toClientRevision !== expectedClientRevision) ||
		(expectedBodySha256 !== undefined &&
			sha256(raw) !== expectedBodySha256) ||
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
		!canonicalTimestamp(value.clientProcessStartedAt) ||
		!canonicalTimestamp(value.verifiedAt) ||
		Date.parse(value.clientProcessStartedAt) >
			Date.parse(value.verifiedAt) ||
		Date.parse(value.verifiedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		value.legacyReferencesAbsent !== true ||
		value.fullBuildManifestPassed !== true ||
		value.soakResetRequired !== true
	) {
		fail('Client retarget outcome contract is invalid')
	}
	return value
}

export const verifyRetargetOutcome = (
	body,
	signatureRaw,
	publicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRetargetOutcomeRaw(body, options)
	if (
		!verify(
			null,
			body,
			readEd25519PublicKey(publicKeyPath),
			readSignature(signatureRaw)
		)
	) {
		fail('Client retarget detached signature is invalid')
	}
	return value
}

export const validateRetargetAckRaw = (
	raw,
	{ expectedBodySha256, nowMs = Date.now() } = {}
) => {
	const value = canonicalJson(
		raw,
		64 * 1024,
		'Backend client retarget ACK'
	)
	if (
		!exactKeys(value, RETARGET_ACK_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== RETARGET_ACK_KIND ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.previousClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		value.previousClientRevision === value.currentClientRevision ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		![
			value.clientSwitchEvidenceSha256,
			value.clientRetargetEvidenceSha256,
			value.frontendRetargetEvidenceSha256,
			value.frontendRetargetEvidenceSignatureSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!Number.isSafeInteger(value.retargetSequence) ||
		value.retargetSequence < 1 ||
		value.retargetSequence > MAX_RETARGETS ||
		!canonicalSecondTimestamp(value.soakResetAt) ||
		!canonicalSecondTimestamp(value.acknowledgedAt) ||
		Date.parse(value.soakResetAt) > Date.parse(value.acknowledgedAt) ||
		Date.parse(value.acknowledgedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		(expectedBodySha256 !== undefined &&
			(!SHA256_PATTERN.test(expectedBodySha256) ||
				sha256(raw) !== expectedBodySha256))
	) {
		fail('Backend client retarget ACK contract is invalid')
	}
	return value
}

export const verifyRetargetAck = (
	body,
	signatureRaw,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRetargetAckRaw(body, options)
	if (
		!verify(
			null,
			body,
			readEd25519PublicKey(backendPublicKeyPath),
			readSignature(signatureRaw)
		)
	) {
		fail('Backend client retarget ACK signature is invalid')
	}
	return value
}

const readBoundedAckResponse = async (response, label, maxBytes) => {
	const declaredLength = response.headers.get('content-length')
	if (
		declaredLength !== null &&
		(!/^(0|[1-9][0-9]*)$/.test(declaredLength) ||
			Number(declaredLength) > maxBytes)
	) {
		fail(`${label} declared size is outside the frozen bound`)
	}
	const raw = Buffer.from(await response.arrayBuffer())
	if (raw.length < 1 || raw.length > maxBytes) {
		fail(`${label} size is outside the frozen bound`)
	}
	return raw
}

const fetchRetargetAckArtifact = async ({
	fetchImpl,
	url,
	expectedContentType,
	expectedOwnershipRevision,
	label,
	maxBytes
}) => {
	const response = await fetchImpl(url, {
		method: 'GET',
		redirect: 'manual',
		signal: AbortSignal.timeout(30_000),
		headers: { accept: expectedContentType }
	})
	const cacheTokens = (response.headers.get('cache-control') ?? '')
		.split(',')
		.map(item => item.trim().toLowerCase())
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
		(expectedOwnershipRevision === undefined
			? !REVISION_PATTERN.test(responseRevision)
			: responseRevision !== expectedOwnershipRevision)
	) {
		fail(`${label} headers do not match the frozen contract`)
	}
	return {
		raw: await readBoundedAckResponse(response, label, maxBytes),
		responseRevision
	}
}

export const fetchStableRetargetAck = async ({
	fetchImpl = globalThis.fetch,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	url = BACKEND_RETARGET_ACK_URL,
	nowMs = Date.now()
} = {}) => {
	if (
		typeof fetchImpl !== 'function' ||
		typeof url !== 'string' ||
		!url.startsWith('https://') ||
		!Number.isFinite(nowMs)
	) {
		fail('Backend client retarget ACK fetch inputs are invalid')
	}
	let lastError
	for (let attempt = 1; attempt <= 4; attempt += 1) {
		try {
			const first = await fetchRetargetAckArtifact({
				fetchImpl,
				url,
				expectedContentType: 'application/json',
				expectedOwnershipRevision: undefined,
				label: 'Backend client retarget ACK',
				maxBytes: 64 * 1024
			})
			const ack = validateRetargetAckRaw(first.raw, { nowMs })
			if (first.responseRevision !== ack.ownershipRevision) {
				fail('Backend client retarget ACK revision header is invalid')
			}
			const signature = await fetchRetargetAckArtifact({
				fetchImpl,
				url: `${url}.sig`,
				expectedContentType: 'application/octet-stream',
				expectedOwnershipRevision: ack.ownershipRevision,
				label: 'Backend client retarget ACK signature',
				maxBytes: 1024
			})
			const second = await fetchRetargetAckArtifact({
				fetchImpl,
				url,
				expectedContentType: 'application/json',
				expectedOwnershipRevision: ack.ownershipRevision,
				label: 'Backend client retarget ACK confirmation',
				maxBytes: 64 * 1024
			})
			if (!first.raw.equals(second.raw)) {
				fail('Backend client retarget ACK changed during stable fetch')
			}
			verifyRetargetAck(first.raw, signature.raw, backendPublicKeyPath, {
				nowMs
			})
			return {
				value: ack,
				body: first.raw,
				signatureRaw: signature.raw
			}
		} catch (error) {
			lastError = error
		}
	}
	fail(
		`Stable backend client retarget ACK is unavailable: ${
			lastError instanceof Error ? lastError.message : String(lastError)
		}`
	)
}

const git = (
	repositoryRoot,
	args,
	{ maxBuffer = 64 * 1024 * 1024 } = {}
) => {
	const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
		encoding: null,
		maxBuffer
	})
	if (result.status !== 0) fail(`Git command failed: ${args[0]}`)
	return result.stdout
}

const gitText = (repositoryRoot, args) =>
	utf8Decoder.decode(git(repositoryRoot, args)).trim()

const readGitBlob = (repositoryRoot, revision, path) =>
	git(repositoryRoot, ['show', `${revision}:${path}`], {
		maxBuffer: MAX_TREE_BLOB_BYTES + 1024
	})

const parseTree = raw => {
	const records = utf8Decoder
		.decode(raw.subarray(0, raw.length - 1))
		.split('\0')
	if (
		raw.at(-1) !== 0 ||
		records.length < 1 ||
		records.length > MAX_TREE_ENTRIES
	) {
		fail('Candidate Git tree is outside the frozen bound')
	}
	let totalBytes = 0
	let largestBlobBytes = 0
	const entries = records.map(record => {
		const match =
			/^(100644|100755|120000) blob ([0-9a-f]{40,64}) +([0-9]+)\t(.+)$/.exec(
				record
			)
		if (!match) fail('Candidate Git tree contains an unsupported entry')
		const size = Number(match[3])
		if (!Number.isSafeInteger(size) || size < 0)
			fail('Candidate Git blob size is invalid')
		totalBytes += size
		largestBlobBytes = Math.max(largestBlobBytes, size)
		return { path: match[4], mode: match[1], size, objectId: match[2] }
	})
	if (
		totalBytes < 1 ||
		totalBytes > MAX_TREE_BYTES ||
		largestBlobBytes > MAX_TREE_BLOB_BYTES
	) {
		fail('Candidate Git tree byte bounds are invalid')
	}
	for (let index = 1; index < entries.length; index += 1) {
		if (
			Buffer.compare(
				Buffer.from(entries[index - 1].path),
				Buffer.from(entries[index].path)
			) >= 0
		) {
			fail('Candidate Git tree is not bytewise sorted')
		}
	}
	return { entries, totalBytes, largestBlobBytes }
}

export const clientLifecycleSummary = (repositoryRoot, revision) => {
	if (!REVISION_PATTERN.test(revision))
		fail('Lifecycle summary revision is invalid')
	const root = resolve(repositoryRoot)
	const treeRaw = git(root, [
		'ls-tree',
		'-r',
		'-l',
		'-z',
		'--full-tree',
		revision
	])
	const tree = parseTree(treeRaw)
	const byPath = new Map(tree.entries.map(item => [item.path, item]))
	if (
		CLIENT_RETARGET_CRITICAL_FILES.some(path => !byPath.has(path)) ||
		REQUIRED_ABSENT.some(path => byPath.has(path))
	) {
		fail(
			'Candidate client lifecycle files do not match the frozen boundary'
		)
	}
	const files = CLIENT_RETARGET_CRITICAL_FILES.map(path => {
		const entry = byPath.get(path)
		if (!['100644', '100755'].includes(entry.mode)) {
			fail('Critical client lifecycle file is not a regular Git blob')
		}
		const body = readGitBlob(root, revision, path)
		if (body.length !== entry.size)
			fail('Critical client lifecycle blob size drifted')
		return {
			path,
			mode: entry.mode,
			size: entry.size,
			sha256: sha256(body)
		}
	})
	const contract = {
		version: 1,
		files,
		absent: REQUIRED_ABSENT,
		checks: CONTRACT_CHECKS
	}
	return {
		candidateTreeSha256: sha256(JSON.stringify(tree.entries)),
		candidateTreeEntryCount: tree.entries.length,
		candidateTreeTotalBytes: tree.totalBytes,
		candidateTreeLargestBlobBytes: tree.largestBlobBytes,
		clientLifecycleContractSha256: sha256(JSON.stringify(contract))
	}
}

const assertCandidateContract = ({ repositoryRoot, intent }) => {
	if (!repositoryRoot)
		fail('Client retarget guard requires the repository root')
	const root = resolve(repositoryRoot)
	const ancestor = spawnSync(
		'git',
		[
			'-C',
			root,
			'merge-base',
			'--is-ancestor',
			intent.fromClientRevision,
			intent.toClientRevision
		],
		{ stdio: 'ignore' }
	)
	if (ancestor.status !== 0) {
		fail('Client retarget candidate is not a strict descendant')
	}
	const currentSummary = clientLifecycleSummary(
		root,
		intent.fromClientRevision
	)
	const candidateSummary = clientLifecycleSummary(
		root,
		intent.toClientRevision
	)
	for (const key of [
		'candidateTreeSha256',
		'candidateTreeEntryCount',
		'candidateTreeTotalBytes',
		'candidateTreeLargestBlobBytes',
		'clientLifecycleContractSha256'
	]) {
		if (candidateSummary[key] !== intent[key]) {
			fail(`Client retarget candidate ${key} drifted after staging`)
		}
	}
	if (
		currentSummary.clientLifecycleContractSha256 !==
		candidateSummary.clientLifecycleContractSha256
	) {
		fail('Client retarget changes the frozen avatar lifecycle contract')
	}
}

const assertStateReceiptBinding = ({ state, receipt, receiptRaw }) => {
	if (
		state.initialClientRevision !== receipt.initialClientRevision ||
		state.ownershipRevision !== receipt.backendServerRevision ||
		state.identityDatabaseId !== receipt.identityDatabaseId ||
		state.clientSwitchReceiptSha256 !== sha256(receiptRaw)
	) {
		fail('Client retarget state differs from the initial receipt')
	}
	if (
		(state.retargetSequence === 1 &&
			state.previousRetargetEvidenceSha256 !== sha256(receiptRaw)) ||
		(state.retargetSequence > 1 &&
			state.previousRetargetEvidenceSha256 === sha256(receiptRaw))
	) {
		fail('Client retarget state has an invalid chain root')
	}
}

const readVerifiedIntentForState = ({
	state,
	retargetRoot,
	releaseRoot,
	frontendPublicKeyPath,
	nowMs,
	owner,
	repositoryRoot
}) => {
	const revision =
		state.state === 'staged'
			? state.candidateClientRevision
			: state.currentClientRevision
	const intentRaw = assertOwnedFile(
		retargetPaths(revision, retargetRoot, releaseRoot).intent,
		'Client retarget intent',
		owner
	)
	const intent = validateRetargetIntentRaw(intentRaw, {
		frontendPublicKeyPath,
		nowMs
	})
	if (
		sha256(intentRaw) !== state.stagedRetargetIntentSha256 ||
		intent.initialClientRevision !== state.initialClientRevision ||
		(state.state === 'staged' &&
			intent.fromClientRevision !== state.currentClientRevision) ||
		intent.toClientRevision !== revision ||
		intent.ownershipRevision !== state.ownershipRevision ||
		intent.currentBackendRuntimeRevision !==
			state.currentBackendRuntimeRevision ||
		intent.identityDatabaseId !== state.identityDatabaseId ||
		intent.clientSwitchReceiptSha256 !== state.clientSwitchReceiptSha256 ||
		intent.previousRetargetEvidenceSha256 !==
			state.previousRetargetEvidenceSha256 ||
		intent.retargetSequence !== state.retargetSequence ||
		intent.soakResetRequired !== true ||
		Date.parse(intent.preparedAt) > Date.parse(state.updatedAt)
	) {
		fail('Client retarget intent does not match the durable state')
	}
	assertCandidateContract({ repositoryRoot, intent })
	return { intent, intentRaw }
}

const readVerifiedPreviousOutcome = ({
	state,
	previousClientRevision = state.currentClientRevision,
	retargetRoot,
	releaseRoot,
	frontendPublicKeyPath,
	nowMs,
	owner
}) => {
	if (state.retargetSequence === 1) return null
	const paths = retargetPaths(
		previousClientRevision,
		retargetRoot,
		releaseRoot
	)
	const body = assertOwnedFile(
		paths.outcome,
		'Previous client retarget outcome',
		{
			...owner,
			mode: 0o644
		}
	)
	const signatureRaw = assertOwnedFile(
		paths.outcomeSignature,
		'Previous client retarget outcome signature',
		{ ...owner, mode: 0o644, maxBytes: 1024 }
	)
	const value = verifyRetargetOutcome(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		{
			expectedClientRevision: previousClientRevision,
			expectedBodySha256: state.previousRetargetEvidenceSha256,
			nowMs
		}
	)
	if (
		value.initialClientRevision !== state.initialClientRevision ||
		value.ownershipRevision !== state.ownershipRevision ||
		value.identityDatabaseId !== state.identityDatabaseId ||
		value.clientSwitchReceiptSha256 !== state.clientSwitchReceiptSha256
	) {
		fail('Previous client retarget outcome is outside the signed chain')
	}
	return value
}

const readVerifiedAppliedOutcome = ({
	state,
	intent,
	intentRaw,
	receipt,
	receiptRaw,
	retargetRoot,
	releaseRoot,
	frontendPublicKeyPath,
	nowMs,
	owner
}) => {
	const paths = retargetPaths(
		state.currentClientRevision,
		retargetRoot,
		releaseRoot
	)
	const body = assertOwnedFile(
		paths.outcome,
		'Applied client retarget outcome',
		{
			...owner,
			mode: 0o644
		}
	)
	const signatureRaw = assertOwnedFile(
		paths.outcomeSignature,
		'Applied client retarget outcome signature',
		{ ...owner, mode: 0o644, maxBytes: 1024 }
	)
	const value = verifyRetargetOutcome(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		{
			expectedClientRevision: state.currentClientRevision,
			expectedBodySha256: state.appliedRetargetEvidenceSha256,
			nowMs
		}
	)
	if (
		value.initialClientRevision !== receipt.initialClientRevision ||
		value.fromClientRevision !== intent.fromClientRevision ||
		value.ownershipRevision !== state.ownershipRevision ||
		value.currentBackendRuntimeRevision !==
			state.currentBackendRuntimeRevision ||
		value.identityDatabaseId !== state.identityDatabaseId ||
		value.clientSwitchReceiptSha256 !== sha256(receiptRaw) ||
		value.retargetIntentSha256 !== sha256(intentRaw) ||
		value.previousRetargetEvidenceSha256 !==
			state.previousRetargetEvidenceSha256 ||
		value.verifiedAt !== state.updatedAt
	) {
		fail('Applied client retarget outcome differs from the durable state')
	}
	if (state.retargetSequence > 1) {
		readVerifiedPreviousOutcome({
			state,
			previousClientRevision: value.fromClientRevision,
			retargetRoot,
			releaseRoot,
			frontendPublicKeyPath,
			nowMs,
			owner
		})
	}
	return { value, body, signatureRaw }
}

const assertRetargetAckBinding = ({
	ack,
	ackBody,
	ackSignatureRaw,
	state,
	receipt,
	previousOutcome
}) => {
	if (
		ack.ownershipRevision !== state.ownershipRevision ||
		ack.currentBackendRuntimeRevision !==
			previousOutcome.value.currentBackendRuntimeRevision ||
		ack.initialClientRevision !== receipt.initialClientRevision ||
		ack.previousClientRevision !==
			previousOutcome.value.fromClientRevision ||
		ack.currentClientRevision !== state.currentClientRevision ||
		ack.identityDatabaseId !== state.identityDatabaseId ||
		ack.frontendRetargetEvidenceSha256 !== sha256(previousOutcome.body) ||
		ack.frontendRetargetEvidenceSignatureSha256 !==
			sha256(previousOutcome.signatureRaw) ||
		ack.retargetSequence !== state.retargetSequence ||
		Date.parse(ack.soakResetAt) <
			Date.parse(previousOutcome.value.verifiedAt)
	) {
		fail('Backend client retarget ACK does not bind the applied head')
	}
	return {
		bodySha256: sha256(ackBody),
		signatureSha256: sha256(ackSignatureRaw)
	}
}

const readReceipt = ({
	receiptPath,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	nowMs,
	owner = { uid: 0, gid: 0 },
	requireSoakPinned = true
}) => {
	const receiptRaw = assertOwnedFile(
		receiptPath,
		'Client switch receipt',
		owner
	)
	const backendPublicKeyRaw = assertOwnedFile(
		backendPublicKeyPath,
		'Pinned backend public key',
		owner
	)
	assertOwnedFile(
		frontendPublicKeyPath,
		'Pinned frontend lifecycle public key',
		owner
	)
	const receipt = validateClientSwitchReceiptRaw(receiptRaw, {
		backendPublicKeyRaw,
		frontendLifecyclePublicKeyPath: frontendPublicKeyPath,
		nowMs
	})
	if (requireSoakPinned && receipt.state !== 'soak-pinned') {
		fail('Client retarget is forbidden after cleanup release')
	}
	return { receipt, receiptRaw }
}

const readState = (
	statePath,
	frontendPublicKeyPath,
	nowMs,
	owner = { uid: 0, gid: 0 }
) => {
	if (!pathExists(statePath)) return null
	return validateRetargetStateRaw(
		assertOwnedFile(statePath, 'Client retarget state', owner),
		{ frontendPublicKeyPath, nowMs }
	)
}

const writeState = ({
	statePath,
	payload,
	frontendPrivateKeyPath,
	owner = { uid: 0, gid: 0 }
}) => {
	assertOwnedFile(
		frontendPrivateKeyPath,
		'Frontend lifecycle private key',
		owner
	)
	if (!exactKeys(payload, RETARGET_STATE_PAYLOAD_KEYS)) {
		fail('Client retarget state payload order is invalid')
	}
	const raw = Buffer.from(
		JSON.stringify({
			...payload,
			signature: signInline(payload, frontendPrivateKeyPath)
		})
	)
	atomicOwnedWrite(statePath, raw, 0o600, owner)
	return raw
}

export const stageClientRetarget = async ({
	repositoryRoot,
	toClientRevision,
	currentBackendRuntimeRevision,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	statePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPrivateKeyPath = FRONTEND_SIGNING_PRIVATE_KEY,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	preparedAt = new Date().toISOString(),
	fetchCandidate = true,
	fetchImpl = globalThis.fetch,
	retargetAckUrl = BACKEND_RETARGET_ACK_URL,
	owner = { uid: 0, gid: 0 }
}) => {
	if (
		!REVISION_PATTERN.test(toClientRevision) ||
		!REVISION_PATTERN.test(currentBackendRuntimeRevision) ||
		!canonicalTimestamp(preparedAt)
	) {
		fail('Client retarget stage inputs are invalid')
	}
	const nowMs = Date.parse(preparedAt)
	assertOwnedFile(
		frontendPrivateKeyPath,
		'Frontend lifecycle private key',
		owner
	)
	const { receipt, receiptRaw } = readReceipt({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
	const state = readState(statePath, frontendPublicKeyPath, nowMs, owner)
	let verifiedState = null
	let previousAppliedOutcome = null
	let previousAckBinding = null
	if (state) {
		assertStateReceiptBinding({ state, receipt, receiptRaw })
		const verified = readVerifiedIntentForState({
			state,
			retargetRoot,
			releaseRoot,
			frontendPublicKeyPath,
			nowMs,
			owner,
			repositoryRoot
		})
		verifiedState = verified
		if (state.state === 'staged') {
			readVerifiedPreviousOutcome({
				state,
				retargetRoot,
				releaseRoot,
				frontendPublicKeyPath,
				nowMs,
				owner
			})
		} else {
			previousAppliedOutcome = readVerifiedAppliedOutcome({
				state,
				...verified,
				receipt,
				receiptRaw,
				retargetRoot,
				releaseRoot,
				frontendPublicKeyPath,
				nowMs,
				owner
			})
		}
	}
	const fromClientRevision =
		state?.currentClientRevision ?? receipt.initialClientRevision
	const previousRetargetEvidenceSha256 =
		state?.appliedRetargetEvidenceSha256 ?? sha256(receiptRaw)
	const retargetSequence = (state?.retargetSequence ?? 0) + 1
	if (
		state?.state === 'applied' &&
		state.currentClientRevision === toClientRevision
	) {
		if (
			state.currentBackendRuntimeRevision !== currentBackendRuntimeRevision
		) {
			fail('Applied client retarget belongs to another backend runtime')
		}
		return verifiedState.intent
	}
	if (state?.state === 'applied') {
		const stableAck = await fetchStableRetargetAck({
			fetchImpl,
			backendPublicKeyPath,
			url: retargetAckUrl,
			nowMs
		})
		previousAckBinding = assertRetargetAckBinding({
			ack: stableAck.value,
			ackBody: stableAck.body,
			ackSignatureRaw: stableAck.signatureRaw,
			state,
			receipt,
			previousOutcome: previousAppliedOutcome
		})
	}
	if (state?.state === 'staged') {
		if (
			state.candidateClientRevision !== toClientRevision ||
			state.currentBackendRuntimeRevision !== currentBackendRuntimeRevision
		) {
			fail('Another client retarget is already staged')
		}
		return validateRetargetIntentRaw(
			assertOwnedFile(
				retargetPaths(toClientRevision, retargetRoot, releaseRoot).intent,
				'Client retarget intent',
				owner
			),
			{ frontendPublicKeyPath, nowMs }
		)
	}
	if (
		retargetSequence > MAX_RETARGETS ||
		toClientRevision === fromClientRevision
	) {
		fail('Client retarget sequence or revision is invalid')
	}
	const root = resolve(repositoryRoot)
	const head = gitText(root, ['rev-parse', '--verify', 'HEAD^{commit}'])
	if (head !== fromClientRevision)
		fail('Frontend checkout is not the current retarget head')
	if (fetchCandidate) {
		git(root, ['fetch', '--no-tags', 'origin', 'refs/heads/prod'])
		if (
			gitText(root, ['rev-parse', '--verify', 'FETCH_HEAD^{commit}']) !==
			toClientRevision
		) {
			fail('Advertised prod revision differs from the retarget candidate')
		}
	}
	const ancestor = spawnSync(
		'git',
		[
			'-C',
			root,
			'merge-base',
			'--is-ancestor',
			fromClientRevision,
			toClientRevision
		],
		{ stdio: 'ignore' }
	)
	if (ancestor.status !== 0)
		fail('Client retarget candidate is not a strict descendant')
	const currentSummary = clientLifecycleSummary(root, fromClientRevision)
	const candidateSummary = clientLifecycleSummary(root, toClientRevision)
	if (
		currentSummary.clientLifecycleContractSha256 !==
		candidateSummary.clientLifecycleContractSha256
	) {
		fail('Client retarget changes the frozen avatar lifecycle contract')
	}
	const payload = {
		version: 1,
		kind: RETARGET_INTENT_KIND,
		initialClientRevision: receipt.initialClientRevision,
		fromClientRevision,
		toClientRevision,
		ownershipRevision: receipt.backendServerRevision,
		currentBackendRuntimeRevision,
		identityDatabaseId: receipt.identityDatabaseId,
		clientSwitchReceiptSha256: sha256(receiptRaw),
		previousRetargetEvidenceSha256,
		previousBackendAckEvidenceSha256:
			previousAckBinding?.bodySha256 ?? null,
		previousBackendAckEvidenceSignatureSha256:
			previousAckBinding?.signatureSha256 ?? null,
		...candidateSummary,
		retargetSequence,
		soakResetRequired: true,
		preparedAt
	}
	if (!exactKeys(payload, RETARGET_INTENT_PAYLOAD_KEYS)) {
		fail('Client retarget intent payload order is invalid')
	}
	const intentRaw = Buffer.from(
		JSON.stringify({
			...payload,
			signature: signInline(payload, frontendPrivateKeyPath)
		})
	)
	const intentPath = retargetPaths(
		toClientRevision,
		retargetRoot,
		releaseRoot
	).intent
	durableNoClobber(intentPath, intentRaw, 0o600, owner)
	validateRetargetIntentRaw(intentRaw, { frontendPublicKeyPath, nowMs })
	writeState({
		statePath,
		frontendPrivateKeyPath,
		owner,
		payload: {
			version: 1,
			kind: RETARGET_STATE_KIND,
			state: 'staged',
			initialClientRevision: receipt.initialClientRevision,
			currentClientRevision: fromClientRevision,
			candidateClientRevision: toClientRevision,
			ownershipRevision: receipt.backendServerRevision,
			currentBackendRuntimeRevision,
			identityDatabaseId: receipt.identityDatabaseId,
			clientSwitchReceiptSha256: sha256(receiptRaw),
			retargetSequence,
			previousRetargetEvidenceSha256,
			stagedRetargetIntentSha256: sha256(intentRaw),
			appliedRetargetEvidenceSha256: null,
			updatedAt: preparedAt
		}
	})
	return validateRetargetIntentRaw(intentRaw, {
		frontendPublicKeyPath,
		nowMs
	})
}

export const readRetargetGuard = ({
	currentClientRevision,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	statePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	nowMs = Date.now(),
	repositoryRoot,
	owner = { uid: 0, gid: 0 }
}) => {
	const { receipt, receiptRaw } = readReceipt({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		nowMs,
		owner,
		requireSoakPinned: false
	})
	if (receipt.state === 'released') return 'cleanup-released'
	const state = readState(statePath, frontendPublicKeyPath, nowMs, owner)
	if (!state) {
		return currentClientRevision === receipt.initialClientRevision
			? 'soak-pinned'
			: 'cleanup-required'
	}
	assertStateReceiptBinding({ state, receipt, receiptRaw })
	const verified = readVerifiedIntentForState({
		state,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner,
		repositoryRoot
	})
	if (state.state === 'staged') {
		readVerifiedPreviousOutcome({
			state,
			retargetRoot,
			releaseRoot,
			frontendPublicKeyPath,
			nowMs,
			owner
		})
		if (currentClientRevision === state.currentClientRevision)
			return 'soak-pinned'
		return currentClientRevision === state.candidateClientRevision
			? 'retarget-staged'
			: 'cleanup-required'
	}
	readVerifiedAppliedOutcome({
		state,
		...verified,
		receipt,
		receiptRaw,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
	return currentClientRevision === state.currentClientRevision
		? 'retarget-applied'
		: 'cleanup-required'
}

export const verifyAppliedRetargetForCleanup = ({
	repositoryRoot,
	currentClientRevision,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	statePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	nowMs = Date.now(),
	owner = { uid: 0, gid: 0 }
}) => {
	const { receipt, receiptRaw } = readReceipt({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		nowMs,
		owner,
		requireSoakPinned: false
	})
	const state = readState(statePath, frontendPublicKeyPath, nowMs, owner)
	if (
		!state ||
		state.state !== 'applied' ||
		state.currentClientRevision !== currentClientRevision
	) {
		fail('Cleanup requires the exact applied client retarget state')
	}
	assertStateReceiptBinding({ state, receipt, receiptRaw })
	const verified = readVerifiedIntentForState({
		state,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner,
		repositoryRoot
	})
	return readVerifiedAppliedOutcome({
		state,
		...verified,
		receipt,
		receiptRaw,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
}

const verifyFirstHeartbeat = ({
	body,
	signatureRaw,
	clientRevision,
	releaseSha,
	processStartedAt,
	frontendPublicKeyPath,
	nowMs
}) => {
	const parsed = canonicalJson(
		body,
		1024 * 1024,
		'First retarget heartbeat'
	)
	const value = validateSoakEvidenceRaw(body, {
		expectedRevision: clientRevision,
		expectedReleaseSha: releaseSha,
		expectedProcessStartedAt: processStartedAt,
		expectedLogConfigurationSha: parsed.logConfigurationSha256,
		nowMs
	})
	if (
		value.sequence !== 1 ||
		value.previousEvidenceSha256 !== releaseSha ||
		!verify(
			null,
			body,
			readEd25519PublicKey(frontendPublicKeyPath),
			readSignature(signatureRaw)
		)
	) {
		fail('First retarget heartbeat does not reset the signed soak chain')
	}
	return value
}

export const prepareRetargetOutcome = ({
	repositoryRoot,
	clientRevision,
	currentBackendRuntimeRevision,
	releaseRaw,
	releaseSignatureRaw,
	runtimeRaw,
	heartbeatRaw,
	heartbeatSignatureRaw,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	statePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPrivateKeyPath = FRONTEND_SIGNING_PRIVATE_KEY,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	verifiedAt = new Date().toISOString(),
	owner = { uid: 0, gid: 0 }
}) => {
	if (
		!REVISION_PATTERN.test(clientRevision) ||
		!REVISION_PATTERN.test(currentBackendRuntimeRevision) ||
		!canonicalTimestamp(verifiedAt)
	) {
		fail('Client retarget outcome inputs are invalid')
	}
	const nowMs = Date.parse(verifiedAt)
	assertOwnedFile(
		frontendPrivateKeyPath,
		'Frontend lifecycle private key',
		owner
	)
	const { receipt, receiptRaw } = readReceipt({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
	const state = readState(statePath, frontendPublicKeyPath, nowMs, owner)
	if (
		!state ||
		state.state !== 'staged' ||
		state.candidateClientRevision !== clientRevision ||
		state.currentBackendRuntimeRevision !==
			currentBackendRuntimeRevision ||
		state.clientSwitchReceiptSha256 !== sha256(receiptRaw)
	) {
		fail('Client retarget is not staged for this runtime')
	}
	assertStateReceiptBinding({ state, receipt, receiptRaw })
	const { intent, intentRaw } = readVerifiedIntentForState({
		state,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner,
		repositoryRoot
	})
	readVerifiedPreviousOutcome({
		state,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
	const paths = retargetPaths(clientRevision, retargetRoot, releaseRoot)
	const release = verifyReleaseEvidenceSignature(
		releaseRaw,
		releaseSignatureRaw,
		frontendPublicKeyPath,
		clientRevision
	)
	const runtime = validateRuntimeEvidenceRaw(runtimeRaw, {
		expectedRevision: clientRevision,
		releaseManifestRaw: releaseRaw,
		releaseSignatureRaw
	})
	const heartbeat = verifyFirstHeartbeat({
		body: heartbeatRaw,
		signatureRaw: heartbeatSignatureRaw,
		clientRevision,
		releaseSha: sha256(releaseRaw),
		processStartedAt: runtime.processStartedAt,
		frontendPublicKeyPath,
		nowMs
	})
	if (
		Date.parse(heartbeat.generatedAt) > nowMs ||
		Date.parse(heartbeat.generatedAt) > Date.parse(verifiedAt) ||
		Date.parse(runtime.processStartedAt) >
			Date.parse(heartbeat.generatedAt)
	) {
		fail('Client retarget outcome predates its first heartbeat')
	}
	const value = {
		version: 1,
		kind: RETARGET_KIND,
		initialClientRevision: receipt.initialClientRevision,
		fromClientRevision: state.currentClientRevision,
		toClientRevision: clientRevision,
		ownershipRevision: receipt.backendServerRevision,
		currentBackendRuntimeRevision,
		identityDatabaseId: receipt.identityDatabaseId,
		clientSwitchReceiptSha256: sha256(receiptRaw),
		retargetIntentSha256: sha256(intentRaw),
		previousRetargetEvidenceSha256: state.previousRetargetEvidenceSha256,
		releaseEvidenceSha256: sha256(releaseRaw),
		releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
		releaseTreeSha256: release.treeSha256,
		releaseFullManifestSha256: release.fullManifestSha256,
		clientProcessStartedAt: runtime.processStartedAt,
		legacyReferencesAbsent: true,
		fullBuildManifestPassed: true,
		soakResetRequired: true,
		verifiedAt
	}
	if (!exactKeys(value, RETARGET_OUTCOME_KEYS)) {
		fail('Client retarget outcome key order is invalid')
	}
	const body = Buffer.from(JSON.stringify(value))
	if (pathExists(paths.outcomeSignature) && !pathExists(paths.outcome)) {
		fail('Client retarget signature exists without its immutable body')
	}
	if (pathExists(paths.outcome)) {
		const existingBody = assertOwnedFile(
			paths.outcome,
			'Client retarget outcome',
			{
				...owner,
				mode: 0o644
			}
		)
		const existingValue = validateRetargetOutcomeRaw(existingBody, {
			expectedClientRevision: clientRevision,
			nowMs
		})
		const expectedExisting = {
			...value,
			verifiedAt: existingValue.verifiedAt
		}
		if (
			JSON.stringify(existingValue) !== JSON.stringify(expectedExisting) ||
			Date.parse(existingValue.verifiedAt) <
				Date.parse(heartbeat.generatedAt)
		) {
			fail(
				'Existing client retarget outcome differs from current live evidence'
			)
		}
		if (!pathExists(paths.outcomeSignature)) {
			const recoveredSignature = Buffer.from(
				`${sign(null, existingBody, readEd25519PrivateKey(frontendPrivateKeyPath)).toString('base64')}\n`
			)
			readSignature(recoveredSignature)
			durableNoClobber(
				paths.outcomeSignature,
				recoveredSignature,
				0o644,
				owner
			)
		}
		const existingSignature = assertOwnedFile(
			paths.outcomeSignature,
			'Client retarget outcome signature',
			{ ...owner, mode: 0o644, maxBytes: 1024 }
		)
		verifyRetargetOutcome(
			existingBody,
			existingSignature,
			frontendPublicKeyPath,
			{
				expectedClientRevision: clientRevision,
				nowMs
			}
		)
		return {
			value: existingValue,
			body: existingBody,
			signatureRaw: existingSignature
		}
	}
	const signatureRaw = Buffer.from(
		`${sign(null, body, readEd25519PrivateKey(frontendPrivateKeyPath)).toString('base64')}\n`
	)
	readSignature(signatureRaw)
	durableNoClobber(paths.outcome, body, 0o644, owner)
	durableNoClobber(paths.outcomeSignature, signatureRaw, 0o644, owner)
	verifyRetargetOutcome(body, signatureRaw, frontendPublicKeyPath, {
		expectedClientRevision: clientRevision,
		nowMs
	})
	return { value, body, signatureRaw }
}

export const commitRetargetOutcome = ({
	repositoryRoot,
	clientRevision,
	publicBodyRaw,
	publicSignatureRaw,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	statePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPrivateKeyPath = FRONTEND_SIGNING_PRIVATE_KEY,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	nowMs = Date.now(),
	owner = { uid: 0, gid: 0 }
}) => {
	const paths = retargetPaths(clientRevision, retargetRoot, releaseRoot)
	const localBody = assertOwnedFile(
		paths.outcome,
		'Client retarget outcome',
		{
			...owner,
			mode: 0o644
		}
	)
	const localSignature = assertOwnedFile(
		paths.outcomeSignature,
		'Client retarget outcome signature',
		{ ...owner, mode: 0o644, maxBytes: 1024 }
	)
	if (
		!localBody.equals(publicBodyRaw) ||
		!localSignature.equals(publicSignatureRaw)
	) {
		fail(
			'Public client retarget bytes differ from the durable local evidence'
		)
	}
	const value = verifyRetargetOutcome(
		localBody,
		localSignature,
		frontendPublicKeyPath,
		{ expectedClientRevision: clientRevision, nowMs }
	)
	const { receipt, receiptRaw } = readReceipt({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
	const state = readState(statePath, frontendPublicKeyPath, nowMs, owner)
	if (!state) fail('Client retarget state is absent')
	assertStateReceiptBinding({ state, receipt, receiptRaw })
	const verified = readVerifiedIntentForState({
		state,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner,
		repositoryRoot
	})
	if (state.state === 'applied') {
		if (state.currentClientRevision !== clientRevision) {
			fail('Applied client retarget state binds different evidence')
		}
		readVerifiedAppliedOutcome({
			state,
			...verified,
			receipt,
			receiptRaw,
			retargetRoot,
			releaseRoot,
			frontendPublicKeyPath,
			nowMs,
			owner
		})
		return state
	}
	readVerifiedPreviousOutcome({
		state,
		retargetRoot,
		releaseRoot,
		frontendPublicKeyPath,
		nowMs,
		owner
	})
	if (
		state.candidateClientRevision !== clientRevision ||
		value.fromClientRevision !== state.currentClientRevision ||
		value.clientSwitchReceiptSha256 !== sha256(receiptRaw) ||
		value.ownershipRevision !== receipt.backendServerRevision ||
		value.identityDatabaseId !== receipt.identityDatabaseId ||
		value.currentBackendRuntimeRevision !==
			state.currentBackendRuntimeRevision ||
		value.retargetIntentSha256 !== sha256(verified.intentRaw) ||
		value.previousRetargetEvidenceSha256 !==
			state.previousRetargetEvidenceSha256
	) {
		fail('Client retarget outcome cannot advance the current state')
	}
	const raw = writeState({
		statePath,
		frontendPrivateKeyPath,
		owner,
		payload: {
			version: 1,
			kind: RETARGET_STATE_KIND,
			state: 'applied',
			initialClientRevision: state.initialClientRevision,
			currentClientRevision: clientRevision,
			candidateClientRevision: null,
			ownershipRevision: state.ownershipRevision,
			currentBackendRuntimeRevision: state.currentBackendRuntimeRevision,
			identityDatabaseId: state.identityDatabaseId,
			clientSwitchReceiptSha256: state.clientSwitchReceiptSha256,
			retargetSequence: state.retargetSequence,
			previousRetargetEvidenceSha256: state.previousRetargetEvidenceSha256,
			stagedRetargetIntentSha256: state.stagedRetargetIntentSha256,
			appliedRetargetEvidenceSha256: sha256(localBody),
			updatedAt: value.verifiedAt
		}
	})
	return validateRetargetStateRaw(raw, { frontendPublicKeyPath, nowMs })
}

export const prefetchCleanupAfterRetarget = async ({
	repositoryRoot,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	statePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	runtimeRebindPrivateRoot,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPrivateKeyPath = FRONTEND_SIGNING_PRIVATE_KEY,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	nowMs = Date.now(),
	owner = { uid: 0, gid: 0 },
	fetchImpl = globalThis.fetch,
	archivePaths
}) => {
	const { receipt, receiptRaw } = readReceipt({
		receiptPath,
		backendPublicKeyPath,
		frontendPublicKeyPath,
		nowMs,
		owner,
		requireSoakPinned: false
	})
	if (receipt.state === 'released') return receipt
	const state = readState(statePath, frontendPublicKeyPath, nowMs, owner)
	if (state) {
		assertStateReceiptBinding({ state, receipt, receiptRaw })
		if (state.state !== 'applied') {
			fail('Backend cleanup cannot release a staged client retarget')
		}
		const verified = readVerifiedIntentForState({
			state,
			retargetRoot,
			releaseRoot,
			frontendPublicKeyPath,
			nowMs,
			owner,
			repositoryRoot
		})
		readVerifiedAppliedOutcome({
			state,
			...verified,
			receipt,
			receiptRaw,
			retargetRoot,
			releaseRoot,
			frontendPublicKeyPath,
			nowMs,
			owner
		})
	}
	const cleanup = await fetchStableBackendCleanupComplete({
		fetchImpl,
		nowMs
	})
	return verifyAndPromoteClientSwitchReceiptForOwner({
		repositoryRoot,
		receiptPath,
		cleanupRaw: cleanup.attestationRaw,
		cleanupSignatureRaw: cleanup.signatureRaw,
		backendPublicKeyPath,
		frontendPrivateKeyPath,
		frontendPublicKeyPath,
		retargetStatePath: statePath,
		retargetRoot,
		releaseRoot,
		runtimeRebindPrivateRoot,
		cleanupArchivePaths: revision => ({
			attestationPath: join(
				releaseRoot,
				revision,
				'backend-cleanup-complete-v1.json'
			),
			signaturePath: join(
				releaseRoot,
				revision,
				'backend-cleanup-complete-v1.json.sig'
			)
		}),
		releasedAt: new Date(nowMs).toISOString(),
		expectedUid: owner.uid,
		expectedGid: owner.gid,
		...(archivePaths ? { archivePaths } : {})
	})
}

const fetchBackendRuntimeRevision = async () => {
	const response = await fetch(BACKEND_HEALTH_URL, {
		redirect: 'error',
		headers: { Accept: 'application/json' }
	})
	if (
		response.status !== 200 ||
		!response.headers
			.get('cache-control')
			?.toLowerCase()
			.split(',')
			.map(item => item.trim())
			.includes('no-store')
	) {
		fail('Backend deployment health is not an exact no-store 200 response')
	}
	const raw = Buffer.from(await response.arrayBuffer())
	if (raw.length > 64 * 1024)
		fail('Backend deployment health is too large')
	return validateBackendDeploymentHealthRaw(raw).revision
}

const parseArguments = args => {
	if (args.length % 2 !== 0)
		fail('Every retarget CLI option requires a value')
	const result = {}
	for (let index = 0; index < args.length; index += 2) {
		const key = args[index]
		const value = args[index + 1]
		if (
			!key?.startsWith('--') ||
			value === undefined ||
			value.startsWith('--')
		) {
			fail('Every retarget CLI option must use --name value form')
		}
		const name = key.slice(2)
		if (name in result) fail(`Duplicate retarget CLI option: ${key}`)
		result[name] = value
	}
	return result
}

const requireOptions = (options, expected) => {
	if (
		JSON.stringify(Object.keys(options).sort()) !==
		JSON.stringify([...expected].sort())
	) {
		fail(
			`Expected only these retarget CLI options: ${expected.join(', ')}`
		)
	}
}

const requireRoot = () => {
	if (typeof process.getuid !== 'function' || process.getuid() !== 0) {
		fail('Client soak retarget lifecycle may only run as root')
	}
}

const runCli = async () => {
	const [command, ...args] = process.argv.slice(2)
	const options = parseArguments(args)
	if (command === 'stage') {
		requireRoot()
		requireOptions(options, ['repository-root', 'revision'])
		readReceipt({
			receiptPath: CLIENT_SWITCH_RECEIPT_PATH,
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			nowMs: Date.now(),
			owner: { uid: 0, gid: 0 },
			requireSoakPinned: true
		})
		const backendRevision = await fetchBackendRuntimeRevision()
		const value = await stageClientRetarget({
			repositoryRoot: options['repository-root'],
			toClientRevision: options.revision,
			currentBackendRuntimeRevision: backendRevision
		})
		process.stdout.write(
			`identity_avatar_client_retarget=staged\nidentity_avatar_client_retarget_revision=${value.toClientRevision}\n`
		)
		return
	}
	if (command === 'guard') {
		requireRoot()
		requireOptions(options, ['repository-root', 'revision'])
		process.stdout.write(
			readRetargetGuard({
				currentClientRevision: options.revision,
				repositoryRoot: options['repository-root']
			})
		)
		return
	}
	if (command === 'prepare-outcome') {
		requireRoot()
		requireOptions(options, [
			'repository-root',
			'revision',
			'backend-runtime-revision',
			'release',
			'release-signature',
			'runtime',
			'heartbeat',
			'heartbeat-signature'
		])
		const result = prepareRetargetOutcome({
			repositoryRoot: options['repository-root'],
			clientRevision: options.revision,
			currentBackendRuntimeRevision: options['backend-runtime-revision'],
			releaseRaw: readBoundedRegularFile(
				options.release,
				64 * 1024,
				'Retarget release evidence'
			),
			releaseSignatureRaw: readBoundedRegularFile(
				options['release-signature'],
				1024,
				'Retarget release signature'
			),
			runtimeRaw: readBoundedRegularFile(
				options.runtime,
				64 * 1024,
				'Retarget runtime evidence'
			),
			heartbeatRaw: readBoundedRegularFile(
				options.heartbeat,
				1024 * 1024,
				'Retarget first heartbeat'
			),
			heartbeatSignatureRaw: readBoundedRegularFile(
				options['heartbeat-signature'],
				1024,
				'Retarget first heartbeat signature'
			)
		})
		process.stdout.write(
			`${sha256(result.body)} ${sha256(result.signatureRaw)}`
		)
		return
	}
	if (command === 'commit-outcome') {
		requireRoot()
		requireOptions(options, [
			'repository-root',
			'revision',
			'public-body',
			'public-signature'
		])
		const body = readBoundedRegularFile(
			options['public-body'],
			64 * 1024,
			'Public retarget outcome'
		)
		const signatureRaw = readBoundedRegularFile(
			options['public-signature'],
			1024,
			'Public retarget outcome signature'
		)
		const value = commitRetargetOutcome({
			repositoryRoot: options['repository-root'],
			clientRevision: options.revision,
			publicBodyRaw: body,
			publicSignatureRaw: signatureRaw
		})
		process.stdout.write(
			`${value.currentClientRevision} ${value.appliedRetargetEvidenceSha256}`
		)
		return
	}
	if (command === 'prefetch-cleanup') {
		requireRoot()
		requireOptions(options, ['repository-root'])
		const value = await prefetchCleanupAfterRetarget({
			repositoryRoot: options['repository-root']
		})
		process.stdout.write(value.state)
		return
	}
	if (command === 'verify-outcome') {
		requireOptions(options, [
			'revision',
			'body',
			'signature',
			'public-key'
		])
		verifyRetargetOutcome(
			readBoundedRegularFile(options.body, 64 * 1024, 'Retarget outcome'),
			readBoundedRegularFile(
				options.signature,
				1024,
				'Retarget outcome signature'
			),
			options['public-key'],
			{ expectedClientRevision: options.revision }
		)
		return
	}
	fail('Unknown client soak retarget command')
}

if (
	resolve(process.argv[1] || '') ===
	resolve(fileURLToPath(import.meta.url))
) {
	runCli().catch(error => {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`
		)
		process.exit(1)
	})
}
