#!/usr/bin/env node

import {
	constants as fsConstants,
	closeSync,
	existsSync,
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
	writeFileSync
} from 'node:fs'
import { createHash, sign, verify } from 'node:crypto'
import { get } from 'node:https'
import { dirname, join, resolve } from 'node:path'
import { TextDecoder } from 'node:util'
import {
	BACKEND_SIGNING_PUBLIC_KEY,
	CLIENT_RELEASE_EVIDENCE_ROOT,
	CLIENT_SWITCH_RECEIPT_PATH,
	FRONTEND_SIGNING_PRIVATE_KEY,
	FRONTEND_SIGNING_PUBLIC_KEY,
	readBoundedRegularFile,
	readEd25519PrivateKey,
	readEd25519PublicKey,
	readSignature,
	sha256,
	validateClientSwitchReceiptRaw,
	validateReleaseEvidenceRaw,
	validateRuntimeEvidenceRaw,
	verifyReleaseEvidenceSignature
} from './identity-avatar-client-release-evidence.mjs'
import {
	RETARGET_ROOT,
	RETARGET_STATE_PATH,
	clientLifecycleSummary,
	validateRetargetOutcomeRaw,
	validateRetargetStateRaw,
	verifyAppliedRetargetForCleanup,
	verifyRetargetOutcome
} from './identity-avatar-client-soak-retarget.mjs'
import { validateSoakEvidenceRaw } from './identity-avatar-client-log-soak.mjs'

export const RUNTIME_STABILITY_CURRENT_URL =
	'https://api.winwidget.ru/.well-known/winwidget/identity-avatar-media/runtime-stability-current-v1.json'
export const RUNTIME_REBIND_READY_URL =
	'https://api.winwidget.ru/.well-known/winwidget/identity-avatar-media/frontend-runtime-rebind-ready-v1.json'
export const RUNTIME_REBIND_KIND =
	'identity-avatar-client-runtime-rebind-prepared-v1'
export const RUNTIME_REBIND_ADOPTED_KIND =
	'identity-avatar-client-runtime-rebind-adopted-v1'
export const RUNTIME_REBIND_MUTATION_START_KIND =
	'identity-avatar-client-runtime-rebind-mutation-start-v1'
export const RUNTIME_STABILITY_CURRENT_KIND =
	'identity-avatar-runtime-stability-current-v1'
export const RUNTIME_REBIND_READY_KIND =
	'identity-avatar-frontend-runtime-rebind-ready-v1'
export const RUNTIME_REBIND_PRIVATE_ROOT =
	'/opt/winwidget/deploy/frontend/.identity-avatar-client-runtime-rebind'
export const IMAGE_ADOPTION_PROOF_KIND =
	'identity-avatar-client-image-adoption-v1'

export const IMAGE_ADOPTION_PROOF_KEYS = [
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
]

export const FRONTEND_BINDING_KEYS = [
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

export const RUNTIME_STABILITY_CURRENT_KEYS = [
	'schemaVersion',
	'kind',
	'ownershipRevision',
	'currentRuntimeRevision',
	'initialClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'currentClientBindingEvidenceSha256',
	'runtimeStabilityGeneration',
	'runtimeStabilityEvidenceSha256',
	'runtimeStabilityLedgerGeneration',
	'runtimeStabilityLedgerTailState',
	'runtimeStabilityLedgerTailEvidenceSha256',
	'runtimeRetargetEvidenceSha256',
	'clientRetargetEvidenceSha256',
	'frontendBinding',
	'publishedAt'
]

export const RUNTIME_REBIND_READY_KEYS = [
	'schemaVersion',
	'kind',
	'ownershipRevision',
	'currentRuntimeRevision',
	'initialClientRevision',
	'currentClientRevision',
	'identityDatabaseId',
	'currentClientBindingEvidenceSha256',
	'frontendPreparedEvidenceSha256',
	'frontendPreparedEvidenceSignatureSha256',
	'previousRuntimeStabilityEvidenceSha256',
	'generation',
	'rebindMode',
	'previousFrontendImageId',
	'previousFrontendReleaseEvidenceSha256',
	'previousFrontendReleaseEvidenceSignatureSha256',
	'previousFrontendReleaseTreeSha256',
	'previousFrontendReleaseFullManifestSha256',
	'previousClientProcessStartedAt',
	'preparedAt',
	'expiresAt'
]

export const RUNTIME_REBIND_PREPARED_KEYS = [
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
]

export const RUNTIME_REBIND_MUTATION_START_KEYS = [
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
]

export const RUNTIME_REBIND_ADOPTED_KEYS = [
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
]

const REVISION_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const GENERATION_DIRECTORY_PATTERN = /^generation-([0-9]{6})$/
const MAX_GENERATION = 64
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000
const VALIDITY_MS = 30 * 60 * 1000
const MAX_BODY_BYTES = 64 * 1024
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

const fail = message => {
	throw new Error(message)
}

const exactKeys = (value, keys) =>
	value &&
	typeof value === 'object' &&
	!Array.isArray(value) &&
	JSON.stringify(Object.keys(value)) === JSON.stringify(keys)

const canonicalTimestamp = value =>
	typeof value === 'string' &&
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
	Number.isFinite(Date.parse(value)) &&
	new Date(Date.parse(value)).toISOString() === value

const canonicalJson = (raw, label, maxBytes = MAX_BODY_BYTES) => {
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

const verifyDetached = (body, signatureRaw, publicKeyPath, label) => {
	if (
		!verify(
			null,
			body,
			readEd25519PublicKey(publicKeyPath),
			readSignature(signatureRaw)
		)
	) {
		fail(`${label} detached Ed25519 signature is invalid`)
	}
}

const signatureFile = (body, privateKeyPath) =>
	Buffer.from(
		`${sign(null, body, readEd25519PrivateKey(privateKeyPath)).toString('base64')}\n`
	)

const assertHashOrPending = value =>
	value === 'pending' || SHA256_PATTERN.test(value)

const validateFrontendBinding = (value, currentClientRevision) => {
	if (
		!exactKeys(value, FRONTEND_BINDING_KEYS) ||
		![
			'initial-client-switch',
			'client-code-retarget',
			'frontend-runtime-rebind'
		].includes(value.bindingKind) ||
		![
			value.evidenceSha256,
			value.evidenceSignatureSha256,
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		value.clientRevision !== currentClientRevision ||
		!IMAGE_ID_PATTERN.test(value.imageId) ||
		!canonicalTimestamp(value.processStartedAt)
	) {
		fail('Backend runtime stability frontend binding is invalid')
	}
	return value
}

export const validateImageAdoptionProofRaw = (
	raw,
	{ expectedClientRevision, nowMs = Date.now() } = {}
) => {
	const value = canonicalJson(raw, 'Frontend signed image-adoption proof')
	if (
		!exactKeys(value, IMAGE_ADOPTION_PROOF_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== IMAGE_ADOPTION_PROOF_KIND ||
		!REVISION_PATTERN.test(value.clientRevision) ||
		(expectedClientRevision !== undefined &&
			value.clientRevision !== expectedClientRevision) ||
		!IMAGE_ID_PATTERN.test(value.clientImageId) ||
		![
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256,
			value.candidateTreeSha256,
			value.clientLifecycleContractSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!canonicalTimestamp(value.adoptedAt) ||
		Date.parse(value.adoptedAt) > nowMs + MAX_FUTURE_SKEW_MS
	) {
		fail('Frontend signed image-adoption proof contract is invalid')
	}
	return value
}

export const verifyImageAdoptionProof = (
	body,
	signatureRaw,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateImageAdoptionProofRaw(body, options)
	verifyDetached(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		'Frontend signed image-adoption proof'
	)
	return value
}

export const validateRuntimeStabilityCurrentRaw = (
	raw,
	{ expectedClientRevision, nowMs = Date.now() } = {}
) => {
	const value = canonicalJson(raw, 'Backend runtime stability discovery')
	if (
		!exactKeys(value, RUNTIME_STABILITY_CURRENT_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_STABILITY_CURRENT_KIND ||
		![
			value.ownershipRevision,
			value.currentRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		(expectedClientRevision !== undefined &&
			value.currentClientRevision !== expectedClientRevision) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		!SHA256_PATTERN.test(value.currentClientBindingEvidenceSha256) ||
		!Number.isSafeInteger(value.runtimeStabilityGeneration) ||
		value.runtimeStabilityGeneration < 0 ||
		value.runtimeStabilityGeneration > MAX_GENERATION ||
		!SHA256_PATTERN.test(value.runtimeStabilityEvidenceSha256) ||
		!Number.isSafeInteger(value.runtimeStabilityLedgerGeneration) ||
		value.runtimeStabilityLedgerGeneration < 0 ||
		value.runtimeStabilityLedgerGeneration > MAX_GENERATION ||
		!['applied', 'adopted', 'aborted'].includes(
			value.runtimeStabilityLedgerTailState
		) ||
		!SHA256_PATTERN.test(value.runtimeStabilityLedgerTailEvidenceSha256) ||
		(value.runtimeStabilityLedgerTailState === 'aborted'
			? value.runtimeStabilityLedgerGeneration !==
					value.runtimeStabilityGeneration + 1 ||
				value.runtimeStabilityLedgerTailEvidenceSha256 ===
					value.runtimeStabilityEvidenceSha256
			: value.runtimeStabilityLedgerGeneration !==
					value.runtimeStabilityGeneration ||
				value.runtimeStabilityLedgerTailEvidenceSha256 !==
					value.runtimeStabilityEvidenceSha256) ||
		!assertHashOrPending(value.runtimeRetargetEvidenceSha256) ||
		!assertHashOrPending(value.clientRetargetEvidenceSha256) ||
		!canonicalTimestamp(value.publishedAt) ||
		Date.parse(value.publishedAt) > nowMs + MAX_FUTURE_SKEW_MS
	) {
		fail('Backend runtime stability discovery contract is invalid')
	}
	validateFrontendBinding(
		value.frontendBinding,
		value.currentClientRevision
	)
	return value
}

export const verifyRuntimeStabilityCurrent = (
	body,
	signatureRaw,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRuntimeStabilityCurrentRaw(body, options)
	verifyDetached(
		body,
		signatureRaw,
		backendPublicKeyPath,
		'Backend runtime stability discovery'
	)
	return value
}

export const validateRuntimeRebindPreparedRaw = (
	raw,
	{
		discovery,
		discoveryRaw,
		discoverySignatureRaw,
		expectedBodySha256,
		nowMs = Date.now(),
		requireFresh = true
	} = {}
) => {
	const value = canonicalJson(raw, 'Frontend runtime rebind PREPARED')
	if (
		!exactKeys(value, RUNTIME_REBIND_PREPARED_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_KIND ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		!Number.isSafeInteger(value.previousRuntimeStabilityGeneration) ||
		value.previousRuntimeStabilityGeneration < 0 ||
		value.previousRuntimeStabilityGeneration >= MAX_GENERATION ||
		!Number.isSafeInteger(value.generation) ||
		value.generation < 1 ||
		value.generation > MAX_GENERATION ||
		value.generation <= value.previousRuntimeStabilityGeneration ||
		value.generation > value.previousRuntimeStabilityGeneration + 2 ||
		![
			value.previousRuntimeStabilityEvidenceSha256,
			value.backendCurrentEvidenceSha256,
			value.backendCurrentEvidenceSignatureSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!canonicalTimestamp(value.backendCurrentPublishedAt) ||
		!['planned-restart', 'recovery-adoption'].includes(value.rebindMode) ||
		!IMAGE_ID_PATTERN.test(value.clientImageId) ||
		![
			value.releaseEvidenceSha256,
			value.releaseEvidenceSignatureSha256,
			value.releaseTreeSha256,
			value.releaseFullManifestSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!canonicalTimestamp(value.previousClientProcessStartedAt) ||
		!canonicalTimestamp(value.observedClientProcessStartedAt) ||
		value.legacyReferencesAbsent !== true ||
		value.fullBuildManifestPassed !== true ||
		!canonicalTimestamp(value.preparedAt) ||
		!canonicalTimestamp(value.expiresAt) ||
		Date.parse(value.expiresAt) - Date.parse(value.preparedAt) !==
			VALIDITY_MS ||
		Date.parse(value.preparedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		(requireFresh && Date.parse(value.expiresAt) <= nowMs) ||
		Date.parse(value.backendCurrentPublishedAt) <
			Date.parse(value.preparedAt) - 5 * 60 * 1000 ||
		Date.parse(value.backendCurrentPublishedAt) >
			Date.parse(value.preparedAt) + MAX_FUTURE_SKEW_MS ||
		Date.parse(value.backendCurrentPublishedAt) >
			nowMs + MAX_FUTURE_SKEW_MS ||
		(value.rebindMode === 'planned-restart' &&
			value.observedClientProcessStartedAt !==
				value.previousClientProcessStartedAt) ||
		(value.rebindMode === 'recovery-adoption' &&
			Date.parse(value.observedClientProcessStartedAt) <=
				Date.parse(value.previousClientProcessStartedAt)) ||
		(expectedBodySha256 !== undefined &&
			sha256(raw) !== expectedBodySha256)
	) {
		fail('Frontend runtime rebind PREPARED contract is invalid')
	}
	const hasClientRetarget =
		value.initialClientRevision !== value.currentClientRevision
	if (
		(hasClientRetarget &&
			(!SHA256_PATTERN.test(value.currentFrontendRetargetEvidenceSha256) ||
				!SHA256_PATTERN.test(
					value.currentFrontendRetargetEvidenceSignatureSha256
				))) ||
		(!hasClientRetarget &&
			(value.currentFrontendRetargetEvidenceSha256 !== null ||
				value.currentFrontendRetargetEvidenceSignatureSha256 !== null))
	) {
		fail(
			'Frontend runtime rebind current client-retarget binding is invalid'
		)
	}
	const hasPriorRuntimeRebind =
		value.previousFrontendRuntimeRebindEvidenceSha256 !== null ||
		value.previousFrontendRuntimeRebindEvidenceSignatureSha256 !== null
	if (
		hasPriorRuntimeRebind !==
			(value.previousFrontendRuntimeRebindEvidenceSha256 !== null &&
				value.previousFrontendRuntimeRebindEvidenceSignatureSha256 !==
					null) ||
		(hasPriorRuntimeRebind &&
			(!SHA256_PATTERN.test(
				value.previousFrontendRuntimeRebindEvidenceSha256
			) ||
				!SHA256_PATTERN.test(
					value.previousFrontendRuntimeRebindEvidenceSignatureSha256
				)))
	) {
		fail('Frontend runtime rebind prior evidence pair is invalid')
	}
	if (discovery) {
		if (
			!Buffer.isBuffer(discoveryRaw) ||
			!Buffer.isBuffer(discoverySignatureRaw)
		) {
			fail('Frontend PREPARED requires the exact backend CURRENT pair')
		}
		const exactDiscovery = validateRuntimeStabilityCurrentRaw(
			discoveryRaw,
			{
				expectedClientRevision: value.currentClientRevision,
				nowMs
			}
		)
		if (JSON.stringify(exactDiscovery) !== JSON.stringify(discovery)) {
			fail('Frontend PREPARED backend CURRENT body is not exact')
		}
		const binding = discovery.frontendBinding
		if (
			value.ownershipRevision !== discovery.ownershipRevision ||
			value.currentBackendRuntimeRevision !==
				discovery.currentRuntimeRevision ||
			value.initialClientRevision !== discovery.initialClientRevision ||
			value.identityDatabaseId !== discovery.identityDatabaseId ||
			value.previousRuntimeStabilityGeneration !==
				discovery.runtimeStabilityGeneration ||
			value.previousRuntimeStabilityEvidenceSha256 !==
				discovery.runtimeStabilityEvidenceSha256 ||
			value.backendCurrentEvidenceSha256 !== sha256(discoveryRaw) ||
			value.backendCurrentEvidenceSignatureSha256 !==
				sha256(discoverySignatureRaw) ||
			value.backendCurrentPublishedAt !== discovery.publishedAt ||
			value.generation !==
				discovery.runtimeStabilityLedgerGeneration + 1 ||
			value.releaseEvidenceSha256 !== binding.releaseEvidenceSha256 ||
			value.releaseEvidenceSignatureSha256 !==
				binding.releaseEvidenceSignatureSha256 ||
			value.releaseTreeSha256 !== binding.releaseTreeSha256 ||
			value.releaseFullManifestSha256 !==
				binding.releaseFullManifestSha256 ||
			value.previousClientProcessStartedAt !== binding.processStartedAt ||
			value.clientImageId !== binding.imageId ||
			(binding.bindingKind === 'frontend-runtime-rebind' &&
				(!hasPriorRuntimeRebind ||
					value.previousFrontendRuntimeRebindEvidenceSha256 !==
						binding.evidenceSha256 ||
					value.previousFrontendRuntimeRebindEvidenceSignatureSha256 !==
						binding.evidenceSignatureSha256)) ||
			(binding.bindingKind !== 'frontend-runtime-rebind' &&
				hasPriorRuntimeRebind)
		) {
			fail('Frontend PREPARED does not bind current backend discovery')
		}
	}
	return value
}

export const validateRuntimeRebindMutationStartRaw = (
	raw,
	{
		prepared,
		preparedRaw,
		preparedSignatureRaw,
		ready,
		readyRaw,
		readySignatureRaw,
		expectedBodySha256,
		nowMs = Date.now()
	} = {}
) => {
	const value = canonicalJson(
		raw,
		'Frontend runtime rebind mutation-start'
	)
	if (
		!exactKeys(value, RUNTIME_REBIND_MUTATION_START_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_MUTATION_START_KIND ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		!Number.isSafeInteger(value.generation) ||
		value.generation < 1 ||
		value.generation > MAX_GENERATION ||
		value.rebindMode !== 'planned-restart' ||
		![
			value.frontendPreparedEvidenceSha256,
			value.frontendPreparedEvidenceSignatureSha256,
			value.backendReadyEvidenceSha256,
			value.backendReadyEvidenceSignatureSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!IMAGE_ID_PATTERN.test(value.previousClientImageId) ||
		!canonicalTimestamp(value.previousClientProcessStartedAt) ||
		!canonicalTimestamp(value.mutationStartedAt) ||
		Date.parse(value.mutationStartedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		(expectedBodySha256 !== undefined &&
			sha256(raw) !== expectedBodySha256)
	) {
		fail('Frontend runtime rebind mutation-start contract is invalid')
	}
	if (prepared && ready) {
		if (
			prepared.rebindMode !== 'planned-restart' ||
			value.ownershipRevision !== prepared.ownershipRevision ||
			value.currentBackendRuntimeRevision !==
				prepared.currentBackendRuntimeRevision ||
			value.initialClientRevision !== prepared.initialClientRevision ||
			value.currentClientRevision !== prepared.currentClientRevision ||
			value.identityDatabaseId !== prepared.identityDatabaseId ||
			value.generation !== prepared.generation ||
			value.generation !== ready.generation ||
			value.frontendPreparedEvidenceSha256 !== sha256(preparedRaw) ||
			value.frontendPreparedEvidenceSignatureSha256 !==
				sha256(preparedSignatureRaw) ||
			value.backendReadyEvidenceSha256 !== sha256(readyRaw) ||
			value.backendReadyEvidenceSignatureSha256 !==
				sha256(readySignatureRaw) ||
			value.previousClientImageId !== prepared.clientImageId ||
			value.previousClientImageId !== ready.previousFrontendImageId ||
			value.previousClientProcessStartedAt !==
				prepared.previousClientProcessStartedAt ||
			value.previousClientProcessStartedAt !==
				ready.previousClientProcessStartedAt ||
			Date.parse(value.mutationStartedAt) <=
				Date.parse(ready.preparedAt) ||
			Date.parse(value.mutationStartedAt) > Date.parse(ready.expiresAt)
		) {
			fail(
				'Frontend mutation-start does not bind PREPARED and backend READY'
			)
		}
	}
	return value
}

export const verifyRuntimeRebindMutationStart = (
	body,
	signatureRaw,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRuntimeRebindMutationStartRaw(body, options)
	verifyDetached(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		'Frontend runtime rebind mutation-start'
	)
	return value
}

export const verifyRuntimeRebindPrepared = (
	body,
	signatureRaw,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRuntimeRebindPreparedRaw(body, options)
	verifyDetached(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		'Frontend runtime rebind PREPARED'
	)
	return value
}

export const validateRuntimeRebindReadyRaw = (
	raw,
	{
		prepared,
		preparedRaw,
		preparedSignatureRaw,
		nowMs = Date.now(),
		requireFresh = true
	} = {}
) => {
	const value = canonicalJson(raw, 'Backend frontend-runtime-rebind READY')
	if (
		!exactKeys(value, RUNTIME_REBIND_READY_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_READY_KIND ||
		![
			value.ownershipRevision,
			value.currentRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
		![
			value.currentClientBindingEvidenceSha256,
			value.frontendPreparedEvidenceSha256,
			value.frontendPreparedEvidenceSignatureSha256,
			value.previousRuntimeStabilityEvidenceSha256,
			value.previousFrontendReleaseEvidenceSha256,
			value.previousFrontendReleaseEvidenceSignatureSha256,
			value.previousFrontendReleaseTreeSha256,
			value.previousFrontendReleaseFullManifestSha256
		].every(item => SHA256_PATTERN.test(item)) ||
		!Number.isSafeInteger(value.generation) ||
		value.generation < 1 ||
		value.generation > MAX_GENERATION ||
		!['planned-restart', 'recovery-adoption'].includes(value.rebindMode) ||
		!IMAGE_ID_PATTERN.test(value.previousFrontendImageId) ||
		!canonicalTimestamp(value.previousClientProcessStartedAt) ||
		!canonicalTimestamp(value.preparedAt) ||
		!canonicalTimestamp(value.expiresAt) ||
		Date.parse(value.expiresAt) - Date.parse(value.preparedAt) !==
			VALIDITY_MS ||
		Date.parse(value.preparedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		(requireFresh && Date.parse(value.expiresAt) <= nowMs)
	) {
		fail('Backend frontend-runtime-rebind READY contract is invalid')
	}
	if (prepared) {
		if (
			value.ownershipRevision !== prepared.ownershipRevision ||
			value.currentRuntimeRevision !==
				prepared.currentBackendRuntimeRevision ||
			value.initialClientRevision !== prepared.initialClientRevision ||
			value.currentClientRevision !== prepared.currentClientRevision ||
			value.identityDatabaseId !== prepared.identityDatabaseId ||
			value.frontendPreparedEvidenceSha256 !== sha256(preparedRaw) ||
			value.frontendPreparedEvidenceSignatureSha256 !==
				sha256(preparedSignatureRaw) ||
			value.previousRuntimeStabilityEvidenceSha256 !==
				prepared.previousRuntimeStabilityEvidenceSha256 ||
			value.generation !== prepared.generation ||
			value.rebindMode !== prepared.rebindMode ||
			value.previousFrontendImageId !== prepared.clientImageId ||
			value.previousFrontendReleaseEvidenceSha256 !==
				prepared.releaseEvidenceSha256 ||
			value.previousFrontendReleaseEvidenceSignatureSha256 !==
				prepared.releaseEvidenceSignatureSha256 ||
			value.previousFrontendReleaseTreeSha256 !==
				prepared.releaseTreeSha256 ||
			value.previousFrontendReleaseFullManifestSha256 !==
				prepared.releaseFullManifestSha256 ||
			value.previousClientProcessStartedAt !==
				prepared.previousClientProcessStartedAt ||
			value.preparedAt !== prepared.preparedAt ||
			value.expiresAt !== prepared.expiresAt
		) {
			fail('Backend READY does not bind the exact frontend PREPARED')
		}
	}
	return value
}

export const verifyRuntimeRebindReady = (
	body,
	signatureRaw,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRuntimeRebindReadyRaw(body, options)
	verifyDetached(
		body,
		signatureRaw,
		backendPublicKeyPath,
		'Backend frontend-runtime-rebind READY'
	)
	return value
}

export const assertRuntimeRebindReadyRefetch = ({
	readyRaw,
	readySignatureRaw,
	refetchedReadyRaw,
	refetchedReadySignatureRaw
}) => {
	if (
		![
			readyRaw,
			readySignatureRaw,
			refetchedReadyRaw,
			refetchedReadySignatureRaw
		].every(Buffer.isBuffer) ||
		!refetchedReadyRaw.equals(readyRaw) ||
		!refetchedReadySignatureRaw.equals(readySignatureRaw)
	) {
		fail('Backend READY changed after mutation-start publication')
	}
}

export const validateRuntimeRebindAdoptedRaw = (
	raw,
	{
		prepared,
		preparedRaw,
		preparedSignatureRaw,
		ready,
		readyRaw,
		readySignatureRaw,
		mutationRaw,
		mutationSignatureRaw,
		heartbeatRaw,
		heartbeatSignatureRaw,
		frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
		nowMs = Date.now()
	} = {}
) => {
	const value = canonicalJson(raw, 'Frontend runtime rebind ADOPTED')
	if (
		!exactKeys(value, RUNTIME_REBIND_ADOPTED_KEYS) ||
		value.schemaVersion !== 1 ||
		value.kind !== RUNTIME_REBIND_ADOPTED_KIND ||
		![
			value.ownershipRevision,
			value.currentBackendRuntimeRevision,
			value.initialClientRevision,
			value.currentClientRevision
		].every(item => REVISION_PATTERN.test(item)) ||
		!UUID_PATTERN.test(value.identityDatabaseId) ||
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
		].every(item => SHA256_PATTERN.test(item)) ||
		!Number.isSafeInteger(value.generation) ||
		value.generation < 1 ||
		value.generation > MAX_GENERATION ||
		!['planned-restart', 'recovery-adoption'].includes(value.rebindMode) ||
		!IMAGE_ID_PATTERN.test(value.clientImageId) ||
		!canonicalTimestamp(value.previousClientProcessStartedAt) ||
		!canonicalTimestamp(value.clientProcessStartedAt) ||
		Date.parse(value.clientProcessStartedAt) <=
			Date.parse(value.previousClientProcessStartedAt) ||
		!canonicalTimestamp(value.firstHeartbeatWindowStartedAt) ||
		!canonicalTimestamp(value.firstHeartbeatWindowEndedAt) ||
		!canonicalTimestamp(value.adoptedAt) ||
		Date.parse(value.firstHeartbeatWindowStartedAt) <
			Date.parse(value.clientProcessStartedAt) ||
		Date.parse(value.firstHeartbeatWindowEndedAt) <=
			Date.parse(value.firstHeartbeatWindowStartedAt) ||
		Date.parse(value.adoptedAt) <
			Date.parse(value.firstHeartbeatWindowEndedAt) ||
		Date.parse(value.adoptedAt) > nowMs + MAX_FUTURE_SKEW_MS ||
		value.legacyReferencesAbsent !== true ||
		value.fullBuildManifestPassed !== true ||
		value.soakResetRequired !== true
	) {
		fail('Frontend runtime rebind ADOPTED contract is invalid')
	}
	const priorPair = [
		value.previousFrontendRuntimeRebindEvidenceSha256,
		value.previousFrontendRuntimeRebindEvidenceSignatureSha256
	]
	if (
		!priorPair.every(item => item === null || SHA256_PATTERN.test(item)) ||
		(priorPair[0] === null) !== (priorPair[1] === null)
	) {
		fail('Frontend runtime rebind ADOPTED prior pair is invalid')
	}
	if (prepared && ready) {
		if (
			value.ownershipRevision !== prepared.ownershipRevision ||
			value.currentBackendRuntimeRevision !==
				prepared.currentBackendRuntimeRevision ||
			value.initialClientRevision !== prepared.initialClientRevision ||
			value.currentClientRevision !== prepared.currentClientRevision ||
			value.identityDatabaseId !== prepared.identityDatabaseId ||
			value.frontendPreparedEvidenceSha256 !== sha256(preparedRaw) ||
			value.frontendPreparedEvidenceSignatureSha256 !==
				sha256(preparedSignatureRaw) ||
			value.backendReadyEvidenceSha256 !== sha256(readyRaw) ||
			value.backendReadyEvidenceSignatureSha256 !==
				sha256(readySignatureRaw) ||
			value.previousFrontendRuntimeRebindEvidenceSha256 !==
				prepared.previousFrontendRuntimeRebindEvidenceSha256 ||
			value.previousFrontendRuntimeRebindEvidenceSignatureSha256 !==
				prepared.previousFrontendRuntimeRebindEvidenceSignatureSha256 ||
			value.previousRuntimeStabilityEvidenceSha256 !==
				prepared.previousRuntimeStabilityEvidenceSha256 ||
			value.generation !== prepared.generation ||
			value.rebindMode !== prepared.rebindMode ||
			value.clientImageId !== prepared.clientImageId ||
			value.releaseEvidenceSha256 !== prepared.releaseEvidenceSha256 ||
			value.releaseEvidenceSignatureSha256 !==
				prepared.releaseEvidenceSignatureSha256 ||
			value.releaseTreeSha256 !== prepared.releaseTreeSha256 ||
			value.releaseFullManifestSha256 !==
				prepared.releaseFullManifestSha256 ||
			value.previousClientProcessStartedAt !==
				prepared.previousClientProcessStartedAt ||
			(prepared.rebindMode === 'recovery-adoption' &&
				value.clientProcessStartedAt !==
					prepared.observedClientProcessStartedAt) ||
			(prepared.rebindMode === 'planned-restart' &&
				Date.parse(value.clientProcessStartedAt) <=
					Date.parse(prepared.preparedAt)) ||
			ready.frontendPreparedEvidenceSha256 !== sha256(preparedRaw)
		) {
			fail('Frontend ADOPTED does not bind PREPARED and backend READY')
		}
		if (prepared.rebindMode === 'planned-restart') {
			if (
				!Buffer.isBuffer(mutationRaw) ||
				!Buffer.isBuffer(mutationSignatureRaw)
			) {
				fail('Planned runtime rebind lacks its mutation-start pair')
			}
			const mutation = verifyRuntimeRebindMutationStart(
				mutationRaw,
				mutationSignatureRaw,
				frontendPublicKeyPath,
				{
					prepared,
					preparedRaw,
					preparedSignatureRaw,
					ready,
					readyRaw,
					readySignatureRaw,
					nowMs
				}
			)
			if (
				Date.parse(value.clientProcessStartedAt) <=
					Date.parse(mutation.mutationStartedAt) ||
				Date.parse(value.clientProcessStartedAt) >
					Date.parse(ready.expiresAt)
			) {
				fail(
					'Planned runtime rebind process is outside the READY mutation window'
				)
			}
		} else if (
			mutationRaw !== undefined ||
			mutationSignatureRaw !== undefined
		) {
			fail('Recovery runtime rebind must not have mutation-start evidence')
		}
	}
	if (heartbeatRaw && heartbeatSignatureRaw && readyRaw) {
		const heartbeat = validateSoakEvidenceRaw(heartbeatRaw, {
			expectedRevision: value.currentClientRevision,
			expectedReleaseSha: value.releaseEvidenceSha256,
			expectedProcessStartedAt: value.clientProcessStartedAt,
			expectedLogConfigurationSha: value.logConfigurationSha256,
			expectedInitialAnchorSha: sha256(readyRaw),
			nowMs
		})
		verifyDetached(
			heartbeatRaw,
			heartbeatSignatureRaw,
			frontendPublicKeyPath,
			'Frontend runtime rebind first heartbeat'
		)
		if (
			heartbeat.sequence !== 1 ||
			value.firstHeartbeatEvidenceSha256 !== sha256(heartbeatRaw) ||
			value.firstHeartbeatEvidenceSignatureSha256 !==
				sha256(heartbeatSignatureRaw) ||
			value.firstHeartbeatWindowStartedAt !== heartbeat.windowStartedAt ||
			value.firstHeartbeatWindowEndedAt !== heartbeat.windowEndedAt
		) {
			fail('Frontend ADOPTED first heartbeat binding is invalid')
		}
	}
	return value
}

export const verifyRuntimeRebindAdopted = (
	body,
	signatureRaw,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	options = {}
) => {
	const value = validateRuntimeRebindAdoptedRaw(body, {
		...options,
		frontendPublicKeyPath
	})
	verifyDetached(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		'Frontend runtime rebind ADOPTED'
	)
	return value
}

export const verifyHistoricalRuntimeRebindAdopted = ({
	preparedRaw,
	preparedSignatureRaw,
	readyRaw,
	readySignatureRaw,
	mutationRaw,
	mutationSignatureRaw,
	adoptedRaw,
	adoptedSignatureRaw,
	heartbeatRaw,
	heartbeatSignatureRaw,
	backendPublicKeyPath,
	frontendPublicKeyPath
}) => {
	const adopted = verifyRuntimeRebindAdopted(
		adoptedRaw,
		adoptedSignatureRaw,
		frontendPublicKeyPath
	)
	const adoptedAtMs = Date.parse(adopted.adoptedAt)
	const prepared = verifyRuntimeRebindPrepared(
		preparedRaw,
		preparedSignatureRaw,
		frontendPublicKeyPath,
		{ nowMs: adoptedAtMs, requireFresh: false }
	)
	const ready = verifyRuntimeRebindReady(
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			nowMs: adoptedAtMs,
			requireFresh: false
		}
	)
	verifyRuntimeRebindAdopted(
		adoptedRaw,
		adoptedSignatureRaw,
		frontendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			ready,
			readyRaw,
			readySignatureRaw,
			mutationRaw,
			mutationSignatureRaw,
			heartbeatRaw,
			heartbeatSignatureRaw,
			nowMs: adoptedAtMs
		}
	)
	const mutation =
		prepared.rebindMode === 'planned-restart'
			? verifyRuntimeRebindMutationStart(
					mutationRaw,
					mutationSignatureRaw,
					frontendPublicKeyPath,
					{
						prepared,
						preparedRaw,
						preparedSignatureRaw,
						ready,
						readyRaw,
						readySignatureRaw,
						nowMs: adoptedAtMs
					}
				)
			: null
	return { prepared, ready, mutation, adopted }
}

export const validateTerminalRuntimeRebindDiscovery = ({
	discovery,
	discoveryRaw,
	discoverySignatureRaw,
	prepared,
	preparedRaw,
	adopted,
	adoptedRaw,
	adoptedSignatureRaw,
	nowMs = Date.now()
}) => {
	if (
		!Buffer.isBuffer(discoveryRaw) ||
		!Buffer.isBuffer(discoverySignatureRaw)
	) {
		fail('Terminal runtime rebind requires the exact backend CURRENT pair')
	}
	const exactDiscovery = validateRuntimeStabilityCurrentRaw(discoveryRaw, {
		expectedClientRevision: adopted.currentClientRevision,
		nowMs
	})
	if (JSON.stringify(exactDiscovery) !== JSON.stringify(discovery)) {
		fail('Terminal runtime rebind backend CURRENT body is not exact')
	}
	if (
		discovery.ownershipRevision !== adopted.ownershipRevision ||
		discovery.currentRuntimeRevision !==
			adopted.currentBackendRuntimeRevision ||
		discovery.initialClientRevision !== adopted.initialClientRevision ||
		discovery.currentClientRevision !== adopted.currentClientRevision ||
		discovery.identityDatabaseId !== adopted.identityDatabaseId
	) {
		fail('Backend discovery is foreign to terminal runtime rebind')
	}
	if (
		discovery.runtimeStabilityGeneration ===
		prepared.previousRuntimeStabilityGeneration
	) {
		validateRuntimeRebindPreparedRaw(preparedRaw, {
			discovery,
			discoveryRaw,
			discoverySignatureRaw,
			nowMs: Date.parse(adopted.adoptedAt),
			requireFresh: false
		})
		return 'acknowledgement-pending'
	}
	const binding = discovery.frontendBinding
	const terminalEvidenceSha256 = discovery.runtimeStabilityEvidenceSha256
	const hasExactAdoptedLedgerTail =
		discovery.runtimeStabilityLedgerTailState === 'adopted' &&
		discovery.runtimeStabilityLedgerGeneration === adopted.generation &&
		discovery.runtimeStabilityLedgerTailEvidenceSha256 ===
			terminalEvidenceSha256
	const hasExactPostAbortLedgerTail =
		discovery.runtimeStabilityLedgerTailState === 'aborted' &&
		discovery.runtimeStabilityLedgerGeneration ===
			adopted.generation + 1 &&
		discovery.runtimeStabilityLedgerTailEvidenceSha256 !==
			terminalEvidenceSha256
	if (
		discovery.runtimeStabilityGeneration !== adopted.generation ||
		(!hasExactAdoptedLedgerTail && !hasExactPostAbortLedgerTail) ||
		binding.bindingKind !== 'frontend-runtime-rebind' ||
		binding.evidenceSha256 !== sha256(adoptedRaw) ||
		binding.evidenceSignatureSha256 !== sha256(adoptedSignatureRaw) ||
		binding.clientRevision !== adopted.currentClientRevision ||
		binding.imageId !== adopted.clientImageId ||
		binding.releaseEvidenceSha256 !== adopted.releaseEvidenceSha256 ||
		binding.releaseEvidenceSignatureSha256 !==
			adopted.releaseEvidenceSignatureSha256 ||
		binding.releaseTreeSha256 !== adopted.releaseTreeSha256 ||
		binding.releaseFullManifestSha256 !==
			adopted.releaseFullManifestSha256 ||
		binding.processStartedAt !== adopted.clientProcessStartedAt
	) {
		fail('Backend discovery does not acknowledge terminal runtime rebind')
	}
	return 'acknowledged'
}

export const classifyRuntimeRebindApplyBoundary = ({
	prepared,
	mutation = null,
	liveProcessStartedAt,
	liveContainerGeneration,
	liveContainerRestartCount
}) => {
	if (
		!prepared ||
		!['planned-restart', 'recovery-adoption'].includes(
			prepared.rebindMode
		) ||
		!Number.isSafeInteger(prepared.generation) ||
		prepared.generation < 1 ||
		prepared.generation > MAX_GENERATION ||
		!canonicalTimestamp(prepared.previousClientProcessStartedAt) ||
		!canonicalTimestamp(prepared.observedClientProcessStartedAt) ||
		!canonicalTimestamp(prepared.expiresAt) ||
		!canonicalTimestamp(liveProcessStartedAt) ||
		!Number.isSafeInteger(liveContainerGeneration) ||
		liveContainerGeneration < 0 ||
		liveContainerGeneration > MAX_GENERATION ||
		liveContainerGeneration > prepared.generation ||
		!Number.isSafeInteger(liveContainerRestartCount) ||
		liveContainerRestartCount < 0
	) {
		fail('Frontend runtime rebind apply boundary is invalid')
	}
	if (prepared.rebindMode === 'planned-restart') {
		if (liveContainerGeneration === prepared.generation) {
			if (
				!mutation ||
				liveContainerRestartCount !== 0 ||
				Date.parse(liveProcessStartedAt) <=
					Date.parse(prepared.previousClientProcessStartedAt) ||
				Date.parse(liveProcessStartedAt) <=
					Date.parse(mutation.mutationStartedAt) ||
				Date.parse(liveProcessStartedAt) > Date.parse(prepared.expiresAt)
			) {
				fail('Completed planned runtime rebind boundary drifted')
			}
			return 'planned-mutation-complete'
		}
		if (
			mutation &&
			(mutation.generation !== prepared.generation ||
				mutation.previousClientProcessStartedAt !==
					prepared.previousClientProcessStartedAt)
		) {
			fail('Planned runtime rebind mutation-start boundary is foreign')
		}
		if (liveProcessStartedAt !== prepared.previousClientProcessStartedAt) {
			fail('Planned runtime rebind boundary changed before mutation')
		}
		return 'planned-mutation-required'
	}
	if (
		mutation !== null ||
		liveContainerRestartCount !== 0 ||
		liveContainerGeneration === prepared.generation ||
		liveProcessStartedAt !== prepared.observedClientProcessStartedAt
	) {
		fail('Recovery runtime rebind boundary changed after PREPARED')
	}
	return 'recovery-adoption'
}

export const runtimeRebindPaths = (
	clientRevision,
	generation,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	privateRoot = RUNTIME_REBIND_PRIVATE_ROOT
) => {
	if (
		!REVISION_PATTERN.test(clientRevision) ||
		!Number.isSafeInteger(generation) ||
		generation < 1 ||
		generation > MAX_GENERATION
	) {
		fail('Frontend runtime rebind artifact identity is invalid')
	}
	const name = `generation-${String(generation).padStart(6, '0')}`
	const publicRoot = join(
		releaseRoot,
		clientRevision,
		'runtime-rebind',
		name
	)
	const privateGenerationRoot = join(privateRoot, clientRevision, name)
	return {
		publicRoot,
		privateGenerationRoot,
		preparedArchive: join(
			privateGenerationRoot,
			'frontend-prepared-v1.json'
		),
		preparedSignatureArchive: join(
			privateGenerationRoot,
			'frontend-prepared-v1.json.sig'
		),
		prepared: join(publicRoot, 'prepared-v1.json'),
		preparedSignature: join(publicRoot, 'prepared-v1.json.sig'),
		mutationStartArchive: join(
			privateGenerationRoot,
			'frontend-mutation-start-v1.json'
		),
		mutationStartSignatureArchive: join(
			privateGenerationRoot,
			'frontend-mutation-start-v1.json.sig'
		),
		mutationStart: join(publicRoot, 'mutation-start-v1.json'),
		mutationStartSignature: join(publicRoot, 'mutation-start-v1.json.sig'),
		adoptedArchive: join(
			privateGenerationRoot,
			'frontend-adopted-v1.json'
		),
		adoptedSignatureArchive: join(
			privateGenerationRoot,
			'frontend-adopted-v1.json.sig'
		),
		adopted: join(publicRoot, 'adopted-v1.json'),
		adoptedSignature: join(publicRoot, 'adopted-v1.json.sig'),
		heartbeat: join(publicRoot, 'heartbeat-000001-v1.json'),
		heartbeatSignature: join(publicRoot, 'heartbeat-000001-v1.json.sig'),
		ready: join(privateGenerationRoot, 'backend-ready-v1.json'),
		readySignature: join(
			privateGenerationRoot,
			'backend-ready-v1.json.sig'
		),
		discovery: join(privateGenerationRoot, 'previous-current-v1.json'),
		discoverySignature: join(
			privateGenerationRoot,
			'previous-current-v1.json.sig'
		)
	}
}

const fsyncDirectory = path => {
	const descriptor = openSync(path, fsConstants.O_RDONLY)
	try {
		fsyncSync(descriptor)
	} finally {
		closeSync(descriptor)
	}
}

const assertDirectory = (path, { uid, gid, mode }) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isDirectory() ||
		metadata.isSymbolicLink() ||
		metadata.uid !== uid ||
		metadata.gid !== gid ||
		(metadata.mode & 0o777) !== mode ||
		realpathSync(path) !== resolve(path)
	) {
		fail(`Runtime rebind directory is unsafe: ${path}`)
	}
}

const ensureDirectory = (path, mode, owner) => {
	if (!existsSync(path)) mkdirSync(path, { recursive: true, mode })
	assertDirectory(path, { ...owner, mode })
}

const assertFile = (path, mode, owner, maxBytes = MAX_BODY_BYTES) => {
	const metadata = lstatSync(path)
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.nlink !== 1 ||
		metadata.uid !== owner.uid ||
		metadata.gid !== owner.gid ||
		(metadata.mode & 0o777) !== mode ||
		metadata.size < 1 ||
		metadata.size > maxBytes
	) {
		fail(`Runtime rebind artifact is unsafe: ${path}`)
	}
	return readFileSync(path)
}

const assertRuntimeRebindActiveReceipt = owner => {
	const receipt = validateClientSwitchReceiptRaw(
		assertFile(CLIENT_SWITCH_RECEIPT_PATH, 0o600, owner),
		{
			backendPublicKeyRaw: assertFile(
				BACKEND_SIGNING_PUBLIC_KEY,
				0o600,
				owner,
				16 * 1024
			),
			frontendLifecyclePublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY
		}
	)
	if (receipt.state !== 'soak-pinned') {
		fail('Frontend runtime rebind is forbidden after cleanup release')
	}
	return receipt
}

const immutableWrite = (path, raw, mode, owner) => {
	ensureDirectory(dirname(path), mode === 0o600 ? 0o700 : 0o755, owner)
	if (existsSync(path)) {
		const existing = assertFile(
			path,
			mode,
			owner,
			Math.max(raw.length, 1024)
		)
		if (!existing.equals(raw))
			fail('Immutable runtime rebind artifact changed')
		return
	}
	const temporary = `${path}.prepared-${process.pid}`
	if (existsSync(temporary))
		fail('Runtime rebind temporary artifact exists')
	let descriptor
	try {
		descriptor = openSync(
			temporary,
			fsConstants.O_WRONLY |
				fsConstants.O_CREAT |
				fsConstants.O_EXCL |
				fsConstants.O_NOFOLLOW,
			mode
		)
		writeFileSync(descriptor, raw)
		fsyncSync(descriptor)
		closeSync(descriptor)
		descriptor = undefined
		linkSync(temporary, path)
		fsyncDirectory(dirname(path))
		rmSync(temporary)
		fsyncDirectory(dirname(path))
		assertFile(path, mode, owner, Math.max(raw.length, 1024))
	} finally {
		if (descriptor !== undefined) closeSync(descriptor)
		if (existsSync(temporary)) rmSync(temporary)
	}
}

export const readRuntimeRebindMutationStartForOwner = ({
	paths,
	prepared,
	preparedRaw,
	preparedSignatureRaw,
	ready,
	readyRaw,
	readySignatureRaw,
	frontendPublicKeyPath,
	owner,
	required = false,
	nowMs = Date.now()
}) => {
	const privateBodyExists = existsSync(paths.mutationStartArchive)
	const privateSignatureExists = existsSync(
		paths.mutationStartSignatureArchive
	)
	const publicBodyExists = existsSync(paths.mutationStart)
	const publicSignatureExists = existsSync(paths.mutationStartSignature)
	if (prepared.rebindMode === 'recovery-adoption') {
		if (
			privateBodyExists ||
			privateSignatureExists ||
			publicBodyExists ||
			publicSignatureExists
		) {
			fail('Recovery runtime rebind contains mutation-start evidence')
		}
		return null
	}
	if (prepared.rebindMode !== 'planned-restart') {
		fail('Runtime rebind mutation-start mode is invalid')
	}
	if (privateBodyExists !== privateSignatureExists) {
		fail('Runtime rebind mutation-start private pair is incomplete')
	}
	if (!privateBodyExists) {
		if (publicBodyExists || publicSignatureExists) {
			fail('Runtime rebind mutation-start lacks its private journal')
		}
		if (required)
			fail('Planned runtime rebind lacks mutation-start evidence')
		return null
	}
	const body = assertFile(paths.mutationStartArchive, 0o600, owner)
	const signatureRaw = assertFile(
		paths.mutationStartSignatureArchive,
		0o600,
		owner,
		1024
	)
	const value = verifyRuntimeRebindMutationStart(
		body,
		signatureRaw,
		frontendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			ready,
			readyRaw,
			readySignatureRaw,
			nowMs
		}
	)
	if (
		publicBodyExists &&
		!assertFile(paths.mutationStart, 0o644, owner).equals(body)
	) {
		fail('Published runtime rebind mutation-start body changed')
	}
	if (
		publicSignatureExists &&
		!assertFile(paths.mutationStartSignature, 0o644, owner, 1024).equals(
			signatureRaw
		)
	) {
		fail('Published runtime rebind mutation-start signature changed')
	}
	return {
		body,
		signatureRaw,
		value,
		publicPairComplete: publicBodyExists && publicSignatureExists
	}
}

export const validateRuntimeRebindApplyEvidenceForOwner = ({
	paths,
	preparedRaw,
	preparedSignatureRaw,
	readyRaw,
	readySignatureRaw,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	owner,
	nowMs = Date.now()
}) => {
	const historicalPrepared = verifyRuntimeRebindPrepared(
		preparedRaw,
		preparedSignatureRaw,
		frontendPublicKeyPath,
		{ nowMs, requireFresh: false }
	)
	const historicalReady = verifyRuntimeRebindReady(
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath,
		{
			prepared: historicalPrepared,
			preparedRaw,
			preparedSignatureRaw,
			nowMs,
			requireFresh: false
		}
	)
	const mutationPair = readRuntimeRebindMutationStartForOwner({
		paths,
		prepared: historicalPrepared,
		preparedRaw,
		preparedSignatureRaw,
		ready: historicalReady,
		readyRaw,
		readySignatureRaw,
		frontendPublicKeyPath,
		owner,
		nowMs
	})
	if (mutationPair?.publicPairComplete === true) {
		return {
			prepared: historicalPrepared,
			ready: historicalReady,
			mutationPair,
			requireFresh: false
		}
	}
	const prepared = verifyRuntimeRebindPrepared(
		preparedRaw,
		preparedSignatureRaw,
		frontendPublicKeyPath,
		{ nowMs }
	)
	const ready = verifyRuntimeRebindReady(
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			nowMs
		}
	)
	return { prepared, ready, mutationPair, requireFresh: true }
}

export const createRuntimeRebindMutationStartForOwner = ({
	preparedRaw,
	preparedSignatureRaw,
	readyRaw,
	readySignatureRaw,
	liveImageId,
	liveProcessStartedAt,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	releaseRoot,
	privateRoot,
	owner,
	mutationStartedAt
}) => {
	const requestedNowMs =
		mutationStartedAt === undefined
			? Date.now()
			: Date.parse(mutationStartedAt)
	const prepared = verifyRuntimeRebindPrepared(
		preparedRaw,
		preparedSignatureRaw,
		frontendPublicKeyPath,
		{ nowMs: requestedNowMs }
	)
	const ready = verifyRuntimeRebindReady(
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			nowMs: requestedNowMs
		}
	)
	const effectiveMutationStartedAt =
		mutationStartedAt === undefined
			? new Date(
					Math.max(requestedNowMs, Date.parse(ready.preparedAt) + 1)
				).toISOString()
			: mutationStartedAt
	const nowMs = Date.parse(effectiveMutationStartedAt)
	if (
		prepared.rebindMode !== 'planned-restart' ||
		liveImageId !== prepared.clientImageId ||
		liveProcessStartedAt !== prepared.previousClientProcessStartedAt
	) {
		fail('Frontend mutation-start live boundary is invalid')
	}
	const value = {
		schemaVersion: 1,
		kind: RUNTIME_REBIND_MUTATION_START_KIND,
		ownershipRevision: prepared.ownershipRevision,
		currentBackendRuntimeRevision: prepared.currentBackendRuntimeRevision,
		initialClientRevision: prepared.initialClientRevision,
		currentClientRevision: prepared.currentClientRevision,
		identityDatabaseId: prepared.identityDatabaseId,
		generation: prepared.generation,
		rebindMode: 'planned-restart',
		frontendPreparedEvidenceSha256: sha256(preparedRaw),
		frontendPreparedEvidenceSignatureSha256: sha256(preparedSignatureRaw),
		backendReadyEvidenceSha256: sha256(readyRaw),
		backendReadyEvidenceSignatureSha256: sha256(readySignatureRaw),
		previousClientImageId: prepared.clientImageId,
		previousClientProcessStartedAt:
			prepared.previousClientProcessStartedAt,
		mutationStartedAt: effectiveMutationStartedAt
	}
	const paths = runtimeRebindPaths(
		prepared.currentClientRevision,
		prepared.generation,
		releaseRoot,
		privateRoot
	)
	const validateStable = (body, signatureRaw) => {
		const existing = verifyRuntimeRebindMutationStart(
			body,
			signatureRaw,
			frontendPublicKeyPath,
			{
				prepared,
				preparedRaw,
				preparedSignatureRaw,
				ready,
				readyRaw,
				readySignatureRaw,
				nowMs
			}
		)
		const expected = {
			...value,
			mutationStartedAt: existing.mutationStartedAt
		}
		if (JSON.stringify(existing) !== JSON.stringify(expected)) {
			fail(
				'Existing frontend mutation-start differs from the live binding'
			)
		}
		return existing
	}
	let body
	let signatureRaw
	let stableValue
	if (existsSync(paths.mutationStartArchive)) {
		body = assertFile(paths.mutationStartArchive, 0o600, owner)
		if (existsSync(paths.mutationStartSignatureArchive)) {
			signatureRaw = assertFile(
				paths.mutationStartSignatureArchive,
				0o600,
				owner,
				1024
			)
		} else {
			signatureRaw = signatureFile(body, frontendPrivateKeyPath)
			immutableWrite(
				paths.mutationStartSignatureArchive,
				signatureRaw,
				0o600,
				owner
			)
		}
		stableValue = validateStable(body, signatureRaw)
	} else if (existsSync(paths.mutationStartSignatureArchive)) {
		fail('Frontend mutation-start private journal is incomplete')
	} else if (
		existsSync(paths.mutationStart) ||
		existsSync(paths.mutationStartSignature)
	) {
		fail('Frontend mutation-start public pair lacks its private journal')
	} else {
		body = Buffer.from(JSON.stringify(value))
		signatureRaw = signatureFile(body, frontendPrivateKeyPath)
		stableValue = validateStable(body, signatureRaw)
	}
	immutableWrite(paths.mutationStartArchive, body, 0o600, owner)
	immutableWrite(
		paths.mutationStartSignatureArchive,
		signatureRaw,
		0o600,
		owner
	)
	immutableWrite(paths.mutationStartSignature, signatureRaw, 0o644, owner)
	immutableWrite(paths.mutationStart, body, 0o644, owner)
	return { body, signatureRaw, value: stableValue, paths }
}

export const restoreTerminalRuntimeRebindMutationStartPublicPairForOwner =
	({
		paths,
		mutationRaw,
		mutationSignatureRaw,
		frontendPublicKeyPath,
		verificationOptions,
		owner
	}) => {
		verifyRuntimeRebindMutationStart(
			mutationRaw,
			mutationSignatureRaw,
			frontendPublicKeyPath,
			verificationOptions
		)
		const archivedBody = assertFile(
			paths.mutationStartArchive,
			0o600,
			owner
		)
		const archivedSignature = assertFile(
			paths.mutationStartSignatureArchive,
			0o600,
			owner,
			1024
		)
		if (
			!archivedBody.equals(mutationRaw) ||
			!archivedSignature.equals(mutationSignatureRaw)
		) {
			fail('Terminal mutation-start differs from its private journal')
		}
		if (
			existsSync(paths.mutationStart) &&
			!assertFile(paths.mutationStart, 0o644, owner).equals(mutationRaw)
		) {
			fail('Published terminal mutation-start body changed')
		}
		if (
			existsSync(paths.mutationStartSignature) &&
			!assertFile(paths.mutationStartSignature, 0o644, owner, 1024).equals(
				mutationSignatureRaw
			)
		) {
			fail('Published terminal mutation-start signature changed')
		}
		immutableWrite(
			paths.mutationStartSignature,
			mutationSignatureRaw,
			0o644,
			owner
		)
		immutableWrite(paths.mutationStart, mutationRaw, 0o644, owner)
		return { body: mutationRaw, signatureRaw: mutationSignatureRaw }
	}

export const restoreTerminalRuntimeRebindPublicPairForOwner = ({
	paths,
	adoptedRaw,
	adoptedSignatureRaw,
	frontendPublicKeyPath,
	verificationOptions,
	owner
}) => {
	verifyRuntimeRebindAdopted(
		adoptedRaw,
		adoptedSignatureRaw,
		frontendPublicKeyPath,
		verificationOptions
	)
	const archivedBody = assertFile(paths.adoptedArchive, 0o600, owner)
	const archivedSignature = assertFile(
		paths.adoptedSignatureArchive,
		0o600,
		owner,
		1024
	)
	if (
		!archivedBody.equals(adoptedRaw) ||
		!archivedSignature.equals(adoptedSignatureRaw)
	) {
		fail('Terminal runtime rebind differs from its private journal')
	}
	if (
		existsSync(paths.adopted) &&
		!assertFile(paths.adopted, 0o644, owner).equals(adoptedRaw)
	) {
		fail('Published runtime rebind ADOPTED body changed')
	}
	if (
		existsSync(paths.adoptedSignature) &&
		!assertFile(paths.adoptedSignature, 0o644, owner, 1024).equals(
			adoptedSignatureRaw
		)
	) {
		fail('Published runtime rebind ADOPTED signature changed')
	}
	immutableWrite(paths.adoptedSignature, adoptedSignatureRaw, 0o644, owner)
	immutableWrite(paths.adopted, adoptedRaw, 0o644, owner)
	return { body: adoptedRaw, signatureRaw: adoptedSignatureRaw }
}

const readImageAdoption = (raw, clientRevision) => {
	const value = canonicalJson(raw, 'Frontend image adoption journal')
	if (
		!exactKeys(value, [
			'schemaVersion',
			'kind',
			'clientRevision',
			'imageId',
			'fullManifestSha256',
			'releaseEvidenceSha256'
		]) ||
		value.schemaVersion !== 1 ||
		value.kind !== 'identity-avatar-client-image-adoption' ||
		value.clientRevision !== clientRevision ||
		!IMAGE_ID_PATTERN.test(value.imageId) ||
		!SHA256_PATTERN.test(value.fullManifestSha256) ||
		!SHA256_PATTERN.test(value.releaseEvidenceSha256)
	) {
		fail('Frontend image adoption journal is invalid')
	}
	return value
}

export const createImageAdoptionProofForOwner = ({
	clientRevision,
	imageAdoptionRaw,
	liveContainerImageId,
	releaseRaw,
	releaseSignatureRaw,
	repositoryRoot,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	releaseRoot,
	privateRoot = RUNTIME_REBIND_PRIVATE_ROOT,
	owner,
	adoptedAt = new Date().toISOString()
}) => {
	const adoption = readImageAdoption(imageAdoptionRaw, clientRevision)
	const release = validateReleaseEvidenceRaw(releaseRaw, clientRevision)
	verifyReleaseEvidenceSignature(
		releaseRaw,
		releaseSignatureRaw,
		frontendPublicKeyPath,
		clientRevision
	)
	const summary = clientLifecycleSummary(repositoryRoot, clientRevision)
	if (
		liveContainerImageId !== adoption.imageId ||
		adoption.releaseEvidenceSha256 !== sha256(releaseRaw) ||
		adoption.fullManifestSha256 !== release.fullManifestSha256
	) {
		fail(
			'Signed image-adoption proof does not match its immutable journal'
		)
	}
	const root = join(releaseRoot, clientRevision)
	const bodyPath = join(root, 'image-adoption-v1.json')
	const signaturePath = `${bodyPath}.sig`
	const privateProofRoot = join(privateRoot, clientRevision)
	const bodyArchivePath = join(privateProofRoot, 'image-adoption-v1.json')
	const signatureArchivePath = `${bodyArchivePath}.sig`
	const validateStableProof = (body, signatureRaw) => {
		const existing = verifyImageAdoptionProof(
			body,
			signatureRaw,
			frontendPublicKeyPath,
			{
				expectedClientRevision: clientRevision,
				nowMs: Date.parse(adoptedAt)
			}
		)
		if (
			existing.clientImageId !== adoption.imageId ||
			existing.releaseEvidenceSha256 !== sha256(releaseRaw) ||
			existing.releaseEvidenceSignatureSha256 !==
				sha256(releaseSignatureRaw) ||
			existing.releaseTreeSha256 !== release.treeSha256 ||
			existing.releaseFullManifestSha256 !== release.fullManifestSha256 ||
			existing.candidateTreeSha256 !== summary.candidateTreeSha256 ||
			existing.clientLifecycleContractSha256 !==
				summary.clientLifecycleContractSha256
		) {
			fail(
				'Existing signed image-adoption proof differs from live release'
			)
		}
		return existing
	}
	let body
	let signatureRaw
	let value
	if (existsSync(bodyArchivePath)) {
		body = assertFile(bodyArchivePath, 0o600, owner)
		if (existsSync(signatureArchivePath)) {
			signatureRaw = assertFile(signatureArchivePath, 0o600, owner, 1024)
		} else {
			signatureRaw = signatureFile(body, frontendPrivateKeyPath)
			immutableWrite(signatureArchivePath, signatureRaw, 0o600, owner)
		}
		value = validateStableProof(body, signatureRaw)
	} else if (existsSync(signatureArchivePath)) {
		fail('Signed image-adoption private journal is incomplete')
	} else if (existsSync(bodyPath) && existsSync(signaturePath)) {
		body = assertFile(bodyPath, 0o644, owner)
		signatureRaw = assertFile(signaturePath, 0o644, owner, 1024)
		value = validateStableProof(body, signatureRaw)
		immutableWrite(bodyArchivePath, body, 0o600, owner)
		immutableWrite(signatureArchivePath, signatureRaw, 0o600, owner)
	} else if (existsSync(bodyPath) || existsSync(signaturePath)) {
		fail(
			'Signed image-adoption public pair is incomplete without its private journal'
		)
	} else {
		value = {
			schemaVersion: 1,
			kind: IMAGE_ADOPTION_PROOF_KIND,
			clientRevision,
			clientImageId: adoption.imageId,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
			releaseTreeSha256: release.treeSha256,
			releaseFullManifestSha256: release.fullManifestSha256,
			candidateTreeSha256: summary.candidateTreeSha256,
			clientLifecycleContractSha256: summary.clientLifecycleContractSha256,
			adoptedAt
		}
		body = Buffer.from(JSON.stringify(value))
		signatureRaw = signatureFile(body, frontendPrivateKeyPath)
		validateStableProof(body, signatureRaw)
		// The private body is the crash-recovery source for either missing
		// signature. Public publication intentionally remains signature-first.
		immutableWrite(bodyArchivePath, body, 0o600, owner)
		immutableWrite(signatureArchivePath, signatureRaw, 0o600, owner)
	}
	immutableWrite(signaturePath, signatureRaw, 0o644, owner)
	immutableWrite(bodyPath, body, 0o644, owner)
	return {
		body,
		signatureRaw,
		value,
		bodyPath,
		signaturePath,
		bodyArchivePath,
		signatureArchivePath
	}
}

const findPreviousRuntimeRebind = ({
	releaseRoot,
	clientRevision,
	binding,
	frontendPublicKeyPath
}) => {
	if (binding.bindingKind !== 'frontend-runtime-rebind') {
		return { bodySha: null, signatureSha: null }
	}
	const root = join(releaseRoot, clientRevision, 'runtime-rebind')
	if (!existsSync(root)) fail('Previous frontend runtime rebind is absent')
	for (const name of readdirSync(root).sort().reverse()) {
		const match = name.match(GENERATION_DIRECTORY_PATTERN)
		if (!match) continue
		const paths = runtimeRebindPaths(
			clientRevision,
			Number(match[1]),
			releaseRoot
		)
		if (
			!existsSync(paths.adopted) ||
			!existsSync(paths.adoptedSignature)
		) {
			continue
		}
		const body = readFileSync(paths.adopted)
		const signatureRaw = readFileSync(paths.adoptedSignature)
		if (
			sha256(body) === binding.evidenceSha256 &&
			sha256(signatureRaw) === binding.evidenceSignatureSha256
		) {
			verifyRuntimeRebindAdopted(body, signatureRaw, frontendPublicKeyPath)
			return {
				bodySha: binding.evidenceSha256,
				signatureSha: binding.evidenceSignatureSha256
			}
		}
	}
	fail(
		'Current backend binding does not have matching local ADOPTED evidence'
	)
}

const readClientRetargetPair = ({
	releaseRoot,
	initialClientRevision,
	currentClientRevision,
	frontendPublicKeyPath
}) => {
	if (initialClientRevision === currentClientRevision) {
		return { bodySha: null, signatureSha: null }
	}
	const bodyPath = join(
		releaseRoot,
		currentClientRevision,
		'soak-retarget-v1.json'
	)
	const signaturePath = `${bodyPath}.sig`
	const body = readFileSync(bodyPath)
	const signatureRaw = readFileSync(signaturePath)
	verifyRetargetOutcome(body, signatureRaw, frontendPublicKeyPath, {
		expectedClientRevision: currentClientRevision
	})
	return { bodySha: sha256(body), signatureSha: sha256(signatureRaw) }
}

export const prepareRuntimeRebindForOwner = ({
	discoveryRaw,
	discoverySignatureRaw,
	runtimeRaw,
	releaseRaw,
	releaseSignatureRaw,
	imageAdoptionRaw,
	imageProofRaw,
	imageProofSignatureRaw,
	rebindMode,
	receiptRaw,
	backendPublicKeyRaw,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	releaseRoot,
	privateRoot,
	preparedAt = new Date().toISOString(),
	owner
}) => {
	const discovery = verifyRuntimeStabilityCurrent(
		discoveryRaw,
		discoverySignatureRaw,
		backendPublicKeyPath
	)
	const receipt = validateClientSwitchReceiptRaw(receiptRaw, {
		backendPublicKeyRaw,
		frontendLifecyclePublicKeyPath: frontendPublicKeyPath
	})
	if (
		receipt.state !== 'soak-pinned' ||
		receipt.initialClientRevision !== discovery.initialClientRevision ||
		receipt.backendServerRevision !== discovery.ownershipRevision ||
		receipt.identityDatabaseId !== discovery.identityDatabaseId
	) {
		fail(
			'Runtime rebind discovery is foreign to the client switch receipt'
		)
	}
	validateReleaseEvidenceRaw(releaseRaw, discovery.currentClientRevision)
	verifyReleaseEvidenceSignature(
		releaseRaw,
		releaseSignatureRaw,
		frontendPublicKeyPath,
		discovery.currentClientRevision
	)
	const release = JSON.parse(releaseRaw.toString('utf8'))
	validateRuntimeEvidenceRaw(runtimeRaw, {
		expectedRevision: discovery.currentClientRevision,
		releaseManifestRaw: releaseRaw,
		releaseSignatureRaw
	})
	const runtime = JSON.parse(runtimeRaw.toString('utf8'))
	const adoption = readImageAdoption(
		imageAdoptionRaw,
		discovery.currentClientRevision
	)
	const imageProof = verifyImageAdoptionProof(
		imageProofRaw,
		imageProofSignatureRaw,
		frontendPublicKeyPath,
		{ expectedClientRevision: discovery.currentClientRevision }
	)
	if (
		adoption.releaseEvidenceSha256 !== sha256(releaseRaw) ||
		adoption.fullManifestSha256 !== release.fullManifestSha256 ||
		release.treeSha256 !== discovery.frontendBinding.releaseTreeSha256 ||
		release.fullManifestSha256 !==
			discovery.frontendBinding.releaseFullManifestSha256 ||
		sha256(releaseRaw) !==
			discovery.frontendBinding.releaseEvidenceSha256 ||
		sha256(releaseSignatureRaw) !==
			discovery.frontendBinding.releaseEvidenceSignatureSha256 ||
		imageProof.clientImageId !== adoption.imageId ||
		sha256(imageProofRaw) !== discovery.frontendBinding.evidenceSha256 ||
		sha256(imageProofSignatureRaw) !==
			discovery.frontendBinding.evidenceSignatureSha256
	) {
		fail('Runtime rebind local image/release differs from backend binding')
	}
	const retargetPair = readClientRetargetPair({
		releaseRoot,
		initialClientRevision: discovery.initialClientRevision,
		currentClientRevision: discovery.currentClientRevision,
		frontendPublicKeyPath
	})
	const previousRuntimePair = findPreviousRuntimeRebind({
		releaseRoot,
		clientRevision: discovery.currentClientRevision,
		binding: discovery.frontendBinding,
		frontendPublicKeyPath
	})
	const preparedValue = {
		schemaVersion: 1,
		kind: RUNTIME_REBIND_KIND,
		ownershipRevision: discovery.ownershipRevision,
		currentBackendRuntimeRevision: discovery.currentRuntimeRevision,
		initialClientRevision: discovery.initialClientRevision,
		currentClientRevision: discovery.currentClientRevision,
		identityDatabaseId: discovery.identityDatabaseId,
		currentFrontendRetargetEvidenceSha256: retargetPair.bodySha,
		currentFrontendRetargetEvidenceSignatureSha256:
			retargetPair.signatureSha,
		previousFrontendRuntimeRebindEvidenceSha256:
			previousRuntimePair.bodySha,
		previousFrontendRuntimeRebindEvidenceSignatureSha256:
			previousRuntimePair.signatureSha,
		previousRuntimeStabilityGeneration:
			discovery.runtimeStabilityGeneration,
		previousRuntimeStabilityEvidenceSha256:
			discovery.runtimeStabilityEvidenceSha256,
		backendCurrentEvidenceSha256: sha256(discoveryRaw),
		backendCurrentEvidenceSignatureSha256: sha256(discoverySignatureRaw),
		backendCurrentPublishedAt: discovery.publishedAt,
		generation: discovery.runtimeStabilityLedgerGeneration + 1,
		rebindMode,
		clientImageId: adoption.imageId,
		releaseEvidenceSha256: sha256(releaseRaw),
		releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
		releaseTreeSha256: release.treeSha256,
		releaseFullManifestSha256: release.fullManifestSha256,
		previousClientProcessStartedAt:
			discovery.frontendBinding.processStartedAt,
		observedClientProcessStartedAt: runtime.processStartedAt,
		legacyReferencesAbsent: true,
		fullBuildManifestPassed: true,
		preparedAt,
		expiresAt: new Date(Date.parse(preparedAt) + VALIDITY_MS).toISOString()
	}
	const paths = runtimeRebindPaths(
		discovery.currentClientRevision,
		preparedValue.generation,
		releaseRoot,
		privateRoot
	)
	const validateStablePrepared = (body, signatureRaw) => {
		const existing = verifyRuntimeRebindPrepared(
			body,
			signatureRaw,
			frontendPublicKeyPath,
			{
				discovery,
				discoveryRaw,
				discoverySignatureRaw,
				nowMs: Date.parse(preparedAt)
			}
		)
		const expected = {
			...preparedValue,
			preparedAt: existing.preparedAt,
			expiresAt: existing.expiresAt
		}
		if (JSON.stringify(existing) !== JSON.stringify(expected)) {
			fail('Existing frontend PREPARED differs from the live binding')
		}
		return existing
	}
	let body
	let signatureRaw
	let value
	if (existsSync(paths.preparedArchive)) {
		body = assertFile(paths.preparedArchive, 0o600, owner)
		if (existsSync(paths.preparedSignatureArchive)) {
			signatureRaw = assertFile(
				paths.preparedSignatureArchive,
				0o600,
				owner,
				1024
			)
		} else {
			signatureRaw = signatureFile(body, frontendPrivateKeyPath)
			immutableWrite(
				paths.preparedSignatureArchive,
				signatureRaw,
				0o600,
				owner
			)
		}
		value = validateStablePrepared(body, signatureRaw)
	} else if (existsSync(paths.preparedSignatureArchive)) {
		fail('Frontend PREPARED private journal is incomplete')
	} else if (
		existsSync(paths.prepared) &&
		existsSync(paths.preparedSignature)
	) {
		body = assertFile(paths.prepared, 0o644, owner)
		signatureRaw = assertFile(paths.preparedSignature, 0o644, owner, 1024)
		value = validateStablePrepared(body, signatureRaw)
	} else if (
		existsSync(paths.prepared) ||
		existsSync(paths.preparedSignature)
	) {
		fail(
			'Frontend PREPARED public pair is incomplete without its private journal'
		)
	} else {
		body = Buffer.from(JSON.stringify(preparedValue))
		signatureRaw = signatureFile(body, frontendPrivateKeyPath)
		value = validateStablePrepared(body, signatureRaw)
	}
	immutableWrite(paths.discovery, discoveryRaw, 0o600, owner)
	immutableWrite(
		paths.discoverySignature,
		discoverySignatureRaw,
		0o600,
		owner
	)
	// Body-first private persistence makes signature-first public publication
	// recoverable after a crash at either boundary.
	immutableWrite(paths.preparedArchive, body, 0o600, owner)
	immutableWrite(
		paths.preparedSignatureArchive,
		signatureRaw,
		0o600,
		owner
	)
	immutableWrite(paths.preparedSignature, signatureRaw, 0o644, owner)
	immutableWrite(paths.prepared, body, 0o644, owner)
	return { body, signatureRaw, value, paths }
}

export const archiveAndValidateReadyForOwner = ({
	preparedRaw,
	preparedSignatureRaw,
	readyRaw,
	readySignatureRaw,
	backendPublicKeyPath,
	frontendPublicKeyPath,
	releaseRoot,
	privateRoot,
	owner,
	nowMs = Date.now(),
	requireFresh = true
}) => {
	const prepared = verifyRuntimeRebindPrepared(
		preparedRaw,
		preparedSignatureRaw,
		frontendPublicKeyPath,
		{ nowMs, requireFresh }
	)
	const ready = verifyRuntimeRebindReady(
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			nowMs,
			requireFresh
		}
	)
	const paths = runtimeRebindPaths(
		prepared.currentClientRevision,
		prepared.generation,
		releaseRoot,
		privateRoot
	)
	immutableWrite(paths.readySignature, readySignatureRaw, 0o600, owner)
	immutableWrite(paths.ready, readyRaw, 0o600, owner)
	return { prepared, ready, paths }
}

export const adoptRuntimeRebindForOwner = ({
	preparedRaw,
	preparedSignatureRaw,
	readyRaw,
	readySignatureRaw,
	mutationRaw,
	mutationSignatureRaw,
	runtimeRaw,
	releaseRaw,
	releaseSignatureRaw,
	heartbeatRaw,
	heartbeatSignatureRaw,
	imageAdoptionRaw,
	expectedProcessStartedAt,
	backendPublicKeyPath,
	frontendPrivateKeyPath,
	frontendPublicKeyPath,
	releaseRoot,
	privateRoot,
	owner,
	adoptedAt = new Date().toISOString()
}) => {
	const prepared = verifyRuntimeRebindPrepared(
		preparedRaw,
		preparedSignatureRaw,
		frontendPublicKeyPath,
		{ nowMs: Date.parse(adoptedAt), requireFresh: false }
	)
	const ready = verifyRuntimeRebindReady(
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath,
		{
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			nowMs: Date.parse(adoptedAt),
			requireFresh: false
		}
	)
	const mutation =
		prepared.rebindMode === 'planned-restart'
			? verifyRuntimeRebindMutationStart(
					mutationRaw,
					mutationSignatureRaw,
					frontendPublicKeyPath,
					{
						prepared,
						preparedRaw,
						preparedSignatureRaw,
						ready,
						readyRaw,
						readySignatureRaw,
						nowMs: Date.parse(adoptedAt)
					}
				)
			: null
	if (
		prepared.rebindMode === 'recovery-adoption' &&
		(mutationRaw !== undefined || mutationSignatureRaw !== undefined)
	) {
		fail('Recovery runtime rebind must not have mutation-start evidence')
	}
	validateReleaseEvidenceRaw(releaseRaw, prepared.currentClientRevision)
	validateRuntimeEvidenceRaw(runtimeRaw, {
		expectedRevision: prepared.currentClientRevision,
		releaseManifestRaw: releaseRaw,
		releaseSignatureRaw
	})
	const runtime = JSON.parse(runtimeRaw.toString('utf8'))
	const release = JSON.parse(releaseRaw.toString('utf8'))
	const adoption = readImageAdoption(
		imageAdoptionRaw,
		prepared.currentClientRevision
	)
	if (
		!canonicalTimestamp(expectedProcessStartedAt) ||
		runtime.processStartedAt !== expectedProcessStartedAt ||
		adoption.imageId !== prepared.clientImageId ||
		adoption.releaseEvidenceSha256 !== prepared.releaseEvidenceSha256 ||
		adoption.fullManifestSha256 !== prepared.releaseFullManifestSha256 ||
		sha256(releaseRaw) !== prepared.releaseEvidenceSha256 ||
		sha256(releaseSignatureRaw) !==
			prepared.releaseEvidenceSignatureSha256 ||
		release.treeSha256 !== prepared.releaseTreeSha256 ||
		release.fullManifestSha256 !== prepared.releaseFullManifestSha256 ||
		Date.parse(runtime.processStartedAt) <=
			Date.parse(prepared.previousClientProcessStartedAt) ||
		(prepared.rebindMode === 'recovery-adoption' &&
			runtime.processStartedAt !==
				prepared.observedClientProcessStartedAt) ||
		(prepared.rebindMode === 'planned-restart' &&
			Date.parse(runtime.processStartedAt) <=
				Date.parse(mutation.mutationStartedAt))
	) {
		fail(
			'Frontend runtime rebind did not adopt the exact new process/image'
		)
	}
	const heartbeat = validateSoakEvidenceRaw(heartbeatRaw, {
		expectedRevision: prepared.currentClientRevision,
		expectedReleaseSha: prepared.releaseEvidenceSha256,
		expectedProcessStartedAt: runtime.processStartedAt,
		expectedLogConfigurationSha: JSON.parse(heartbeatRaw.toString('utf8'))
			.logConfigurationSha256,
		expectedInitialAnchorSha: sha256(readyRaw),
		nowMs: Date.parse(adoptedAt)
	})
	verifyDetached(
		heartbeatRaw,
		heartbeatSignatureRaw,
		frontendPublicKeyPath,
		'Frontend runtime rebind first heartbeat'
	)
	const value = {
		schemaVersion: 1,
		kind: RUNTIME_REBIND_ADOPTED_KIND,
		ownershipRevision: prepared.ownershipRevision,
		currentBackendRuntimeRevision: prepared.currentBackendRuntimeRevision,
		initialClientRevision: prepared.initialClientRevision,
		currentClientRevision: prepared.currentClientRevision,
		identityDatabaseId: prepared.identityDatabaseId,
		frontendPreparedEvidenceSha256: sha256(preparedRaw),
		frontendPreparedEvidenceSignatureSha256: sha256(preparedSignatureRaw),
		backendReadyEvidenceSha256: sha256(readyRaw),
		backendReadyEvidenceSignatureSha256: sha256(readySignatureRaw),
		previousFrontendRuntimeRebindEvidenceSha256:
			prepared.previousFrontendRuntimeRebindEvidenceSha256,
		previousFrontendRuntimeRebindEvidenceSignatureSha256:
			prepared.previousFrontendRuntimeRebindEvidenceSignatureSha256,
		previousRuntimeStabilityEvidenceSha256:
			prepared.previousRuntimeStabilityEvidenceSha256,
		generation: prepared.generation,
		rebindMode: prepared.rebindMode,
		clientImageId: prepared.clientImageId,
		releaseEvidenceSha256: prepared.releaseEvidenceSha256,
		releaseEvidenceSignatureSha256:
			prepared.releaseEvidenceSignatureSha256,
		releaseTreeSha256: prepared.releaseTreeSha256,
		releaseFullManifestSha256: prepared.releaseFullManifestSha256,
		previousClientProcessStartedAt:
			prepared.previousClientProcessStartedAt,
		clientProcessStartedAt: runtime.processStartedAt,
		firstHeartbeatEvidenceSha256: sha256(heartbeatRaw),
		firstHeartbeatEvidenceSignatureSha256: sha256(heartbeatSignatureRaw),
		firstHeartbeatWindowStartedAt: heartbeat.windowStartedAt,
		firstHeartbeatWindowEndedAt: heartbeat.windowEndedAt,
		logConfigurationSha256: heartbeat.logConfigurationSha256,
		legacyReferencesAbsent: true,
		fullBuildManifestPassed: true,
		soakResetRequired: true,
		adoptedAt
	}
	const paths = runtimeRebindPaths(
		prepared.currentClientRevision,
		prepared.generation,
		releaseRoot,
		privateRoot
	)
	const validateStableAdopted = (body, signatureRaw) => {
		const existing = validateRuntimeRebindAdoptedRaw(body, {
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			ready,
			readyRaw,
			readySignatureRaw,
			mutationRaw,
			mutationSignatureRaw,
			heartbeatRaw,
			heartbeatSignatureRaw,
			frontendPublicKeyPath,
			nowMs: Date.parse(adoptedAt)
		})
		verifyRuntimeRebindAdopted(body, signatureRaw, frontendPublicKeyPath)
		const expected = { ...value, adoptedAt: existing.adoptedAt }
		if (JSON.stringify(existing) !== JSON.stringify(expected)) {
			fail('Existing frontend ADOPTED differs from the live binding')
		}
		return existing
	}
	let body
	let signatureRaw
	let effectiveValue
	if (existsSync(paths.adoptedArchive)) {
		body = assertFile(paths.adoptedArchive, 0o600, owner)
		if (existsSync(paths.adoptedSignatureArchive)) {
			signatureRaw = assertFile(
				paths.adoptedSignatureArchive,
				0o600,
				owner,
				1024
			)
		} else {
			signatureRaw = signatureFile(body, frontendPrivateKeyPath)
			immutableWrite(
				paths.adoptedSignatureArchive,
				signatureRaw,
				0o600,
				owner
			)
		}
		effectiveValue = validateStableAdopted(body, signatureRaw)
	} else if (existsSync(paths.adoptedSignatureArchive)) {
		fail('Frontend ADOPTED private journal is incomplete')
	} else if (
		existsSync(paths.adopted) &&
		existsSync(paths.adoptedSignature)
	) {
		body = assertFile(paths.adopted, 0o644, owner)
		signatureRaw = assertFile(paths.adoptedSignature, 0o644, owner, 1024)
		effectiveValue = validateStableAdopted(body, signatureRaw)
	} else if (
		existsSync(paths.adopted) ||
		existsSync(paths.adoptedSignature)
	) {
		fail(
			'Frontend ADOPTED public pair is incomplete without its private journal'
		)
	} else {
		body = Buffer.from(JSON.stringify(value))
		signatureRaw = signatureFile(body, frontendPrivateKeyPath)
		effectiveValue = validateStableAdopted(body, signatureRaw)
	}
	immutableWrite(paths.adoptedArchive, body, 0o600, owner)
	immutableWrite(paths.adoptedSignatureArchive, signatureRaw, 0o600, owner)
	immutableWrite(paths.adoptedSignature, signatureRaw, 0o644, owner)
	immutableWrite(paths.adopted, body, 0o644, owner)
	return { body, signatureRaw, value: effectiveValue, paths }
}

const requestHttps = (url, expectedRevision, expectedContentType) =>
	new Promise((resolvePromise, rejectPromise) => {
		const request = get(
			url,
			{
				headers: { Accept: expectedContentType },
				timeout: 30_000
			},
			response => {
				const chunks = []
				let bytes = 0
				response.on('data', chunk => {
					bytes += chunk.length
					if (bytes > MAX_BODY_BYTES) {
						request.destroy(new Error('Backend evidence exceeds bound'))
						return
					}
					chunks.push(chunk)
				})
				response.on('end', () => {
					if (
						response.statusCode !== 200 ||
						response.headers.location ||
						response.headers['content-type'] !== expectedContentType ||
						response.headers['cache-control'] !== 'no-store, max-age=0' ||
						response.headers['x-content-type-options'] !== 'nosniff' ||
						!REVISION_PATTERN.test(
							String(response.headers['x-winwidget-revision'] || '')
						) ||
						(expectedRevision !== undefined &&
							response.headers['x-winwidget-revision'] !==
								expectedRevision)
					) {
						rejectPromise(
							new Error('Backend runtime stability HTTP contract mismatch')
						)
						return
					}
					resolvePromise({
						body: Buffer.concat(chunks),
						revision: response.headers['x-winwidget-revision']
					})
				})
			}
		)
		request.on('timeout', () =>
			request.destroy(
				new Error('Backend runtime stability request timed out')
			)
		)
		request.on('error', rejectPromise)
	})

export const fetchStableBackendPair = async ({
	url,
	expectedRevision,
	validate,
	retries = 5
}) => {
	let lastError
	for (let attempt = 1; attempt <= retries; attempt += 1) {
		try {
			const first = await requestHttps(
				url,
				expectedRevision,
				'application/json; charset=utf-8'
			)
			const signature = await requestHttps(
				`${url}.sig`,
				expectedRevision,
				'application/octet-stream'
			)
			const second = await requestHttps(
				url,
				expectedRevision,
				'application/json; charset=utf-8'
			)
			if (
				!first.body.equals(second.body) ||
				first.revision !== signature.revision ||
				first.revision !== second.revision
			) {
				fail('Backend runtime stability body changed during stable fetch')
			}
			const value = validate(first.body, signature.body)
			const valueRevision =
				value.currentRuntimeRevision || value.currentBackendRuntimeRevision
			if (valueRevision !== first.revision) {
				fail('Backend evidence body does not bind its revision header')
			}
			return { body: first.body, signatureRaw: signature.body, value }
		} catch (error) {
			lastError = error
			if (attempt < retries) {
				await new Promise(resolvePromise =>
					setTimeout(resolvePromise, 250)
				)
			}
		}
	}
	throw lastError
}

export const runtimeRebindLocalState = ({
	clientRevision,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	privateRoot = RUNTIME_REBIND_PRIVATE_ROOT
}) => {
	if (!REVISION_PATTERN.test(clientRevision))
		fail('Client revision is invalid')
	const root = join(releaseRoot, clientRevision, 'runtime-rebind')
	if (!existsSync(root)) return { state: 'none', generation: 0 }
	let latest = 0
	for (const name of readdirSync(root)) {
		const match = name.match(GENERATION_DIRECTORY_PATTERN)
		if (!match) fail('Runtime rebind root contains an unexpected entry')
		const generation = Number(match[1])
		if (generation < 1 || generation > MAX_GENERATION) {
			fail('Runtime rebind generation directory is invalid')
		}
		latest = Math.max(latest, generation)
	}
	if (latest === 0) return { state: 'none', generation: 0 }
	const paths = runtimeRebindPaths(
		clientRevision,
		latest,
		releaseRoot,
		privateRoot
	)
	const preparedExists = existsSync(paths.prepared)
	const preparedSignatureExists = existsSync(paths.preparedSignature)
	const mutationStartArchiveExists = existsSync(paths.mutationStartArchive)
	const mutationStartSignatureArchiveExists = existsSync(
		paths.mutationStartSignatureArchive
	)
	const mutationStartExists = existsSync(paths.mutationStart)
	const mutationStartSignatureExists = existsSync(
		paths.mutationStartSignature
	)
	const adoptedExists = existsSync(paths.adopted)
	const adoptedSignatureExists = existsSync(paths.adoptedSignature)
	const adoptedArchiveExists = existsSync(paths.adoptedArchive)
	const adoptedSignatureArchiveExists = existsSync(
		paths.adoptedSignatureArchive
	)
	if (!preparedExists || !preparedSignatureExists) {
		fail('Runtime rebind generation lacks its immutable PREPARED pair')
	}
	const prepared = canonicalJson(
		readFileSync(paths.prepared),
		'Frontend runtime rebind PREPARED'
	)
	if (
		!exactKeys(prepared, RUNTIME_REBIND_PREPARED_KEYS) ||
		prepared.kind !== RUNTIME_REBIND_KIND ||
		prepared.generation !== latest ||
		!['planned-restart', 'recovery-adoption'].includes(prepared.rebindMode)
	) {
		fail('Runtime rebind generation has an invalid PREPARED identity')
	}
	if (
		mutationStartArchiveExists !== mutationStartSignatureArchiveExists ||
		((mutationStartExists || mutationStartSignatureExists) &&
			!mutationStartArchiveExists)
	) {
		fail('Runtime rebind mutation-start pair is incomplete')
	}
	if (
		prepared.rebindMode === 'recovery-adoption' &&
		(mutationStartArchiveExists ||
			mutationStartSignatureArchiveExists ||
			mutationStartExists ||
			mutationStartSignatureExists)
	) {
		fail('Recovery runtime rebind contains mutation-start evidence')
	}
	if (
		adoptedArchiveExists !== adoptedSignatureArchiveExists ||
		(adoptedExists !== adoptedSignatureExists && !adoptedArchiveExists)
	) {
		fail('Runtime rebind ADOPTED pair is incomplete')
	}
	if (
		prepared.rebindMode === 'planned-restart' &&
		(adoptedArchiveExists || (adoptedExists && adoptedSignatureExists)) &&
		!mutationStartArchiveExists
	) {
		fail('Planned terminal runtime rebind lacks mutation-start evidence')
	}
	return {
		state:
			adoptedArchiveExists || (adoptedExists && adoptedSignatureExists)
				? 'adopted'
				: 'prepared',
		generation: latest,
		mutationStarted: mutationStartArchiveExists,
		paths
	}
}

const fetchStableFrontendRuntime = async revision => {
	const url =
		'https://winwidget.ru/.well-known/winwidget/identity-avatar-client/runtime-v1.json'
	const first = await requestHttps(
		url,
		revision,
		'application/json; charset=utf-8'
	)
	const second = await requestHttps(
		url,
		revision,
		'application/json; charset=utf-8'
	)
	if (
		!first.body.equals(second.body) ||
		first.revision !== second.revision
	) {
		fail('Frontend runtime evidence changed during stable fetch')
	}
	return first.body
}

const fetchStableFrontendArtifact = async ({
	url,
	revision,
	expectedBody,
	expectedSignature,
	validate
}) => {
	const first = await requestHttps(
		url,
		revision,
		'application/json; charset=utf-8'
	)
	const signature = await requestHttps(
		`${url}.sig`,
		revision,
		'application/octet-stream'
	)
	const second = await requestHttps(
		url,
		revision,
		'application/json; charset=utf-8'
	)
	if (
		!first.body.equals(second.body) ||
		!first.body.equals(expectedBody) ||
		!signature.body.equals(expectedSignature)
	) {
		fail('Frontend runtime rebind public pair is unstable or unbound')
	}
	validate(first.body, signature.body)
}

const localReleaseContext = revision => {
	const root = join(CLIENT_RELEASE_EVIDENCE_ROOT, revision)
	const release = readBoundedRegularFile(
		join(root, 'release-evidence-v1.json'),
		MAX_BODY_BYTES,
		'Frontend release evidence'
	)
	const releaseSignature = readBoundedRegularFile(
		join(root, 'release-evidence-v1.json.sig'),
		1024,
		'Frontend release signature'
	)
	const imageAdoption = readBoundedRegularFile(
		join(
			CLIENT_RELEASE_EVIDENCE_ROOT,
			`.image-adoption-${revision}-v1.json`
		),
		MAX_BODY_BYTES,
		'Frontend image adoption journal'
	)
	const imageProof = readBoundedRegularFile(
		join(root, 'image-adoption-v1.json'),
		MAX_BODY_BYTES,
		'Frontend signed image-adoption proof'
	)
	const imageProofSignature = readBoundedRegularFile(
		join(root, 'image-adoption-v1.json.sig'),
		1024,
		'Frontend signed image-adoption signature'
	)
	return {
		root,
		release,
		releaseSignature,
		imageAdoption,
		imageProof,
		imageProofSignature
	}
}

export const verifyCleanupFrontendBindingForOwner = ({
	cleanup,
	receipt,
	repositoryRoot,
	receiptPath = CLIENT_SWITCH_RECEIPT_PATH,
	retargetStatePath = RETARGET_STATE_PATH,
	retargetRoot = RETARGET_ROOT,
	releaseRoot = CLIENT_RELEASE_EVIDENCE_ROOT,
	privateRoot = RUNTIME_REBIND_PRIVATE_ROOT,
	frontendPublicKeyPath = FRONTEND_SIGNING_PUBLIC_KEY,
	backendPublicKeyPath = BACKEND_SIGNING_PUBLIC_KEY,
	owner = { uid: 0, gid: 0 }
}) => {
	if (
		!cleanup ||
		!receipt ||
		!REVISION_PATTERN.test(cleanup.currentClientRevision) ||
		!cleanup.frontendBinding ||
		cleanup.frontendBinding.clientRevision !==
			cleanup.currentClientRevision ||
		receipt.initialClientRevision !== cleanup.initialClientRevision ||
		receipt.backendServerRevision !== cleanup.ownershipRevision ||
		receipt.identityDatabaseId !== cleanup.identityDatabaseId
	) {
		fail('Cleanup frontend binding is foreign to the client switch')
	}
	const revision = cleanup.currentClientRevision
	const binding = cleanup.frontendBinding
	const releaseDirectory = join(releaseRoot, revision)
	const releaseRaw = assertFile(
		join(releaseDirectory, 'release-evidence-v1.json'),
		0o644,
		owner
	)
	const releaseSignatureRaw = assertFile(
		join(releaseDirectory, 'release-evidence-v1.json.sig'),
		0o644,
		owner,
		1024
	)
	const fullManifestRaw = assertFile(
		join(releaseDirectory, 'release-full-manifest-v1.json'),
		0o600,
		owner,
		16 * 1024 * 1024
	)
	const release = validateReleaseEvidenceRaw(
		releaseRaw,
		revision,
		fullManifestRaw
	)
	verifyReleaseEvidenceSignature(
		releaseRaw,
		releaseSignatureRaw,
		frontendPublicKeyPath,
		revision
	)
	const adoption = readImageAdoption(
		assertFile(
			join(releaseRoot, `.image-adoption-${revision}-v1.json`),
			0o600,
			owner
		),
		revision
	)
	const imageProofRaw = assertFile(
		join(releaseDirectory, 'image-adoption-v1.json'),
		0o644,
		owner
	)
	const imageProofSignatureRaw = assertFile(
		join(releaseDirectory, 'image-adoption-v1.json.sig'),
		0o644,
		owner,
		1024
	)
	const privateImageProofRoot = join(privateRoot, revision)
	const privateImageProofRaw = assertFile(
		join(privateImageProofRoot, 'image-adoption-v1.json'),
		0o600,
		owner
	)
	const privateImageProofSignatureRaw = assertFile(
		join(privateImageProofRoot, 'image-adoption-v1.json.sig'),
		0o600,
		owner,
		1024
	)
	if (
		!privateImageProofRaw.equals(imageProofRaw) ||
		!privateImageProofSignatureRaw.equals(imageProofSignatureRaw)
	) {
		fail('Cleanup image-adoption public pair differs from private archive')
	}
	const imageProof = verifyImageAdoptionProof(
		imageProofRaw,
		imageProofSignatureRaw,
		frontendPublicKeyPath,
		{
			expectedClientRevision: revision,
			nowMs: Date.parse(cleanup.completedAt)
		}
	)
	if (
		sha256(releaseRaw) !== binding.releaseEvidenceSha256 ||
		sha256(releaseSignatureRaw) !==
			binding.releaseEvidenceSignatureSha256 ||
		release.treeSha256 !== binding.releaseTreeSha256 ||
		release.fullManifestSha256 !== binding.releaseFullManifestSha256 ||
		sha256(fullManifestRaw) !== release.fullManifestSha256 ||
		adoption.imageId !== binding.imageId ||
		adoption.releaseEvidenceSha256 !== sha256(releaseRaw) ||
		adoption.fullManifestSha256 !== release.fullManifestSha256 ||
		imageProof.clientImageId !== adoption.imageId ||
		imageProof.releaseEvidenceSha256 !== sha256(releaseRaw) ||
		imageProof.releaseEvidenceSignatureSha256 !==
			sha256(releaseSignatureRaw) ||
		imageProof.releaseTreeSha256 !== release.treeSha256 ||
		imageProof.releaseFullManifestSha256 !== release.fullManifestSha256
	) {
		fail('Cleanup frontend binding differs from local release evidence')
	}

	let verifiedRetarget = null
	if (revision !== cleanup.initialClientRevision) {
		if (!repositoryRoot) {
			fail('Cleanup descendant client binding requires its repository')
		}
		verifiedRetarget = verifyAppliedRetargetForCleanup({
			repositoryRoot,
			currentClientRevision: revision,
			receiptPath,
			statePath: retargetStatePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath,
			frontendPublicKeyPath,
			nowMs: Date.parse(cleanup.completedAt),
			owner
		})
		const verifiedRetargetOutcome = verifiedRetarget.value
		if (
			verifiedRetargetOutcome.initialClientRevision !==
				cleanup.initialClientRevision ||
			verifiedRetargetOutcome.ownershipRevision !==
				cleanup.ownershipRevision ||
			verifiedRetargetOutcome.identityDatabaseId !==
				cleanup.identityDatabaseId ||
			verifiedRetargetOutcome.releaseEvidenceSha256 !==
				binding.releaseEvidenceSha256 ||
			verifiedRetargetOutcome.releaseEvidenceSignatureSha256 !==
				binding.releaseEvidenceSignatureSha256 ||
			verifiedRetargetOutcome.releaseTreeSha256 !==
				binding.releaseTreeSha256 ||
			verifiedRetargetOutcome.releaseFullManifestSha256 !==
				binding.releaseFullManifestSha256
		) {
			fail('Cleanup descendant client retarget chain is foreign')
		}
	} else if (sha256(releaseRaw) !== receipt.initialReleaseEvidenceSha256) {
		fail('Cleanup initial release differs from the switch receipt')
	}

	let expectedProcessStartedAt
	if (binding.bindingKind === 'frontend-runtime-rebind') {
		const runtimeRoot = join(releaseDirectory, 'runtime-rebind')
		if (!existsSync(runtimeRoot)) {
			fail('Cleanup runtime-rebind binding has no local history')
		}
		const matchingHistories = []
		for (const name of readdirSync(runtimeRoot).sort().reverse()) {
			const match = GENERATION_DIRECTORY_PATTERN.exec(name)
			if (!match) continue
			const paths = runtimeRebindPaths(
				revision,
				Number(match[1]),
				releaseRoot,
				privateRoot
			)
			if (
				!existsSync(paths.adopted) ||
				!existsSync(paths.adoptedSignature)
			) {
				continue
			}
			const adoptedRaw = assertFile(paths.adopted, 0o644, owner)
			const adoptedSignatureRaw = assertFile(
				paths.adoptedSignature,
				0o644,
				owner,
				1024
			)
			if (
				sha256(adoptedRaw) !== binding.evidenceSha256 ||
				sha256(adoptedSignatureRaw) !== binding.evidenceSignatureSha256
			) {
				continue
			}
			const preparedRaw = assertFile(paths.prepared, 0o644, owner)
			const preparedSignatureRaw = assertFile(
				paths.preparedSignature,
				0o644,
				owner,
				1024
			)
			const preparedArchiveRaw = assertFile(
				paths.preparedArchive,
				0o600,
				owner
			)
			const preparedArchiveSignatureRaw = assertFile(
				paths.preparedSignatureArchive,
				0o600,
				owner,
				1024
			)
			const adoptedArchiveRaw = assertFile(
				paths.adoptedArchive,
				0o600,
				owner
			)
			const adoptedArchiveSignatureRaw = assertFile(
				paths.adoptedSignatureArchive,
				0o600,
				owner,
				1024
			)
			if (
				!preparedArchiveRaw.equals(preparedRaw) ||
				!preparedArchiveSignatureRaw.equals(preparedSignatureRaw) ||
				!adoptedArchiveRaw.equals(adoptedRaw) ||
				!adoptedArchiveSignatureRaw.equals(adoptedSignatureRaw)
			) {
				fail(
					'Cleanup runtime-rebind public pairs differ from private archives'
				)
			}
			const readyRaw = assertFile(paths.ready, 0o600, owner)
			const readySignatureRaw = assertFile(
				paths.readySignature,
				0o600,
				owner,
				1024
			)
			const heartbeatRaw = assertFile(paths.heartbeat, 0o644, owner)
			const heartbeatSignatureRaw = assertFile(
				paths.heartbeatSignature,
				0o644,
				owner,
				1024
			)
			const adoptedSyntax = verifyRuntimeRebindAdopted(
				adoptedRaw,
				adoptedSignatureRaw,
				frontendPublicKeyPath
			)
			if (adoptedSyntax.generation !== Number(match[1])) {
				fail('Cleanup runtime-rebind directory generation is invalid')
			}
			const discoveryRaw = assertFile(paths.discovery, 0o600, owner)
			const discoverySignatureRaw = assertFile(
				paths.discoverySignature,
				0o600,
				owner,
				1024
			)
			const discovery = verifyRuntimeStabilityCurrent(
				discoveryRaw,
				discoverySignatureRaw,
				backendPublicKeyPath,
				{
					expectedClientRevision: revision,
					nowMs: Date.parse(adoptedSyntax.adoptedAt)
				}
			)
			verifyRuntimeRebindPrepared(
				preparedRaw,
				preparedSignatureRaw,
				frontendPublicKeyPath,
				{
					discovery,
					discoveryRaw,
					discoverySignatureRaw,
					nowMs: Date.parse(adoptedSyntax.adoptedAt),
					requireFresh: false
				}
			)
			let mutationRaw
			let mutationSignatureRaw
			if (adoptedSyntax.rebindMode === 'planned-restart') {
				mutationRaw = assertFile(paths.mutationStart, 0o644, owner)
				mutationSignatureRaw = assertFile(
					paths.mutationStartSignature,
					0o644,
					owner,
					1024
				)
				const mutationArchiveRaw = assertFile(
					paths.mutationStartArchive,
					0o600,
					owner
				)
				const mutationArchiveSignatureRaw = assertFile(
					paths.mutationStartSignatureArchive,
					0o600,
					owner,
					1024
				)
				if (
					!mutationArchiveRaw.equals(mutationRaw) ||
					!mutationArchiveSignatureRaw.equals(mutationSignatureRaw)
				) {
					fail('Cleanup runtime-rebind mutation pair archive differs')
				}
			} else if (
				[
					paths.mutationStart,
					paths.mutationStartSignature,
					paths.mutationStartArchive,
					paths.mutationStartSignatureArchive
				].some(path => existsSync(path))
			) {
				fail('Cleanup recovery runtime-rebind has mutation evidence')
			}
			const historical = verifyHistoricalRuntimeRebindAdopted({
				preparedRaw,
				preparedSignatureRaw,
				readyRaw,
				readySignatureRaw,
				mutationRaw,
				mutationSignatureRaw,
				adoptedRaw,
				adoptedSignatureRaw,
				heartbeatRaw,
				heartbeatSignatureRaw,
				backendPublicKeyPath,
				frontendPublicKeyPath
			})
			if (
				discovery.currentClientBindingEvidenceSha256 !==
					historical.ready.currentClientBindingEvidenceSha256 ||
				historical.ready.currentClientBindingEvidenceSha256 !==
					cleanup.currentClientBindingEvidenceSha256 ||
				(verifiedRetarget !== null &&
					(historical.prepared.currentFrontendRetargetEvidenceSha256 !==
						sha256(verifiedRetarget.body) ||
						historical.prepared
							.currentFrontendRetargetEvidenceSignatureSha256 !==
							sha256(verifiedRetarget.signatureRaw)))
			) {
				fail('Cleanup runtime-rebind backend binding chain differs')
			}
			matchingHistories.push(historical)
		}
		if (matchingHistories.length !== 1) {
			fail(
				'Cleanup runtime-rebind binding must have one exact local ADOPTED pair'
			)
		}
		const matched = matchingHistories[0].adopted
		if (
			matched.initialClientRevision !== cleanup.initialClientRevision ||
			matched.currentClientRevision !== revision ||
			matched.ownershipRevision !== cleanup.ownershipRevision ||
			matched.identityDatabaseId !== cleanup.identityDatabaseId ||
			matched.clientImageId !== binding.imageId ||
			matched.releaseEvidenceSha256 !== binding.releaseEvidenceSha256 ||
			matched.releaseEvidenceSignatureSha256 !==
				binding.releaseEvidenceSignatureSha256 ||
			matched.releaseTreeSha256 !== binding.releaseTreeSha256 ||
			matched.releaseFullManifestSha256 !==
				binding.releaseFullManifestSha256
		) {
			fail('Cleanup runtime-rebind ADOPTED pair is foreign')
		}
		expectedProcessStartedAt = matched.clientProcessStartedAt
	} else if (binding.bindingKind === 'client-code-retarget') {
		if (revision === cleanup.initialClientRevision) {
			fail(
				'Cleanup client-retarget binding did not change client revision'
			)
		}
		const outcome = verifiedRetarget.value
		if (
			outcome.initialClientRevision !== cleanup.initialClientRevision ||
			outcome.ownershipRevision !== cleanup.ownershipRevision ||
			outcome.identityDatabaseId !== cleanup.identityDatabaseId ||
			outcome.releaseEvidenceSha256 !== binding.releaseEvidenceSha256 ||
			outcome.releaseEvidenceSignatureSha256 !==
				binding.releaseEvidenceSignatureSha256 ||
			outcome.releaseTreeSha256 !== binding.releaseTreeSha256 ||
			outcome.releaseFullManifestSha256 !==
				binding.releaseFullManifestSha256
		) {
			fail('Cleanup client-retarget binding is foreign')
		}
		expectedProcessStartedAt = outcome.clientProcessStartedAt
	} else if (binding.bindingKind === 'initial-client-switch') {
		if (revision !== cleanup.initialClientRevision) {
			fail('Cleanup initial binding changed client revision')
		}
		expectedProcessStartedAt = receipt.clientProcessStartedAt
	} else {
		fail('Cleanup frontend binding kind is unknown')
	}
	if (
		binding.bindingKind !== 'frontend-runtime-rebind' &&
		(sha256(imageProofRaw) !== binding.evidenceSha256 ||
			sha256(imageProofSignatureRaw) !== binding.evidenceSignatureSha256)
	) {
		fail('Cleanup image-adoption binding does not match local proof')
	}
	if (binding.processStartedAt !== expectedProcessStartedAt) {
		fail('Cleanup frontend process does not match local terminal evidence')
	}
	return binding
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
			fail('Runtime rebind options must use --name value form')
		}
		const name = key.slice(2)
		if (name in options) fail(`Duplicate runtime rebind option: ${key}`)
		options[name] = value
	}
	return options
}

const main = async () => {
	const [command, ...args] = process.argv.slice(2)
	const options = parseArguments(args)
	const rootOwner = { uid: 0, gid: 0 }
	if (command === 'stage-live') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					['live-image-id', 'mode', 'repository-root', 'revision'].sort()
				)
		) {
			fail('Frontend runtime rebind live stage options are invalid')
		}
		assertRuntimeRebindActiveReceipt(rootOwner)
		const context = localReleaseContext(options.revision)
		const adoption = readImageAdoption(
			context.imageAdoption,
			options.revision
		)
		if (options['live-image-id'] !== adoption.imageId) {
			fail('Frontend live container image differs from immutable adoption')
		}
		const discoveryPair = await fetchStableBackendPair({
			url: RUNTIME_STABILITY_CURRENT_URL,
			validate: (body, signatureRaw) =>
				verifyRuntimeStabilityCurrent(
					body,
					signatureRaw,
					BACKEND_SIGNING_PUBLIC_KEY,
					{ expectedClientRevision: options.revision }
				)
		})
		const runtimeRaw = await fetchStableFrontendRuntime(options.revision)
		const result = prepareRuntimeRebindForOwner({
			discoveryRaw: discoveryPair.body,
			discoverySignatureRaw: discoveryPair.signatureRaw,
			runtimeRaw,
			releaseRaw: context.release,
			releaseSignatureRaw: context.releaseSignature,
			imageAdoptionRaw: context.imageAdoption,
			imageProofRaw: context.imageProof,
			imageProofSignatureRaw: context.imageProofSignature,
			rebindMode: options.mode,
			receiptRaw: readBoundedRegularFile(
				CLIENT_SWITCH_RECEIPT_PATH,
				MAX_BODY_BYTES,
				'Client switch receipt'
			),
			backendPublicKeyRaw: readBoundedRegularFile(
				BACKEND_SIGNING_PUBLIC_KEY,
				16 * 1024,
				'Backend signing public key'
			),
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
			privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
			owner: rootOwner
		})
		const publicUrl = `https://winwidget.ru/.well-known/winwidget/identity-avatar-client/${options.revision}/runtime-rebind/generation-${String(result.value.generation).padStart(6, '0')}/prepared-v1.json`
		await fetchStableFrontendArtifact({
			url: publicUrl,
			revision: options.revision,
			expectedBody: result.body,
			expectedSignature: result.signatureRaw,
			validate: (body, signatureRaw) =>
				verifyRuntimeRebindPrepared(
					body,
					signatureRaw,
					FRONTEND_SIGNING_PUBLIC_KEY,
					{
						discovery: discoveryPair.value,
						discoveryRaw: discoveryPair.body,
						discoverySignatureRaw: discoveryPair.signatureRaw
					}
				)
		})
		process.stdout.write(
			`${result.value.generation}\t${sha256(result.body)}\t${sha256(result.signatureRaw)}\n`
		)
		return
	}
	if (command === 'archive-ready-live') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(['revision'])
		) {
			fail('Frontend runtime rebind live READY options are invalid')
		}
		assertRuntimeRebindActiveReceipt(rootOwner)
		const local = runtimeRebindLocalState({
			clientRevision: options.revision
		})
		if (!['prepared', 'adopted'].includes(local.state)) {
			fail('Frontend runtime rebind READY requires an active generation')
		}
		const preparedRaw = readFileSync(local.paths.prepared)
		const preparedSignatureRaw = readFileSync(
			local.paths.preparedSignature
		)
		let result
		let readyRaw
		let readySignatureRaw
		let mutationPair = null
		if (local.state === 'prepared') {
			const prepared = verifyRuntimeRebindPrepared(
				preparedRaw,
				preparedSignatureRaw,
				FRONTEND_SIGNING_PUBLIC_KEY,
				{ requireFresh: false }
			)
			const readyPair = await fetchStableBackendPair({
				url: RUNTIME_REBIND_READY_URL,
				expectedRevision: prepared.currentBackendRuntimeRevision,
				validate: (body, signatureRaw) =>
					verifyRuntimeRebindReady(
						body,
						signatureRaw,
						BACKEND_SIGNING_PUBLIC_KEY,
						{
							prepared,
							preparedRaw,
							preparedSignatureRaw,
							requireFresh: false
						}
					)
			})
			readyRaw = readyPair.body
			readySignatureRaw = readyPair.signatureRaw
			const applyEvidenceNowMs = Date.now()
			const applyEvidence = validateRuntimeRebindApplyEvidenceForOwner({
				paths: local.paths,
				preparedRaw,
				preparedSignatureRaw,
				readyRaw,
				readySignatureRaw,
				backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
				owner: rootOwner,
				nowMs: applyEvidenceNowMs
			})
			result = archiveAndValidateReadyForOwner({
				preparedRaw,
				preparedSignatureRaw,
				readyRaw,
				readySignatureRaw,
				backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
				releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
				privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
				owner: rootOwner,
				nowMs: applyEvidenceNowMs,
				requireFresh: applyEvidence.requireFresh
			})
			mutationPair = applyEvidence.mutationPair
		} else {
			readyRaw = readFileSync(local.paths.ready)
			const adoptedRaw = assertFile(
				local.paths.adoptedArchive,
				0o600,
				rootOwner
			)
			const adoptedSignatureRaw = assertFile(
				local.paths.adoptedSignatureArchive,
				0o600,
				rootOwner,
				1024
			)
			readySignatureRaw = readFileSync(local.paths.readySignature)
			const heartbeatRaw = readFileSync(local.paths.heartbeat)
			const heartbeatSignatureRaw = readFileSync(
				local.paths.heartbeatSignature
			)
			const historicalPrepared = verifyRuntimeRebindPrepared(
				preparedRaw,
				preparedSignatureRaw,
				FRONTEND_SIGNING_PUBLIC_KEY,
				{
					nowMs: Date.parse(
						JSON.parse(adoptedRaw.toString('utf8')).adoptedAt
					),
					requireFresh: false
				}
			)
			const historicalReady = verifyRuntimeRebindReady(
				readyRaw,
				readySignatureRaw,
				BACKEND_SIGNING_PUBLIC_KEY,
				{
					prepared: historicalPrepared,
					preparedRaw,
					preparedSignatureRaw,
					requireFresh: false,
					nowMs: Date.parse(
						JSON.parse(adoptedRaw.toString('utf8')).adoptedAt
					)
				}
			)
			mutationPair = readRuntimeRebindMutationStartForOwner({
				paths: local.paths,
				prepared: historicalPrepared,
				preparedRaw,
				preparedSignatureRaw,
				ready: historicalReady,
				readyRaw,
				readySignatureRaw,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
				owner: rootOwner,
				required: historicalPrepared.rebindMode === 'planned-restart',
				nowMs: Date.parse(
					JSON.parse(adoptedRaw.toString('utf8')).adoptedAt
				)
			})
			const historical = verifyHistoricalRuntimeRebindAdopted({
				preparedRaw,
				preparedSignatureRaw,
				readyRaw,
				readySignatureRaw,
				mutationRaw: mutationPair?.body,
				mutationSignatureRaw: mutationPair?.signatureRaw,
				adoptedRaw,
				adoptedSignatureRaw,
				heartbeatRaw,
				heartbeatSignatureRaw,
				backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY
			})
			const receipt = validateClientSwitchReceiptRaw(
				readBoundedRegularFile(
					CLIENT_SWITCH_RECEIPT_PATH,
					MAX_BODY_BYTES,
					'Client switch receipt'
				),
				{
					backendPublicKeyRaw: readFileSync(BACKEND_SIGNING_PUBLIC_KEY),
					frontendLifecyclePublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY
				}
			)
			if (
				receipt.state !== 'soak-pinned' ||
				receipt.initialClientRevision !==
					historical.prepared.initialClientRevision ||
				receipt.backendServerRevision !==
					historical.prepared.ownershipRevision ||
				receipt.identityDatabaseId !==
					historical.prepared.identityDatabaseId
			) {
				fail(
					'Terminal runtime rebind is foreign to the client switch receipt'
				)
			}
			const discoveryPair = await fetchStableBackendPair({
				url: RUNTIME_STABILITY_CURRENT_URL,
				expectedRevision:
					historical.prepared.currentBackendRuntimeRevision,
				validate: (body, signatureRaw) =>
					verifyRuntimeStabilityCurrent(
						body,
						signatureRaw,
						BACKEND_SIGNING_PUBLIC_KEY,
						{ expectedClientRevision: options.revision }
					)
			})
			validateTerminalRuntimeRebindDiscovery({
				discovery: discoveryPair.value,
				discoveryRaw: discoveryPair.body,
				discoverySignatureRaw: discoveryPair.signatureRaw,
				prepared: historical.prepared,
				preparedRaw,
				adopted: historical.adopted,
				adoptedRaw,
				adoptedSignatureRaw
			})
			if (mutationPair) {
				restoreTerminalRuntimeRebindMutationStartPublicPairForOwner({
					paths: local.paths,
					mutationRaw: mutationPair.body,
					mutationSignatureRaw: mutationPair.signatureRaw,
					frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
					verificationOptions: {
						prepared: historical.prepared,
						preparedRaw,
						preparedSignatureRaw,
						ready: historical.ready,
						readyRaw,
						readySignatureRaw,
						nowMs: Date.parse(historical.adopted.adoptedAt)
					},
					owner: rootOwner
				})
				const mutationUrl = `https://winwidget.ru/.well-known/winwidget/identity-avatar-client/${options.revision}/runtime-rebind/generation-${String(local.generation).padStart(6, '0')}/mutation-start-v1.json`
				await fetchStableFrontendArtifact({
					url: mutationUrl,
					revision: options.revision,
					expectedBody: mutationPair.body,
					expectedSignature: mutationPair.signatureRaw,
					validate: (body, signatureRaw) =>
						verifyRuntimeRebindMutationStart(
							body,
							signatureRaw,
							FRONTEND_SIGNING_PUBLIC_KEY
						)
				})
			}
			restoreTerminalRuntimeRebindPublicPairForOwner({
				paths: local.paths,
				adoptedRaw,
				adoptedSignatureRaw,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
				verificationOptions: {
					prepared: historical.prepared,
					preparedRaw,
					preparedSignatureRaw,
					ready: historical.ready,
					readyRaw,
					readySignatureRaw,
					mutationRaw: mutationPair?.body,
					mutationSignatureRaw: mutationPair?.signatureRaw,
					heartbeatRaw,
					heartbeatSignatureRaw,
					nowMs: Date.parse(historical.adopted.adoptedAt)
				},
				owner: rootOwner
			})
			const publicUrl = `https://winwidget.ru/.well-known/winwidget/identity-avatar-client/${options.revision}/runtime-rebind/generation-${String(local.generation).padStart(6, '0')}/adopted-v1.json`
			await fetchStableFrontendArtifact({
				url: publicUrl,
				revision: options.revision,
				expectedBody: adoptedRaw,
				expectedSignature: adoptedSignatureRaw,
				validate: (body, signatureRaw) =>
					verifyRuntimeRebindAdopted(
						body,
						signatureRaw,
						FRONTEND_SIGNING_PUBLIC_KEY
					)
			})
			result = {
				prepared: historical.prepared,
				ready: historical.ready,
				mutation: historical.mutation,
				adopted: historical.adopted
			}
		}
		const liveRuntimeRaw = await fetchStableFrontendRuntime(
			options.revision
		)
		const liveRuntime = validateRuntimeEvidenceRaw(liveRuntimeRaw, {
			expectedRevision: options.revision,
			releaseManifestRaw: localReleaseContext(options.revision).release,
			releaseSignatureRaw: localReleaseContext(options.revision)
				.releaseSignature
		})
		if (
			local.state === 'adopted' &&
			liveRuntime.processStartedAt !==
				result.adopted.clientProcessStartedAt
		) {
			fail('Terminal runtime rebind live process changed after ADOPTED')
		}
		process.stdout.write(
			`${result.ready.generation}\t${result.ready.rebindMode}\t${result.ready.previousFrontendImageId}\t${result.ready.previousClientProcessStartedAt}\t${sha256(readyRaw)}\t${result.prepared.observedClientProcessStartedAt}\t${liveRuntime.processStartedAt}\t${local.state}\t${mutationPair ? sha256(mutationPair.body) : 'absent'}\t${mutationPair ? sha256(mutationPair.signatureRaw) : 'absent'}\n`
		)
		return
	}
	if (command === 'classify-apply-boundary') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'generation',
						'live-container-generation',
						'live-container-restart-count',
						'live-process-started-at',
						'revision'
					].sort()
				)
		) {
			fail('Frontend runtime rebind apply boundary options are invalid')
		}
		for (const name of [
			'generation',
			'live-container-generation',
			'live-container-restart-count'
		]) {
			if (!/^(0|[1-9][0-9]*)$/.test(options[name])) {
				fail('Frontend runtime rebind apply boundary number is invalid')
			}
		}
		const generation = Number(options.generation)
		const paths = runtimeRebindPaths(
			options.revision,
			generation,
			CLIENT_RELEASE_EVIDENCE_ROOT,
			RUNTIME_REBIND_PRIVATE_ROOT
		)
		const preparedRaw = readFileSync(paths.prepared)
		const preparedSignatureRaw = readFileSync(paths.preparedSignature)
		const readyRaw = readFileSync(paths.ready)
		const readySignatureRaw = readFileSync(paths.readySignature)
		const applyEvidence = validateRuntimeRebindApplyEvidenceForOwner({
			paths,
			preparedRaw,
			preparedSignatureRaw,
			readyRaw,
			readySignatureRaw,
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			owner: rootOwner
		})
		const { prepared, mutationPair } = applyEvidence
		if (prepared.generation !== generation) {
			fail('Frontend runtime rebind apply boundary generation changed')
		}
		const classification = classifyRuntimeRebindApplyBoundary({
			prepared,
			mutation: mutationPair?.value || null,
			liveProcessStartedAt: options['live-process-started-at'],
			liveContainerGeneration: Number(
				options['live-container-generation']
			),
			liveContainerRestartCount: Number(
				options['live-container-restart-count']
			)
		})
		process.stdout.write(`${classification}\n`)
		return
	}
	if (command === 'publish-mutation-start-live') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'generation',
						'live-image-id',
						'live-process-started-at',
						'revision'
					].sort()
				)
		) {
			fail('Frontend mutation-start live options are invalid')
		}
		const generation = Number(options.generation)
		const paths = runtimeRebindPaths(
			options.revision,
			generation,
			CLIENT_RELEASE_EVIDENCE_ROOT,
			RUNTIME_REBIND_PRIVATE_ROOT
		)
		const preparedRaw = readFileSync(paths.prepared)
		const preparedSignatureRaw = readFileSync(paths.preparedSignature)
		const readyRaw = readFileSync(paths.ready)
		const readySignatureRaw = readFileSync(paths.readySignature)
		const prepared = verifyRuntimeRebindPrepared(
			preparedRaw,
			preparedSignatureRaw,
			FRONTEND_SIGNING_PUBLIC_KEY
		)
		const ready = verifyRuntimeRebindReady(
			readyRaw,
			readySignatureRaw,
			BACKEND_SIGNING_PUBLIC_KEY,
			{ prepared, preparedRaw, preparedSignatureRaw }
		)
		const result = createRuntimeRebindMutationStartForOwner({
			preparedRaw,
			preparedSignatureRaw,
			readyRaw,
			readySignatureRaw,
			liveImageId: options['live-image-id'],
			liveProcessStartedAt: options['live-process-started-at'],
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
			privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
			owner: rootOwner
		})
		if (result.value.generation !== generation) {
			fail('Frontend mutation-start generation changed')
		}
		const publicUrl = `https://winwidget.ru/.well-known/winwidget/identity-avatar-client/${options.revision}/runtime-rebind/generation-${String(generation).padStart(6, '0')}/mutation-start-v1.json`
		await fetchStableFrontendArtifact({
			url: publicUrl,
			revision: options.revision,
			expectedBody: result.body,
			expectedSignature: result.signatureRaw,
			validate: (body, signatureRaw) =>
				verifyRuntimeRebindMutationStart(
					body,
					signatureRaw,
					FRONTEND_SIGNING_PUBLIC_KEY,
					{
						prepared,
						preparedRaw,
						preparedSignatureRaw,
						ready,
						readyRaw,
						readySignatureRaw
					}
				)
		})
		const refetchedReady = await fetchStableBackendPair({
			url: RUNTIME_REBIND_READY_URL,
			expectedRevision: prepared.currentBackendRuntimeRevision,
			validate: (body, signatureRaw) =>
				verifyRuntimeRebindReady(
					body,
					signatureRaw,
					BACKEND_SIGNING_PUBLIC_KEY,
					{
						prepared,
						preparedRaw,
						preparedSignatureRaw
					}
				)
		})
		assertRuntimeRebindReadyRefetch({
			readyRaw,
			readySignatureRaw,
			refetchedReadyRaw: refetchedReady.body,
			refetchedReadySignatureRaw: refetchedReady.signatureRaw
		})
		process.stdout.write(
			`${sha256(result.body)}\t${sha256(result.signatureRaw)}\t${sha256(refetchedReady.body)}\n`
		)
		return
	}
	if (command === 'adopt-live') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'expected-process-started-at',
						'generation',
						'live-image-id',
						'revision'
					].sort()
				)
		) {
			fail('Frontend runtime rebind live ADOPT options are invalid')
		}
		const generation = Number(options.generation)
		const paths = runtimeRebindPaths(
			options.revision,
			generation,
			CLIENT_RELEASE_EVIDENCE_ROOT,
			RUNTIME_REBIND_PRIVATE_ROOT
		)
		const context = localReleaseContext(options.revision)
		const adoption = readImageAdoption(
			context.imageAdoption,
			options.revision
		)
		if (options['live-image-id'] !== adoption.imageId) {
			fail('Frontend live image changed before ADOPTED publication')
		}
		const runtimeRaw = await fetchStableFrontendRuntime(options.revision)
		const local = runtimeRebindLocalState({
			clientRevision: options.revision
		})
		if (local.generation !== generation) {
			fail('Frontend runtime rebind generation changed before ADOPTED')
		}
		const preparedRaw = readFileSync(paths.prepared)
		const preparedSignatureRaw = readFileSync(paths.preparedSignature)
		const readyRaw = readFileSync(paths.ready)
		const readySignatureRaw = readFileSync(paths.readySignature)
		const lifecycleNowMs =
			local.state === 'adopted'
				? Date.parse(
						canonicalJson(
							assertFile(paths.adoptedArchive, 0o600, rootOwner),
							'Frontend runtime rebind ADOPTED'
						).adoptedAt
					)
				: Date.now()
		const prepared = verifyRuntimeRebindPrepared(
			preparedRaw,
			preparedSignatureRaw,
			FRONTEND_SIGNING_PUBLIC_KEY,
			{ nowMs: lifecycleNowMs, requireFresh: false }
		)
		const ready = verifyRuntimeRebindReady(
			readyRaw,
			readySignatureRaw,
			BACKEND_SIGNING_PUBLIC_KEY,
			{
				prepared,
				preparedRaw,
				preparedSignatureRaw,
				nowMs: lifecycleNowMs,
				requireFresh: false
			}
		)
		const mutationPair = readRuntimeRebindMutationStartForOwner({
			paths,
			prepared,
			preparedRaw,
			preparedSignatureRaw,
			ready,
			readyRaw,
			readySignatureRaw,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			owner: rootOwner,
			required: prepared.rebindMode === 'planned-restart',
			nowMs: lifecycleNowMs
		})
		if (
			local.state === 'prepared' &&
			prepared.rebindMode === 'planned-restart' &&
			mutationPair?.publicPairComplete !== true
		) {
			fail(
				'Planned runtime rebind requires the exact published mutation-start pair'
			)
		}
		let result
		if (local.state === 'adopted') {
			const heartbeatRaw = readFileSync(paths.heartbeat)
			const heartbeatSignatureRaw = readFileSync(paths.heartbeatSignature)
			const adoptedRaw = assertFile(paths.adoptedArchive, 0o600, rootOwner)
			const adoptedSignatureRaw = assertFile(
				paths.adoptedSignatureArchive,
				0o600,
				rootOwner,
				1024
			)
			const historical = verifyHistoricalRuntimeRebindAdopted({
				preparedRaw,
				preparedSignatureRaw,
				readyRaw,
				readySignatureRaw,
				mutationRaw: mutationPair?.body,
				mutationSignatureRaw: mutationPair?.signatureRaw,
				adoptedRaw,
				adoptedSignatureRaw,
				heartbeatRaw,
				heartbeatSignatureRaw,
				backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY
			})
			const receipt = validateClientSwitchReceiptRaw(
				readBoundedRegularFile(
					CLIENT_SWITCH_RECEIPT_PATH,
					MAX_BODY_BYTES,
					'Client switch receipt'
				),
				{
					backendPublicKeyRaw: readFileSync(BACKEND_SIGNING_PUBLIC_KEY),
					frontendLifecyclePublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY
				}
			)
			validateReleaseEvidenceRaw(context.release, options.revision)
			verifyReleaseEvidenceSignature(
				context.release,
				context.releaseSignature,
				FRONTEND_SIGNING_PUBLIC_KEY,
				options.revision
			)
			const runtime = validateRuntimeEvidenceRaw(runtimeRaw, {
				expectedRevision: options.revision,
				releaseManifestRaw: context.release,
				releaseSignatureRaw: context.releaseSignature
			})
			const imageProof = verifyImageAdoptionProof(
				context.imageProof,
				context.imageProofSignature,
				FRONTEND_SIGNING_PUBLIC_KEY,
				{ expectedClientRevision: options.revision }
			)
			if (
				receipt.state !== 'soak-pinned' ||
				receipt.initialClientRevision !==
					historical.prepared.initialClientRevision ||
				receipt.backendServerRevision !==
					historical.prepared.ownershipRevision ||
				receipt.identityDatabaseId !==
					historical.prepared.identityDatabaseId ||
				historical.adopted.generation !== generation ||
				historical.adopted.clientImageId !== adoption.imageId ||
				historical.adopted.clientImageId !== imageProof.clientImageId ||
				historical.adopted.releaseEvidenceSha256 !==
					sha256(context.release) ||
				historical.adopted.releaseEvidenceSignatureSha256 !==
					sha256(context.releaseSignature) ||
				runtime.processStartedAt !==
					historical.adopted.clientProcessStartedAt ||
				runtime.processStartedAt !== options['expected-process-started-at']
			) {
				fail('Terminal runtime rebind live or receipt binding changed')
			}
			const discoveryPair = await fetchStableBackendPair({
				url: RUNTIME_STABILITY_CURRENT_URL,
				expectedRevision:
					historical.prepared.currentBackendRuntimeRevision,
				validate: (body, signatureRaw) =>
					verifyRuntimeStabilityCurrent(
						body,
						signatureRaw,
						BACKEND_SIGNING_PUBLIC_KEY,
						{ expectedClientRevision: options.revision }
					)
			})
			validateTerminalRuntimeRebindDiscovery({
				discovery: discoveryPair.value,
				discoveryRaw: discoveryPair.body,
				discoverySignatureRaw: discoveryPair.signatureRaw,
				prepared: historical.prepared,
				preparedRaw,
				adopted: historical.adopted,
				adoptedRaw,
				adoptedSignatureRaw
			})
			if (mutationPair) {
				restoreTerminalRuntimeRebindMutationStartPublicPairForOwner({
					paths,
					mutationRaw: mutationPair.body,
					mutationSignatureRaw: mutationPair.signatureRaw,
					frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
					verificationOptions: {
						prepared: historical.prepared,
						preparedRaw,
						preparedSignatureRaw,
						ready: historical.ready,
						readyRaw,
						readySignatureRaw,
						nowMs: lifecycleNowMs
					},
					owner: rootOwner
				})
			}
			restoreTerminalRuntimeRebindPublicPairForOwner({
				paths,
				adoptedRaw,
				adoptedSignatureRaw,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
				verificationOptions: {
					prepared: historical.prepared,
					preparedRaw,
					preparedSignatureRaw,
					ready: historical.ready,
					readyRaw,
					readySignatureRaw,
					mutationRaw: mutationPair?.body,
					mutationSignatureRaw: mutationPair?.signatureRaw,
					heartbeatRaw,
					heartbeatSignatureRaw,
					nowMs: Date.parse(historical.adopted.adoptedAt)
				},
				owner: rootOwner
			})
			result = {
				body: adoptedRaw,
				signatureRaw: adoptedSignatureRaw,
				value: historical.adopted
			}
		} else {
			result = adoptRuntimeRebindForOwner({
				preparedRaw,
				preparedSignatureRaw,
				readyRaw,
				readySignatureRaw,
				mutationRaw: mutationPair?.body,
				mutationSignatureRaw: mutationPair?.signatureRaw,
				runtimeRaw,
				releaseRaw: context.release,
				releaseSignatureRaw: context.releaseSignature,
				heartbeatRaw: readFileSync(paths.heartbeat),
				heartbeatSignatureRaw: readFileSync(paths.heartbeatSignature),
				imageAdoptionRaw: context.imageAdoption,
				expectedProcessStartedAt: options['expected-process-started-at'],
				backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
				frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
				frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
				releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
				privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
				owner: rootOwner
			})
		}
		const publicUrl = `https://winwidget.ru/.well-known/winwidget/identity-avatar-client/${options.revision}/runtime-rebind/generation-${String(generation).padStart(6, '0')}/adopted-v1.json`
		await fetchStableFrontendArtifact({
			url: publicUrl,
			revision: options.revision,
			expectedBody: result.body,
			expectedSignature: result.signatureRaw,
			validate: (body, signatureRaw) =>
				verifyRuntimeRebindAdopted(
					body,
					signatureRaw,
					FRONTEND_SIGNING_PUBLIC_KEY
				)
		})
		process.stdout.write(
			`${sha256(result.body)}\t${sha256(result.signatureRaw)}\n`
		)
		return
	}
	if (command === 'create-image-adoption') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'image-adoption',
						'live-image-id',
						'release',
						'release-signature',
						'repository-root',
						'revision'
					].sort()
				)
		) {
			fail('Signed image-adoption creation options are invalid')
		}
		const proof = createImageAdoptionProofForOwner({
			clientRevision: options.revision,
			imageAdoptionRaw: readBoundedRegularFile(
				options['image-adoption'],
				MAX_BODY_BYTES,
				'Image adoption journal'
			),
			liveContainerImageId: options['live-image-id'],
			releaseRaw: readBoundedRegularFile(
				options.release,
				MAX_BODY_BYTES,
				'Release evidence'
			),
			releaseSignatureRaw: readBoundedRegularFile(
				options['release-signature'],
				1024,
				'Release evidence signature'
			),
			repositoryRoot: options['repository-root'],
			frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
			owner: rootOwner
		})
		process.stdout.write(
			`${sha256(proof.body)}\t${sha256(proof.signatureRaw)}\n`
		)
		return
	}
	if (command === 'stage') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'discovery',
						'discovery-signature',
						'image-adoption',
						'image-proof',
						'image-proof-signature',
						'mode',
						'release',
						'release-signature',
						'runtime'
					].sort()
				)
		) {
			fail('Frontend runtime rebind stage options are invalid')
		}
		const result = prepareRuntimeRebindForOwner({
			discoveryRaw: readBoundedRegularFile(
				options.discovery,
				MAX_BODY_BYTES,
				'Runtime stability discovery'
			),
			discoverySignatureRaw: readBoundedRegularFile(
				options['discovery-signature'],
				1024,
				'Runtime stability discovery signature'
			),
			runtimeRaw: readBoundedRegularFile(
				options.runtime,
				MAX_BODY_BYTES,
				'Frontend runtime evidence'
			),
			releaseRaw: readBoundedRegularFile(
				options.release,
				MAX_BODY_BYTES,
				'Frontend release evidence'
			),
			releaseSignatureRaw: readBoundedRegularFile(
				options['release-signature'],
				1024,
				'Frontend release signature'
			),
			imageAdoptionRaw: readBoundedRegularFile(
				options['image-adoption'],
				MAX_BODY_BYTES,
				'Frontend image adoption journal'
			),
			imageProofRaw: readBoundedRegularFile(
				options['image-proof'],
				MAX_BODY_BYTES,
				'Frontend signed image proof'
			),
			imageProofSignatureRaw: readBoundedRegularFile(
				options['image-proof-signature'],
				1024,
				'Frontend signed image proof signature'
			),
			rebindMode: options.mode,
			receiptRaw: readBoundedRegularFile(
				CLIENT_SWITCH_RECEIPT_PATH,
				MAX_BODY_BYTES,
				'Client switch receipt'
			),
			backendPublicKeyRaw: readBoundedRegularFile(
				BACKEND_SIGNING_PUBLIC_KEY,
				16 * 1024,
				'Backend signing public key'
			),
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
			privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
			owner: rootOwner
		})
		process.stdout.write(
			`${result.value.generation}\t${sha256(result.body)}\t${sha256(result.signatureRaw)}\n`
		)
		return
	}
	if (command === 'archive-ready') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'prepared',
						'prepared-signature',
						'ready',
						'ready-signature'
					].sort()
				)
		) {
			fail('Frontend runtime rebind READY archive options are invalid')
		}
		const result = archiveAndValidateReadyForOwner({
			preparedRaw: readBoundedRegularFile(
				options.prepared,
				MAX_BODY_BYTES,
				'Frontend PREPARED'
			),
			preparedSignatureRaw: readBoundedRegularFile(
				options['prepared-signature'],
				1024,
				'Frontend PREPARED signature'
			),
			readyRaw: readBoundedRegularFile(
				options.ready,
				MAX_BODY_BYTES,
				'Backend READY'
			),
			readySignatureRaw: readBoundedRegularFile(
				options['ready-signature'],
				1024,
				'Backend READY signature'
			),
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
			privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
			owner: rootOwner
		})
		process.stdout.write(
			`${result.ready.generation}\t${result.ready.rebindMode}\t${result.ready.previousFrontendImageId}\t${result.ready.previousClientProcessStartedAt}\t${sha256(readFileSync(result.paths.ready))}\n`
		)
		return
	}
	if (command === 'adopt') {
		if (
			typeof process.getuid !== 'function' ||
			process.getuid() !== 0 ||
			JSON.stringify(Object.keys(options).sort()) !==
				JSON.stringify(
					[
						'expected-process-started-at',
						'generation',
						'image-adoption',
						'release',
						'release-signature',
						'revision',
						'runtime'
					].sort()
				)
		) {
			fail('Frontend runtime rebind ADOPT options are invalid')
		}
		const generation = Number(options.generation)
		const paths = runtimeRebindPaths(
			options.revision,
			generation,
			CLIENT_RELEASE_EVIDENCE_ROOT,
			RUNTIME_REBIND_PRIVATE_ROOT
		)
		const result = adoptRuntimeRebindForOwner({
			preparedRaw: readFileSync(paths.prepared),
			preparedSignatureRaw: readFileSync(paths.preparedSignature),
			readyRaw: readFileSync(paths.ready),
			readySignatureRaw: readFileSync(paths.readySignature),
			mutationRaw: existsSync(paths.mutationStartArchive)
				? readFileSync(paths.mutationStartArchive)
				: undefined,
			mutationSignatureRaw: existsSync(paths.mutationStartSignatureArchive)
				? readFileSync(paths.mutationStartSignatureArchive)
				: undefined,
			runtimeRaw: readBoundedRegularFile(
				options.runtime,
				MAX_BODY_BYTES,
				'Frontend runtime evidence'
			),
			releaseRaw: readBoundedRegularFile(
				options.release,
				MAX_BODY_BYTES,
				'Frontend release evidence'
			),
			releaseSignatureRaw: readBoundedRegularFile(
				options['release-signature'],
				1024,
				'Frontend release signature'
			),
			heartbeatRaw: readFileSync(paths.heartbeat),
			heartbeatSignatureRaw: readFileSync(paths.heartbeatSignature),
			imageAdoptionRaw: readBoundedRegularFile(
				options['image-adoption'],
				MAX_BODY_BYTES,
				'Frontend image adoption journal'
			),
			expectedProcessStartedAt: options['expected-process-started-at'],
			backendPublicKeyPath: BACKEND_SIGNING_PUBLIC_KEY,
			frontendPrivateKeyPath: FRONTEND_SIGNING_PRIVATE_KEY,
			frontendPublicKeyPath: FRONTEND_SIGNING_PUBLIC_KEY,
			releaseRoot: CLIENT_RELEASE_EVIDENCE_ROOT,
			privateRoot: RUNTIME_REBIND_PRIVATE_ROOT,
			owner: rootOwner
		})
		process.stdout.write(
			`${sha256(result.body)}\t${sha256(result.signatureRaw)}\n`
		)
		return
	}
	if (command === 'validate-current') {
		const body = readBoundedRegularFile(
			options.body,
			MAX_BODY_BYTES,
			'Runtime stability current body'
		)
		const signatureRaw = readBoundedRegularFile(
			options.signature,
			1024,
			'Runtime stability current signature'
		)
		const value = verifyRuntimeStabilityCurrent(
			body,
			signatureRaw,
			options['backend-public-key'],
			{ expectedClientRevision: options.revision }
		)
		process.stdout.write(
			`${value.currentRuntimeRevision}\t${value.runtimeStabilityGeneration}\t${value.runtimeStabilityEvidenceSha256}\n`
		)
		return
	}
	if (command === 'verify-image-adoption') {
		if (
			JSON.stringify(Object.keys(options).sort()) !==
			JSON.stringify(
				['body', 'public-key', 'revision', 'signature'].sort()
			)
		) {
			fail('Signed image-adoption verification options are invalid')
		}
		const body = readBoundedRegularFile(
			options.body,
			MAX_BODY_BYTES,
			'Signed image-adoption body'
		)
		const signatureRaw = readBoundedRegularFile(
			options.signature,
			1024,
			'Signed image-adoption signature'
		)
		const value = verifyImageAdoptionProof(
			body,
			signatureRaw,
			options['public-key'],
			{ expectedClientRevision: options.revision }
		)
		process.stdout.write(`${value.clientImageId}\n`)
		return
	}
	if (command === 'local-state') {
		const state = runtimeRebindLocalState({
			clientRevision: options.revision,
			releaseRoot: options['release-root'] || CLIENT_RELEASE_EVIDENCE_ROOT
		})
		process.stdout.write(`${state.state}\t${state.generation}\n`)
		return
	}
	fail('Unknown identity avatar frontend runtime rebind command')
}

if (
	resolve(process.argv[1] || '') ===
	resolve(new URL(import.meta.url).pathname)
) {
	main().catch(error => {
		console.error(
			error instanceof Error
				? error.message
				: 'Frontend runtime rebind lifecycle failed'
		)
		process.exitCode = 1
	})
}
