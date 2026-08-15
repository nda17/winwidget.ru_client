#!/usr/bin/env node

import { generateKeyPairSync, sign } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
	chmodSync,
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import {
	createClientSwitchReceiptForOwner,
	sha256
} from './identity-avatar-client-release-evidence.mjs'
import { buildHeartbeat } from './identity-avatar-client-log-soak.mjs'
import {
	IMAGE_ADOPTION_PROOF_KEYS,
	RUNTIME_REBIND_ADOPTED_KEYS,
	RUNTIME_REBIND_MUTATION_START_KEYS,
	RUNTIME_REBIND_PREPARED_KEYS,
	RUNTIME_REBIND_READY_KEYS,
	RUNTIME_STABILITY_CURRENT_KEYS,
	adoptRuntimeRebindForOwner,
	archiveAndValidateReadyForOwner,
	assertRuntimeRebindReadyRefetch,
	classifyRuntimeRebindApplyBoundary,
	createImageAdoptionProofForOwner,
	createRuntimeRebindMutationStartForOwner,
	prepareRuntimeRebindForOwner,
	restoreTerminalRuntimeRebindMutationStartPublicPairForOwner,
	restoreTerminalRuntimeRebindPublicPairForOwner,
	runtimeRebindLocalState,
	validateRuntimeRebindAdoptedRaw,
	validateRuntimeRebindApplyEvidenceForOwner,
	validateRuntimeRebindMutationStartRaw,
	validateRuntimeRebindPreparedRaw,
	validateRuntimeRebindReadyRaw,
	validateRuntimeStabilityCurrentRaw,
	validateTerminalRuntimeRebindDiscovery,
	verifyRuntimeRebindAdopted,
	verifyHistoricalRuntimeRebindAdopted,
	verifyImageAdoptionProof,
	verifyRuntimeRebindPrepared,
	verifyRuntimeRebindReady,
	verifyRuntimeRebindMutationStart,
	verifyRuntimeStabilityCurrent,
	verifyCleanupFrontendBindingForOwner
} from './identity-avatar-client-runtime-rebind.mjs'
import { CLIENT_RETARGET_CRITICAL_FILES } from './identity-avatar-client-soak-retarget.mjs'

const root = realpathSync(
	mkdtempSync(join(tmpdir(), 'identity-avatar-client-runtime-rebind-'))
)
const owner = { uid: process.getuid(), gid: process.getgid() }
const ownerRevision = 'a'.repeat(40)
const runtimeRevision = 'b'.repeat(40)
const clientRevision = 'c'.repeat(40)
const databaseId = '123e4567-e89b-12d3-a456-426614174000'
const oldProcess = '2026-08-15T00:00:00.000Z'
const newProcess = '2026-08-15T00:10:00.000Z'
const preparedAt = '2026-08-15T00:05:00.000Z'
const readyAt = preparedAt
const mutationStartedAt = '2026-08-15T00:05:01.000Z'
const heartbeatEndedAt = '2026-08-15T00:11:00.000Z'
const adoptedAt = '2026-08-15T00:12:00.000Z'

const expectFailure = (label, callback) => {
	let failed = false
	try {
		callback()
	} catch {
		failed = true
	}
	if (!failed) throw new Error(`${label} negative fixture was accepted`)
}

const writePair = (name, pair) => {
	const privatePath = join(root, `${name}.private.pem`)
	const publicPath = join(root, `${name}.public.pem`)
	writeFileSync(
		privatePath,
		pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
		{ mode: 0o600 }
	)
	writeFileSync(
		publicPath,
		pair.publicKey.export({ type: 'spki', format: 'pem' }),
		{ mode: 0o600 }
	)
	chmodSync(privatePath, 0o600)
	chmodSync(publicPath, 0o600)
	return { privatePath, publicPath }
}

const signFile = (raw, privateKey) =>
	Buffer.from(`${sign(null, raw, privateKey).toString('base64')}\n`)

const createLifecycleRepository = repositoryRoot => {
	mkdirSync(repositoryRoot, { recursive: true })
	for (const path of CLIENT_RETARGET_CRITICAL_FILES) {
		const absolutePath = join(repositoryRoot, path)
		mkdirSync(dirname(absolutePath), { recursive: true })
		writeFileSync(absolutePath, `frozen fixture: ${path}\n`)
	}
	execFileSync('git', [
		'-C',
		repositoryRoot,
		'init',
		'--quiet',
		'--object-format=sha1'
	])
	execFileSync('git', ['-C', repositoryRoot, 'add', '--all'])
	execFileSync('git', [
		'-C',
		repositoryRoot,
		'-c',
		'user.name=Identity Avatar Test',
		'-c',
		'user.email=identity-avatar@example.invalid',
		'commit',
		'--quiet',
		'-m',
		'fixture'
	])
	return execFileSync('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], {
		encoding: 'utf8'
	}).trim()
}

try {
	const frontendPair = generateKeyPairSync('ed25519')
	const backendPair = generateKeyPairSync('ed25519')
	const frontend = writePair('frontend', frontendPair)
	const backend = writePair('backend', backendPair)
	const releaseRoot = join(root, 'release')
	const privateRoot = join(root, 'private')
	const receiptPath = join(root, 'receipt.json')
	mkdirSync(releaseRoot, { mode: 0o700 })
	mkdirSync(privateRoot, { mode: 0o700 })

	const readyForSwitch = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-ready',
		serverRevision: ownerRevision,
		ownershipPhase: 'ACTIVE',
		identityDatabaseId: databaseId,
		writerFenceEvidenceSha256: '1'.repeat(64),
		storagePolicyEvidenceSha256: '2'.repeat(64),
		uploadsSnapshotEvidenceSha256: '3'.repeat(64),
		inventoryManifestSha256: '4'.repeat(64),
		migrationManifestSha256: '5'.repeat(64),
		statusManifestSha256: '6'.repeat(64),
		revocationEvidenceSha256: '7'.repeat(64),
		authenticatedSmokeEvidenceSha256: '8'.repeat(64),
		referenceZeroEvidenceSha256: '9'.repeat(64),
		legacyReferenceMatches: 0,
		legacyFileWriterFenced: true,
		ownershipActivatedAt: '2026-08-14T23:57:00.000Z',
		generatedAt: '2026-08-14T23:58:00.000Z',
		expiresAt: '2026-08-15T01:58:00.000Z'
	}
	const switchBody = Buffer.from(JSON.stringify(readyForSwitch))
	const switchSignature = signFile(switchBody, backendPair.privateKey)
	createClientSwitchReceiptForOwner({
		receiptPath,
		archiveAttestationPath: join(root, 'ready.json'),
		archiveSignaturePath: join(root, 'ready.json.sig'),
		clientReadyRaw: switchBody,
		clientReadySignatureRaw: switchSignature,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		clientRevision,
		releaseEvidenceSha256: 'd'.repeat(64),
		expectedBackendServerRevision: ownerRevision,
		expectedClientReadySha256: sha256(switchBody),
		expectedClientReadySignatureSha256: sha256(switchSignature),
		clientProcessStartedAt: oldProcess,
		soakPinnedAt: '2026-08-15T00:01:00.000Z',
		expectedUid: owner.uid,
		expectedGid: owner.gid
	})

	const releaseValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-release',
		clientRevision,
		nextBuildId: 'test-build',
		scanRoots: ['.next/server', '.next/standalone', '.next/static'],
		fileCount: 3,
		totalBytes: 300,
		treeSha256: 'e'.repeat(64),
		checks: [
			'full-next-server-tree-scanned',
			'full-next-standalone-tree-scanned',
			'full-next-static-tree-scanned',
			'legacy-api-v1-files-absent',
			'legacy-uploads-absent',
			'migration-credential-identifiers-absent',
			'identity-profile-avatar-api-present',
			'identity-admin-avatar-api-present'
		],
		fullManifestSha256: 'f'.repeat(64),
		generatedAt: '2026-08-14T23:50:00.000Z'
	}
	const releaseRaw = Buffer.from(JSON.stringify(releaseValue))
	const releaseSignatureRaw = signFile(releaseRaw, frontendPair.privateKey)
	const runtimeRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-runtime',
			clientRevision,
			processStartedAt: oldProcess,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw)
		})
	)
	const imageId = `sha256:${'1'.repeat(64)}`
	const imageAdoptionRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-image-adoption',
			clientRevision,
			imageId,
			fullManifestSha256: releaseValue.fullManifestSha256,
			releaseEvidenceSha256: sha256(releaseRaw)
		})
	)
	const imageProofValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-image-adoption-v1',
		clientRevision,
		clientImageId: imageId,
		releaseEvidenceSha256: sha256(releaseRaw),
		releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
		releaseTreeSha256: releaseValue.treeSha256,
		releaseFullManifestSha256: releaseValue.fullManifestSha256,
		candidateTreeSha256: 'a'.repeat(64),
		clientLifecycleContractSha256: 'b'.repeat(64),
		adoptedAt: '2026-08-15T00:03:00.000Z'
	}
	const imageProofRaw = Buffer.from(JSON.stringify(imageProofValue))
	const imageProofSignatureRaw = signFile(
		imageProofRaw,
		frontendPair.privateKey
	)

	const lifecycleRepository = join(root, 'lifecycle-repository')
	const proofRevision = createLifecycleRepository(lifecycleRepository)
	const proofReleaseValue = {
		...releaseValue,
		clientRevision: proofRevision
	}
	const proofReleaseRaw = Buffer.from(JSON.stringify(proofReleaseValue))
	const proofReleaseSignatureRaw = signFile(
		proofReleaseRaw,
		frontendPair.privateKey
	)
	const proofImageId = `sha256:${'7'.repeat(64)}`
	const proofImageAdoptionRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-image-adoption',
			clientRevision: proofRevision,
			imageId: proofImageId,
			fullManifestSha256: proofReleaseValue.fullManifestSha256,
			releaseEvidenceSha256: sha256(proofReleaseRaw)
		})
	)
	const proofReleaseRoot = join(root, 'proof-release')
	const proofPrivateRoot = join(root, 'proof-private')
	mkdirSync(proofReleaseRoot, { mode: 0o755 })
	mkdirSync(proofPrivateRoot, { mode: 0o700 })
	const imageProof = createImageAdoptionProofForOwner({
		clientRevision: proofRevision,
		imageAdoptionRaw: proofImageAdoptionRaw,
		liveContainerImageId: proofImageId,
		releaseRaw: proofReleaseRaw,
		releaseSignatureRaw: proofReleaseSignatureRaw,
		repositoryRoot: lifecycleRepository,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: proofReleaseRoot,
		privateRoot: proofPrivateRoot,
		owner,
		adoptedAt: '2026-08-15T00:03:00.000Z'
	})
	if (
		JSON.stringify(Object.keys(imageProof.value)) !==
			JSON.stringify(IMAGE_ADOPTION_PROOF_KEYS) ||
		imageProof.value.clientImageId !== proofImageId ||
		verifyImageAdoptionProof(
			imageProof.body,
			imageProof.signatureRaw,
			frontend.publicPath,
			{ expectedClientRevision: proofRevision }
		).clientRevision !== proofRevision
	) {
		throw new Error('Signed image-adoption proof did not bind the image')
	}
	const imageProofRetry = createImageAdoptionProofForOwner({
		clientRevision: proofRevision,
		imageAdoptionRaw: proofImageAdoptionRaw,
		liveContainerImageId: proofImageId,
		releaseRaw: proofReleaseRaw,
		releaseSignatureRaw: proofReleaseSignatureRaw,
		repositoryRoot: lifecycleRepository,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: proofReleaseRoot,
		privateRoot: proofPrivateRoot,
		owner,
		adoptedAt: '2026-08-15T00:04:00.000Z'
	})
	if (
		!imageProofRetry.body.equals(imageProof.body) ||
		!imageProofRetry.signatureRaw.equals(imageProof.signatureRaw)
	) {
		throw new Error('Signed image-adoption retry was not idempotent')
	}
	rmSync(imageProof.bodyPath)
	createImageAdoptionProofForOwner({
		clientRevision: proofRevision,
		imageAdoptionRaw: proofImageAdoptionRaw,
		liveContainerImageId: proofImageId,
		releaseRaw: proofReleaseRaw,
		releaseSignatureRaw: proofReleaseSignatureRaw,
		repositoryRoot: lifecycleRepository,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: proofReleaseRoot,
		privateRoot: proofPrivateRoot,
		owner,
		adoptedAt: '2026-08-15T00:04:00.000Z'
	})
	if (!existsSync(imageProof.bodyPath)) {
		throw new Error('Image-adoption signature-only crash was not repaired')
	}
	rmSync(imageProof.signaturePath)
	createImageAdoptionProofForOwner({
		clientRevision: proofRevision,
		imageAdoptionRaw: proofImageAdoptionRaw,
		liveContainerImageId: proofImageId,
		releaseRaw: proofReleaseRaw,
		releaseSignatureRaw: proofReleaseSignatureRaw,
		repositoryRoot: lifecycleRepository,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: proofReleaseRoot,
		privateRoot: proofPrivateRoot,
		owner,
		adoptedAt: '2026-08-15T00:04:00.000Z'
	})
	if (!existsSync(imageProof.signaturePath)) {
		throw new Error('Image-adoption body-only crash was not repaired')
	}
	expectFailure('image proof wrong live image', () =>
		createImageAdoptionProofForOwner({
			clientRevision: proofRevision,
			imageAdoptionRaw: proofImageAdoptionRaw,
			liveContainerImageId: `sha256:${'8'.repeat(64)}`,
			releaseRaw: proofReleaseRaw,
			releaseSignatureRaw: proofReleaseSignatureRaw,
			repositoryRoot: lifecycleRepository,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot: proofReleaseRoot,
			privateRoot: proofPrivateRoot,
			owner
		})
	)
	const wrongReleaseSignature = Buffer.from(proofReleaseSignatureRaw)
	wrongReleaseSignature[0] = wrongReleaseSignature[0] === 65 ? 66 : 65
	expectFailure('image proof wrong release signature', () =>
		createImageAdoptionProofForOwner({
			clientRevision: proofRevision,
			imageAdoptionRaw: proofImageAdoptionRaw,
			liveContainerImageId: proofImageId,
			releaseRaw: proofReleaseRaw,
			releaseSignatureRaw: wrongReleaseSignature,
			repositoryRoot: lifecycleRepository,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot: proofReleaseRoot,
			privateRoot: proofPrivateRoot,
			owner
		})
	)
	expectFailure('image proof reused for another revision', () =>
		verifyImageAdoptionProof(
			imageProof.body,
			imageProof.signatureRaw,
			frontend.publicPath,
			{ expectedClientRevision: 'f'.repeat(40) }
		)
	)

	const discoveryValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-runtime-stability-current-v1',
		ownershipRevision: ownerRevision,
		currentRuntimeRevision: runtimeRevision,
		initialClientRevision: clientRevision,
		currentClientRevision: clientRevision,
		identityDatabaseId: databaseId,
		currentClientBindingEvidenceSha256: '2'.repeat(64),
		runtimeStabilityGeneration: 0,
		runtimeStabilityEvidenceSha256: '3'.repeat(64),
		runtimeStabilityLedgerGeneration: 0,
		runtimeStabilityLedgerTailState: 'applied',
		runtimeStabilityLedgerTailEvidenceSha256: '3'.repeat(64),
		runtimeRetargetEvidenceSha256: 'pending',
		clientRetargetEvidenceSha256: 'pending',
		frontendBinding: {
			bindingKind: 'initial-client-switch',
			evidenceSha256: sha256(imageProofRaw),
			evidenceSignatureSha256: sha256(imageProofSignatureRaw),
			clientRevision,
			imageId,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
			releaseTreeSha256: releaseValue.treeSha256,
			releaseFullManifestSha256: releaseValue.fullManifestSha256,
			processStartedAt: oldProcess
		},
		publishedAt: '2026-08-15T00:04:00.000Z'
	}
	const discoveryRaw = Buffer.from(JSON.stringify(discoveryValue))
	const discoverySignatureRaw = signFile(
		discoveryRaw,
		backendPair.privateKey
	)
	if (
		JSON.stringify(Object.keys(discoveryValue)) !==
		JSON.stringify(RUNTIME_STABILITY_CURRENT_KEYS)
	) {
		throw new Error('Runtime stability current fixture order drifted')
	}
	verifyRuntimeStabilityCurrent(
		discoveryRaw,
		discoverySignatureRaw,
		backend.publicPath,
		{
			expectedClientRevision: clientRevision,
			nowMs: Date.parse(preparedAt)
		}
	)
	for (const [label, invalidDiscovery] of [
		[
			'CURRENT unknown ledger state',
			{ ...discoveryValue, runtimeStabilityLedgerTailState: 'unknown' }
		],
		[
			'CURRENT adopted ledger generation gap',
			{ ...discoveryValue, runtimeStabilityLedgerGeneration: 1 }
		],
		[
			'CURRENT adopted ledger tail mismatch',
			{
				...discoveryValue,
				runtimeStabilityLedgerTailEvidenceSha256: '4'.repeat(64)
			}
		],
		[
			'CURRENT aborted ledger generation mismatch',
			{
				...discoveryValue,
				runtimeStabilityLedgerTailState: 'aborted',
				runtimeStabilityLedgerGeneration: 0,
				runtimeStabilityLedgerTailEvidenceSha256: '4'.repeat(64)
			}
		],
		[
			'CURRENT aborted ledger reuses effective terminal SHA',
			{
				...discoveryValue,
				runtimeStabilityLedgerTailState: 'aborted',
				runtimeStabilityLedgerGeneration: 1
			}
		]
	]) {
		expectFailure(label, () =>
			validateRuntimeStabilityCurrentRaw(
				Buffer.from(JSON.stringify(invalidDiscovery)),
				{
					expectedClientRevision: clientRevision,
					nowMs: Date.parse(preparedAt)
				}
			)
		)
	}

	const prepared = prepareRuntimeRebindForOwner({
		discoveryRaw,
		discoverySignatureRaw,
		runtimeRaw,
		releaseRaw,
		releaseSignatureRaw,
		imageAdoptionRaw,
		imageProofRaw,
		imageProofSignatureRaw,
		rebindMode: 'planned-restart',
		receiptRaw: readFileSync(receiptPath),
		backendPublicKeyRaw: readFileSync(backend.publicPath),
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		preparedAt,
		owner
	})
	if (
		JSON.stringify(Object.keys(prepared.value)) !==
			JSON.stringify(RUNTIME_REBIND_PREPARED_KEYS) ||
		prepared.value.generation !== 1 ||
		prepared.value.clientImageId !== imageId ||
		prepared.value.observedClientProcessStartedAt !== oldProcess ||
		runtimeRebindLocalState({ clientRevision, releaseRoot }).state !==
			'prepared'
	) {
		throw new Error(
			'Frontend PREPARED lifecycle did not freeze generation 1'
		)
	}
	const prepareGenerationFixture = (fixtureDiscovery, suffix) => {
		const fixtureDiscoveryRaw = Buffer.from(
			JSON.stringify(fixtureDiscovery)
		)
		const fixtureDiscoverySignatureRaw = signFile(
			fixtureDiscoveryRaw,
			backendPair.privateKey
		)
		const fixtureReleaseRoot = join(root, `release-${suffix}`)
		const fixturePrivateRoot = join(root, `private-${suffix}`)
		mkdirSync(fixtureReleaseRoot, { mode: 0o755 })
		mkdirSync(fixturePrivateRoot, { mode: 0o700 })
		return prepareRuntimeRebindForOwner({
			discoveryRaw: fixtureDiscoveryRaw,
			discoverySignatureRaw: fixtureDiscoverySignatureRaw,
			runtimeRaw,
			releaseRaw,
			releaseSignatureRaw,
			imageAdoptionRaw,
			imageProofRaw,
			imageProofSignatureRaw,
			rebindMode: 'planned-restart',
			receiptRaw: readFileSync(receiptPath),
			backendPublicKeyRaw: readFileSync(backend.publicPath),
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot: fixtureReleaseRoot,
			privateRoot: fixturePrivateRoot,
			preparedAt,
			owner
		})
	}
	const postAbortDiscovery = {
		...discoveryValue,
		runtimeStabilityLedgerGeneration: 1,
		runtimeStabilityLedgerTailState: 'aborted',
		runtimeStabilityLedgerTailEvidenceSha256: '4'.repeat(64)
	}
	if (
		prepareGenerationFixture(postAbortDiscovery, 'post-abort').value
			.generation !== 2
	) {
		throw new Error('Post-abort PREPARED did not advance from ledger tail')
	}
	const generation63Discovery = {
		...discoveryValue,
		runtimeStabilityGeneration: 63,
		runtimeStabilityEvidenceSha256: '5'.repeat(64),
		runtimeStabilityLedgerGeneration: 63,
		runtimeStabilityLedgerTailState: 'adopted',
		runtimeStabilityLedgerTailEvidenceSha256: '5'.repeat(64)
	}
	if (
		prepareGenerationFixture(generation63Discovery, 'generation-64').value
			.generation !== 64
	) {
		throw new Error('Generation 64 PREPARED boundary was rejected')
	}
	const generation64Discovery = {
		...generation63Discovery,
		runtimeStabilityGeneration: 64,
		runtimeStabilityEvidenceSha256: '6'.repeat(64),
		runtimeStabilityLedgerGeneration: 64,
		runtimeStabilityLedgerTailEvidenceSha256: '6'.repeat(64)
	}
	expectFailure('generation 65 after terminal generation 64', () =>
		prepareGenerationFixture(
			generation64Discovery,
			'generation-65-terminal'
		)
	)
	const abortedGeneration64Discovery = {
		...generation63Discovery,
		runtimeStabilityLedgerGeneration: 64,
		runtimeStabilityLedgerTailState: 'aborted',
		runtimeStabilityLedgerTailEvidenceSha256: '7'.repeat(64)
	}
	expectFailure('generation 65 after aborted ledger generation 64', () =>
		prepareGenerationFixture(
			abortedGeneration64Discovery,
			'generation-65-aborted'
		)
	)
	const retryPrepared = nextPreparedAt =>
		prepareRuntimeRebindForOwner({
			discoveryRaw,
			discoverySignatureRaw,
			runtimeRaw,
			releaseRaw,
			releaseSignatureRaw,
			imageAdoptionRaw,
			imageProofRaw,
			imageProofSignatureRaw,
			rebindMode: 'planned-restart',
			receiptRaw: readFileSync(receiptPath),
			backendPublicKeyRaw: readFileSync(backend.publicPath),
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot,
			privateRoot,
			preparedAt: nextPreparedAt,
			owner
		})
	const preparedRetry = retryPrepared('2026-08-15T00:05:30.000Z')
	if (
		!preparedRetry.body.equals(prepared.body) ||
		!preparedRetry.signatureRaw.equals(prepared.signatureRaw)
	) {
		throw new Error('Frontend PREPARED retry was not idempotent')
	}
	rmSync(prepared.paths.prepared)
	retryPrepared('2026-08-15T00:05:40.000Z')
	if (!existsSync(prepared.paths.prepared)) {
		throw new Error('Frontend PREPARED public body crash was not repaired')
	}
	rmSync(prepared.paths.preparedSignature)
	retryPrepared('2026-08-15T00:05:50.000Z')
	if (!existsSync(prepared.paths.preparedSignature)) {
		throw new Error(
			'Frontend PREPARED public signature crash was not repaired'
		)
	}
	rmSync(prepared.paths.preparedSignatureArchive)
	retryPrepared('2026-08-15T00:05:55.000Z')
	if (!existsSync(prepared.paths.preparedSignatureArchive)) {
		throw new Error(
			'Frontend PREPARED private signature crash was not repaired'
		)
	}

	const readyValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-frontend-runtime-rebind-ready-v1',
		ownershipRevision: ownerRevision,
		currentRuntimeRevision: runtimeRevision,
		initialClientRevision: clientRevision,
		currentClientRevision: clientRevision,
		identityDatabaseId: databaseId,
		currentClientBindingEvidenceSha256:
			discoveryValue.currentClientBindingEvidenceSha256,
		frontendPreparedEvidenceSha256: sha256(prepared.body),
		frontendPreparedEvidenceSignatureSha256: sha256(prepared.signatureRaw),
		previousRuntimeStabilityEvidenceSha256:
			discoveryValue.runtimeStabilityEvidenceSha256,
		generation: 1,
		rebindMode: 'planned-restart',
		previousFrontendImageId: imageId,
		previousFrontendReleaseEvidenceSha256: sha256(releaseRaw),
		previousFrontendReleaseEvidenceSignatureSha256: sha256(
			releaseSignatureRaw
		),
		previousFrontendReleaseTreeSha256: releaseValue.treeSha256,
		previousFrontendReleaseFullManifestSha256:
			releaseValue.fullManifestSha256,
		previousClientProcessStartedAt: oldProcess,
		preparedAt: readyAt,
		expiresAt: '2026-08-15T00:35:00.000Z'
	}
	const readyRaw = Buffer.from(JSON.stringify(readyValue))
	const readySignatureRaw = signFile(readyRaw, backendPair.privateKey)
	if (
		JSON.stringify(Object.keys(readyValue)) !==
		JSON.stringify(RUNTIME_REBIND_READY_KEYS)
	) {
		throw new Error('Backend READY fixture order drifted')
	}
	archiveAndValidateReadyForOwner({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath: backend.publicPath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		owner,
		nowMs: Date.parse(readyAt)
	})
	const mutation = createRuntimeRebindMutationStartForOwner({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		liveImageId: imageId,
		liveProcessStartedAt: oldProcess,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		owner,
		mutationStartedAt
	})
	if (
		JSON.stringify(Object.keys(mutation.value)) !==
			JSON.stringify(RUNTIME_REBIND_MUTATION_START_KEYS) ||
		mutation.value.generation !== 1
	) {
		throw new Error('Frontend mutation-start fixture order drifted')
	}
	assertRuntimeRebindReadyRefetch({
		readyRaw,
		readySignatureRaw,
		refetchedReadyRaw: Buffer.from(readyRaw),
		refetchedReadySignatureRaw: Buffer.from(readySignatureRaw)
	})
	expectFailure('READY body drift after stable mutation publication', () =>
		assertRuntimeRebindReadyRefetch({
			readyRaw,
			readySignatureRaw,
			refetchedReadyRaw: Buffer.from(
				JSON.stringify({ ...readyValue, expiresAt: adoptedAt })
			),
			refetchedReadySignatureRaw: readySignatureRaw
		})
	)
	expectFailure(
		'READY signature drift after stable mutation publication',
		() =>
			assertRuntimeRebindReadyRefetch({
				readyRaw,
				readySignatureRaw,
				refetchedReadyRaw: readyRaw,
				refetchedReadySignatureRaw: Buffer.from(`${'A'.repeat(88)}\n`)
			})
	)
	const mutationValidationOptions = {
		prepared: prepared.value,
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		ready: readyValue,
		readyRaw,
		readySignatureRaw,
		nowMs: Date.parse(adoptedAt)
	}
	const wrongMutationSignature = Buffer.from(mutation.signatureRaw)
	wrongMutationSignature[0] = wrongMutationSignature[0] === 65 ? 66 : 65
	expectFailure('wrong mutation-start signature', () =>
		verifyRuntimeRebindMutationStart(
			mutation.body,
			wrongMutationSignature,
			frontend.publicPath,
			mutationValidationOptions
		)
	)
	for (const [label, invalidMutationStartedAt] of [
		['mutation-start at READY timestamp', readyAt],
		['mutation-start after READY expiry', '2026-08-15T00:35:01.000Z']
	]) {
		expectFailure(label, () =>
			validateRuntimeRebindMutationStartRaw(
				Buffer.from(
					JSON.stringify({
						...mutation.value,
						mutationStartedAt: invalidMutationStartedAt
					})
				),
				mutationValidationOptions
			)
		)
	}
	rmSync(mutation.paths.mutationStart)
	const mutationBodyCrashRetry = createRuntimeRebindMutationStartForOwner({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		liveImageId: imageId,
		liveProcessStartedAt: oldProcess,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		owner,
		mutationStartedAt: '2026-08-15T00:05:02.000Z'
	})
	if (!mutationBodyCrashRetry.body.equals(mutation.body)) {
		throw new Error('Mutation-start public body crash changed evidence')
	}
	rmSync(mutation.paths.mutationStartSignature)
	createRuntimeRebindMutationStartForOwner({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		liveImageId: imageId,
		liveProcessStartedAt: oldProcess,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		owner,
		mutationStartedAt: '2026-08-15T00:05:03.000Z'
	})
	if (!existsSync(mutation.paths.mutationStartSignature)) {
		throw new Error(
			'Mutation-start public signature crash was not repaired'
		)
	}
	rmSync(mutation.paths.mutationStartSignatureArchive)
	createRuntimeRebindMutationStartForOwner({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		liveImageId: imageId,
		liveProcessStartedAt: oldProcess,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		owner,
		mutationStartedAt: '2026-08-15T00:05:04.000Z'
	})
	if (!existsSync(mutation.paths.mutationStartSignatureArchive)) {
		throw new Error(
			'Mutation-start private signature crash was not repaired'
		)
	}

	const logConfigurationSha = '4'.repeat(64)
	const heartbeatRaw = buildHeartbeat({
		revision: clientRevision,
		releaseSha: sha256(releaseRaw),
		processStartedAt: newProcess,
		logConfigurationSha,
		sequence: 1,
		initialAnchorSha: sha256(readyRaw),
		windowStartedAt: newProcess,
		windowEndedAt: heartbeatEndedAt,
		logWindow: {
			slices: [],
			cursors: [],
			records: [
				{
					timestamp: '2026-08-15T00:10:30.000Z',
					host: 'winwidget.ru',
					pathClass: 'soak-probe',
					method: 'GET',
					status: 204
				}
			]
		}
	})
	const heartbeatSignatureRaw = signFile(
		heartbeatRaw,
		frontendPair.privateKey
	)
	const newRuntimeRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-runtime',
			clientRevision,
			processStartedAt: newProcess,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw)
		})
	)
	const adopted = adoptRuntimeRebindForOwner({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		mutationRaw: mutation.body,
		mutationSignatureRaw: mutation.signatureRaw,
		runtimeRaw: newRuntimeRaw,
		releaseRaw,
		releaseSignatureRaw,
		heartbeatRaw,
		heartbeatSignatureRaw,
		imageAdoptionRaw,
		expectedProcessStartedAt: newProcess,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot,
		owner,
		adoptedAt
	})
	if (
		JSON.stringify(Object.keys(adopted.value)) !==
			JSON.stringify(RUNTIME_REBIND_ADOPTED_KEYS) ||
		adopted.value.clientProcessStartedAt !== newProcess ||
		adopted.value.backendReadyEvidenceSha256 !== sha256(readyRaw) ||
		runtimeRebindLocalState({ clientRevision, releaseRoot, privateRoot })
			.state !== 'adopted'
	) {
		throw new Error(
			'Frontend ADOPTED lifecycle did not close generation 1'
		)
	}
	verifyRuntimeRebindAdopted(
		adopted.body,
		adopted.signatureRaw,
		frontend.publicPath,
		{
			prepared: prepared.value,
			preparedRaw: prepared.body,
			preparedSignatureRaw: prepared.signatureRaw,
			ready: readyValue,
			readyRaw,
			readySignatureRaw,
			mutationRaw: mutation.body,
			mutationSignatureRaw: mutation.signatureRaw,
			heartbeatRaw,
			heartbeatSignatureRaw,
			nowMs: Date.parse(adoptedAt)
		}
	)
	expectFailure('expired prepared is not fresh', () =>
		verifyRuntimeRebindPrepared(
			prepared.body,
			prepared.signatureRaw,
			frontend.publicPath,
			{ nowMs: Date.parse('2026-08-15T02:00:00.000Z') }
		)
	)
	const historical = verifyHistoricalRuntimeRebindAdopted({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		mutationRaw: mutation.body,
		mutationSignatureRaw: mutation.signatureRaw,
		adoptedRaw: adopted.body,
		adoptedSignatureRaw: adopted.signatureRaw,
		heartbeatRaw,
		heartbeatSignatureRaw,
		backendPublicKeyPath: backend.publicPath,
		frontendPublicKeyPath: frontend.publicPath
	})
	if (historical.adopted.generation !== 1) {
		throw new Error('Historical ADOPTED verification did not close expiry')
	}
	const lateProcessStartedAt = '2026-08-15T00:34:00.000Z'
	const lateHeartbeatEndedAt = '2026-08-15T00:40:00.000Z'
	const lateAdoptedAt = '2026-08-15T00:41:00.000Z'
	const lateHeartbeatRaw = buildHeartbeat({
		revision: clientRevision,
		releaseSha: sha256(releaseRaw),
		processStartedAt: lateProcessStartedAt,
		logConfigurationSha,
		sequence: 1,
		initialAnchorSha: sha256(readyRaw),
		windowStartedAt: lateProcessStartedAt,
		windowEndedAt: lateHeartbeatEndedAt,
		logWindow: {
			slices: [],
			cursors: [],
			records: [
				{
					timestamp: '2026-08-15T00:36:00.000Z',
					host: 'winwidget.ru',
					pathClass: 'soak-probe',
					method: 'GET',
					status: 204
				}
			]
		}
	})
	const lateHeartbeatSignatureRaw = signFile(
		lateHeartbeatRaw,
		frontendPair.privateKey
	)
	const lateAdoptedValue = {
		...adopted.value,
		clientProcessStartedAt: lateProcessStartedAt,
		firstHeartbeatEvidenceSha256: sha256(lateHeartbeatRaw),
		firstHeartbeatEvidenceSignatureSha256: sha256(
			lateHeartbeatSignatureRaw
		),
		firstHeartbeatWindowStartedAt: lateProcessStartedAt,
		firstHeartbeatWindowEndedAt: lateHeartbeatEndedAt,
		adoptedAt: lateAdoptedAt
	}
	const lateAdoptedRaw = Buffer.from(JSON.stringify(lateAdoptedValue))
	const lateAdoptedSignatureRaw = signFile(
		lateAdoptedRaw,
		frontendPair.privateKey
	)
	const lateHistorical = verifyHistoricalRuntimeRebindAdopted({
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		mutationRaw: mutation.body,
		mutationSignatureRaw: mutation.signatureRaw,
		adoptedRaw: lateAdoptedRaw,
		adoptedSignatureRaw: lateAdoptedSignatureRaw,
		heartbeatRaw: lateHeartbeatRaw,
		heartbeatSignatureRaw: lateHeartbeatSignatureRaw,
		backendPublicKeyPath: backend.publicPath,
		frontendPublicKeyPath: frontend.publicPath
	})
	if (
		lateHistorical.adopted.adoptedAt !== lateAdoptedAt ||
		validateTerminalRuntimeRebindDiscovery({
			discovery: discoveryValue,
			discoveryRaw,
			discoverySignatureRaw,
			prepared: prepared.value,
			preparedRaw: prepared.body,
			adopted: lateAdoptedValue,
			adoptedRaw: lateAdoptedRaw,
			adoptedSignatureRaw: lateAdoptedSignatureRaw,
			nowMs: Date.parse(lateAdoptedAt)
		}) !== 'acknowledgement-pending'
	) {
		throw new Error('Valid post-expiry terminal evidence was rejected')
	}
	expectFailure('planned process starts after READY expiry', () =>
		validateRuntimeRebindAdoptedRaw(
			Buffer.from(
				JSON.stringify({
					...lateAdoptedValue,
					clientProcessStartedAt: '2026-08-15T00:35:00.001Z',
					firstHeartbeatWindowStartedAt: '2026-08-15T00:35:00.001Z'
				})
			),
			{
				prepared: prepared.value,
				preparedRaw: prepared.body,
				preparedSignatureRaw: prepared.signatureRaw,
				ready: readyValue,
				readyRaw,
				readySignatureRaw,
				mutationRaw: mutation.body,
				mutationSignatureRaw: mutation.signatureRaw,
				frontendPublicKeyPath: frontend.publicPath,
				nowMs: Date.parse(lateAdoptedAt)
			}
		)
	)
	const expiryBoundaryReleaseRoot = join(root, 'release-expiry-boundary')
	const expiryBoundaryPrivateRoot = join(root, 'private-expiry-boundary')
	mkdirSync(expiryBoundaryReleaseRoot, { mode: 0o755 })
	mkdirSync(expiryBoundaryPrivateRoot, { mode: 0o700 })
	const expiryBoundaryPrepared = prepareRuntimeRebindForOwner({
		discoveryRaw,
		discoverySignatureRaw,
		runtimeRaw,
		releaseRaw,
		releaseSignatureRaw,
		imageAdoptionRaw,
		imageProofRaw,
		imageProofSignatureRaw,
		rebindMode: 'planned-restart',
		receiptRaw: readFileSync(receiptPath),
		backendPublicKeyRaw: readFileSync(backend.publicPath),
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: expiryBoundaryReleaseRoot,
		privateRoot: expiryBoundaryPrivateRoot,
		preparedAt,
		owner
	})
	archiveAndValidateReadyForOwner({
		preparedRaw: expiryBoundaryPrepared.body,
		preparedSignatureRaw: expiryBoundaryPrepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		backendPublicKeyPath: backend.publicPath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: expiryBoundaryReleaseRoot,
		privateRoot: expiryBoundaryPrivateRoot,
		owner,
		nowMs: Date.parse(readyAt)
	})
	const expiryBoundaryMutationStartedAt = '2026-08-15T00:34:00.000Z'
	const expiryBoundaryProcessStartedAt = '2026-08-15T00:34:50.000Z'
	const expiryBoundaryHealthAt = '2026-08-15T00:36:00.000Z'
	const expiryBoundaryAdoptedAt = '2026-08-15T00:36:30.000Z'
	const expiryBoundaryMutation = createRuntimeRebindMutationStartForOwner({
		preparedRaw: expiryBoundaryPrepared.body,
		preparedSignatureRaw: expiryBoundaryPrepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		liveImageId: imageId,
		liveProcessStartedAt: oldProcess,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: expiryBoundaryReleaseRoot,
		privateRoot: expiryBoundaryPrivateRoot,
		owner,
		mutationStartedAt: expiryBoundaryMutationStartedAt
	})
	const validateExpiryBoundary = () =>
		validateRuntimeRebindApplyEvidenceForOwner({
			paths: expiryBoundaryMutation.paths,
			preparedRaw: expiryBoundaryPrepared.body,
			preparedSignatureRaw: expiryBoundaryPrepared.signatureRaw,
			readyRaw,
			readySignatureRaw,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath,
			owner,
			nowMs: Date.parse(expiryBoundaryHealthAt)
		})
	const expiryBoundaryEvidence = validateExpiryBoundary()
	if (
		expiryBoundaryEvidence.requireFresh !== false ||
		expiryBoundaryEvidence.mutationPair?.publicPairComplete !== true ||
		classifyRuntimeRebindApplyBoundary({
			prepared: expiryBoundaryEvidence.prepared,
			mutation: expiryBoundaryEvidence.mutationPair.value,
			liveProcessStartedAt: expiryBoundaryProcessStartedAt,
			liveContainerGeneration: 1,
			liveContainerRestartCount: 0
		}) !== 'planned-mutation-complete'
	) {
		throw new Error(
			'Post-expiry exact mutation boundary was not resumable'
		)
	}
	const expiryBoundaryHeartbeatRaw = buildHeartbeat({
		revision: clientRevision,
		releaseSha: sha256(releaseRaw),
		processStartedAt: expiryBoundaryProcessStartedAt,
		logConfigurationSha,
		sequence: 1,
		initialAnchorSha: sha256(readyRaw),
		windowStartedAt: expiryBoundaryProcessStartedAt,
		windowEndedAt: expiryBoundaryHealthAt,
		logWindow: {
			slices: [],
			cursors: [],
			records: [
				{
					timestamp: '2026-08-15T00:35:30.000Z',
					host: 'winwidget.ru',
					pathClass: 'soak-probe',
					method: 'GET',
					status: 204
				}
			]
		}
	})
	const expiryBoundaryHeartbeatSignatureRaw = signFile(
		expiryBoundaryHeartbeatRaw,
		frontendPair.privateKey
	)
	const expiryBoundaryRuntimeRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-runtime',
			clientRevision,
			processStartedAt: expiryBoundaryProcessStartedAt,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw)
		})
	)
	const expiryBoundaryAdopted = adoptRuntimeRebindForOwner({
		preparedRaw: expiryBoundaryPrepared.body,
		preparedSignatureRaw: expiryBoundaryPrepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		mutationRaw: expiryBoundaryMutation.body,
		mutationSignatureRaw: expiryBoundaryMutation.signatureRaw,
		runtimeRaw: expiryBoundaryRuntimeRaw,
		releaseRaw,
		releaseSignatureRaw,
		heartbeatRaw: expiryBoundaryHeartbeatRaw,
		heartbeatSignatureRaw: expiryBoundaryHeartbeatSignatureRaw,
		imageAdoptionRaw,
		expectedProcessStartedAt: expiryBoundaryProcessStartedAt,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: expiryBoundaryReleaseRoot,
		privateRoot: expiryBoundaryPrivateRoot,
		owner,
		adoptedAt: expiryBoundaryAdoptedAt
	})
	const expiryBoundaryRetryEvidence = validateExpiryBoundary()
	const expiryBoundaryAdoptedRetry = adoptRuntimeRebindForOwner({
		preparedRaw: expiryBoundaryPrepared.body,
		preparedSignatureRaw: expiryBoundaryPrepared.signatureRaw,
		readyRaw,
		readySignatureRaw,
		mutationRaw: expiryBoundaryMutation.body,
		mutationSignatureRaw: expiryBoundaryMutation.signatureRaw,
		runtimeRaw: expiryBoundaryRuntimeRaw,
		releaseRaw,
		releaseSignatureRaw,
		heartbeatRaw: expiryBoundaryHeartbeatRaw,
		heartbeatSignatureRaw: expiryBoundaryHeartbeatSignatureRaw,
		imageAdoptionRaw,
		expectedProcessStartedAt: expiryBoundaryProcessStartedAt,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot: expiryBoundaryReleaseRoot,
		privateRoot: expiryBoundaryPrivateRoot,
		owner,
		adoptedAt: '2026-08-15T00:37:00.000Z'
	})
	if (
		classifyRuntimeRebindApplyBoundary({
			prepared: expiryBoundaryRetryEvidence.prepared,
			mutation: expiryBoundaryRetryEvidence.mutationPair.value,
			liveProcessStartedAt: expiryBoundaryProcessStartedAt,
			liveContainerGeneration: 1,
			liveContainerRestartCount: 0
		}) !== 'planned-mutation-complete' ||
		!expiryBoundaryAdoptedRetry.body.equals(expiryBoundaryAdopted.body) ||
		!readFileSync(
			expiryBoundaryMutation.paths.mutationStartArchive
		).equals(expiryBoundaryMutation.body)
	) {
		throw new Error('Post-expiry crash retry repeated mutation or ADOPTED')
	}
	const mutationPathFixtures = [
		[
			expiryBoundaryMutation.paths.mutationStartArchive,
			expiryBoundaryMutation.body,
			0o600
		],
		[
			expiryBoundaryMutation.paths.mutationStartSignatureArchive,
			expiryBoundaryMutation.signatureRaw,
			0o600
		],
		[
			expiryBoundaryMutation.paths.mutationStart,
			expiryBoundaryMutation.body,
			0o644
		],
		[
			expiryBoundaryMutation.paths.mutationStartSignature,
			expiryBoundaryMutation.signatureRaw,
			0o644
		]
	]
	const restoreExpiryBoundaryMutation = () => {
		for (const [path, raw, mode] of mutationPathFixtures) {
			writeFileSync(path, raw, { mode })
			chmodSync(path, mode)
		}
	}
	for (const [label, mutate] of [
		[
			'missing mutation pair after READY expiry',
			() => {
				for (const [path] of mutationPathFixtures) rmSync(path)
			}
		],
		[
			'partial public mutation pair after READY expiry',
			() => rmSync(expiryBoundaryMutation.paths.mutationStartSignature)
		],
		[
			'wrong public mutation body after READY expiry',
			() =>
				writeFileSync(
					expiryBoundaryMutation.paths.mutationStart,
					Buffer.from('{}')
				)
		],
		[
			'partial private mutation pair after READY expiry',
			() =>
				rmSync(expiryBoundaryMutation.paths.mutationStartSignatureArchive)
		]
	]) {
		mutate()
		expectFailure(label, validateExpiryBoundary)
		restoreExpiryBoundaryMutation()
	}
	expectFailure('classified target process after READY expiry', () =>
		classifyRuntimeRebindApplyBoundary({
			prepared: expiryBoundaryRetryEvidence.prepared,
			mutation: expiryBoundaryRetryEvidence.mutationPair.value,
			liveProcessStartedAt: '2026-08-15T00:35:00.001Z',
			liveContainerGeneration: 1,
			liveContainerRestartCount: 0
		})
	)
	const wrongAdoptedSignature = Buffer.from(adopted.signatureRaw)
	wrongAdoptedSignature[0] = wrongAdoptedSignature[0] === 65 ? 66 : 65
	expectFailure('terminal adopted signature', () =>
		verifyHistoricalRuntimeRebindAdopted({
			preparedRaw: prepared.body,
			preparedSignatureRaw: prepared.signatureRaw,
			readyRaw,
			readySignatureRaw,
			mutationRaw: mutation.body,
			mutationSignatureRaw: mutation.signatureRaw,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: wrongAdoptedSignature,
			heartbeatRaw,
			heartbeatSignatureRaw,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath
		})
	)
	const terminalVerificationOptions = {
		prepared: prepared.value,
		preparedRaw: prepared.body,
		preparedSignatureRaw: prepared.signatureRaw,
		ready: readyValue,
		readyRaw,
		readySignatureRaw,
		mutationRaw: mutation.body,
		mutationSignatureRaw: mutation.signatureRaw,
		heartbeatRaw,
		heartbeatSignatureRaw,
		nowMs: Date.parse(adoptedAt)
	}
	if (
		validateTerminalRuntimeRebindDiscovery({
			discovery: discoveryValue,
			discoveryRaw,
			discoverySignatureRaw,
			prepared: prepared.value,
			preparedRaw: prepared.body,
			adopted: adopted.value,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: adopted.signatureRaw,
			nowMs: Date.parse(adoptedAt)
		}) !== 'acknowledgement-pending'
	) {
		throw new Error('Terminal discovery pending state was misclassified')
	}
	const acknowledgedDiscovery = {
		...discoveryValue,
		runtimeStabilityGeneration: 1,
		runtimeStabilityEvidenceSha256: '8'.repeat(64),
		runtimeStabilityLedgerGeneration: 1,
		runtimeStabilityLedgerTailState: 'adopted',
		runtimeStabilityLedgerTailEvidenceSha256: '8'.repeat(64),
		frontendBinding: {
			bindingKind: 'frontend-runtime-rebind',
			evidenceSha256: sha256(adopted.body),
			evidenceSignatureSha256: sha256(adopted.signatureRaw),
			clientRevision,
			imageId,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
			releaseTreeSha256: releaseValue.treeSha256,
			releaseFullManifestSha256: releaseValue.fullManifestSha256,
			processStartedAt: newProcess
		},
		publishedAt: adoptedAt
	}
	const acknowledgedDiscoveryRaw = Buffer.from(
		JSON.stringify(acknowledgedDiscovery)
	)
	const acknowledgedDiscoverySignatureRaw = signFile(
		acknowledgedDiscoveryRaw,
		backendPair.privateKey
	)
	if (
		validateTerminalRuntimeRebindDiscovery({
			discovery: acknowledgedDiscovery,
			discoveryRaw: acknowledgedDiscoveryRaw,
			discoverySignatureRaw: acknowledgedDiscoverySignatureRaw,
			prepared: prepared.value,
			preparedRaw: prepared.body,
			adopted: adopted.value,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: adopted.signatureRaw,
			nowMs: Date.parse(adoptedAt)
		}) !== 'acknowledged'
	) {
		throw new Error('Terminal discovery acknowledgement was misclassified')
	}
	const validateTerminalDiscoveryFixture = fixture => {
		const raw = Buffer.from(JSON.stringify(fixture))
		return validateTerminalRuntimeRebindDiscovery({
			discovery: fixture,
			discoveryRaw: raw,
			discoverySignatureRaw: signFile(raw, backendPair.privateKey),
			prepared: prepared.value,
			preparedRaw: prepared.body,
			adopted: adopted.value,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: adopted.signatureRaw,
			nowMs: Date.parse(adoptedAt)
		})
	}
	expectFailure('terminal CURRENT applied ledger tail', () =>
		validateTerminalDiscoveryFixture({
			...acknowledgedDiscovery,
			runtimeStabilityLedgerTailState: 'applied'
		})
	)
	const postAbortAcknowledgedDiscovery = {
		...acknowledgedDiscovery,
		runtimeStabilityLedgerGeneration: 2,
		runtimeStabilityLedgerTailState: 'aborted',
		runtimeStabilityLedgerTailEvidenceSha256: '9'.repeat(64)
	}
	if (
		validateTerminalDiscoveryFixture(postAbortAcknowledgedDiscovery) !==
		'acknowledged'
	) {
		throw new Error(
			'Terminal post-abort acknowledgement was misclassified'
		)
	}
	expectFailure('terminal post-abort ledger reuses terminal SHA', () =>
		validateTerminalDiscoveryFixture({
			...postAbortAcknowledgedDiscovery,
			runtimeStabilityLedgerTailEvidenceSha256:
				acknowledgedDiscovery.runtimeStabilityEvidenceSha256
		})
	)
	const wrongAcknowledgedDiscovery = {
		...acknowledgedDiscovery,
		frontendBinding: {
			...acknowledgedDiscovery.frontendBinding,
			evidenceSha256: '9'.repeat(64)
		}
	}
	const wrongAcknowledgedDiscoveryRaw = Buffer.from(
		JSON.stringify(wrongAcknowledgedDiscovery)
	)
	const wrongAcknowledgedDiscoverySignatureRaw = signFile(
		wrongAcknowledgedDiscoveryRaw,
		backendPair.privateKey
	)
	expectFailure('terminal discovery evidence body', () =>
		validateTerminalRuntimeRebindDiscovery({
			discovery: wrongAcknowledgedDiscovery,
			discoveryRaw: wrongAcknowledgedDiscoveryRaw,
			discoverySignatureRaw: wrongAcknowledgedDiscoverySignatureRaw,
			prepared: prepared.value,
			preparedRaw: prepared.body,
			adopted: adopted.value,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: adopted.signatureRaw,
			nowMs: Date.parse(adoptedAt)
		})
	)
	rmSync(mutation.paths.mutationStart)
	restoreTerminalRuntimeRebindMutationStartPublicPairForOwner({
		paths: mutation.paths,
		mutationRaw: mutation.body,
		mutationSignatureRaw: mutation.signatureRaw,
		frontendPublicKeyPath: frontend.publicPath,
		verificationOptions: {
			prepared: prepared.value,
			preparedRaw: prepared.body,
			preparedSignatureRaw: prepared.signatureRaw,
			ready: readyValue,
			readyRaw,
			readySignatureRaw,
			nowMs: Date.parse(adoptedAt)
		},
		owner
	})
	if (!existsSync(mutation.paths.mutationStart)) {
		throw new Error('Terminal mutation-start public body was not repaired')
	}
	rmSync(adopted.paths.adopted)
	if (
		runtimeRebindLocalState({
			clientRevision,
			releaseRoot,
			privateRoot
		}).state !== 'adopted'
	) {
		throw new Error(
			'Private ADOPTED pair did not survive public body crash'
		)
	}
	restoreTerminalRuntimeRebindPublicPairForOwner({
		paths: adopted.paths,
		adoptedRaw: adopted.body,
		adoptedSignatureRaw: adopted.signatureRaw,
		frontendPublicKeyPath: frontend.publicPath,
		verificationOptions: terminalVerificationOptions,
		owner
	})
	if (!existsSync(adopted.paths.adopted)) {
		throw new Error('Terminal ADOPTED public body crash was not repaired')
	}
	rmSync(adopted.paths.adoptedSignature)
	restoreTerminalRuntimeRebindPublicPairForOwner({
		paths: adopted.paths,
		adoptedRaw: adopted.body,
		adoptedSignatureRaw: adopted.signatureRaw,
		frontendPublicKeyPath: frontend.publicPath,
		verificationOptions: terminalVerificationOptions,
		owner
	})
	if (!existsSync(adopted.paths.adoptedSignature)) {
		throw new Error(
			'Terminal ADOPTED public signature crash was not repaired'
		)
	}
	writeFileSync(adopted.paths.adopted, Buffer.from('{}'))
	expectFailure('terminal public adopted body drift', () =>
		restoreTerminalRuntimeRebindPublicPairForOwner({
			paths: adopted.paths,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: adopted.signatureRaw,
			frontendPublicKeyPath: frontend.publicPath,
			verificationOptions: terminalVerificationOptions,
			owner
		})
	)
	writeFileSync(adopted.paths.adopted, adopted.body)
	writeFileSync(adopted.paths.adoptedSignature, wrongAdoptedSignature)
	expectFailure('terminal public adopted signature drift', () =>
		restoreTerminalRuntimeRebindPublicPairForOwner({
			paths: adopted.paths,
			adoptedRaw: adopted.body,
			adoptedSignatureRaw: adopted.signatureRaw,
			frontendPublicKeyPath: frontend.publicPath,
			verificationOptions: terminalVerificationOptions,
			owner
		})
	)
	writeFileSync(adopted.paths.adoptedSignature, adopted.signatureRaw)
	const retryAdopted = nextAdoptedAt =>
		adoptRuntimeRebindForOwner({
			preparedRaw: prepared.body,
			preparedSignatureRaw: prepared.signatureRaw,
			readyRaw,
			readySignatureRaw,
			mutationRaw: mutation.body,
			mutationSignatureRaw: mutation.signatureRaw,
			mutationRaw: mutation.body,
			mutationSignatureRaw: mutation.signatureRaw,
			runtimeRaw: newRuntimeRaw,
			releaseRaw,
			releaseSignatureRaw,
			heartbeatRaw,
			heartbeatSignatureRaw,
			imageAdoptionRaw,
			expectedProcessStartedAt: newProcess,
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot,
			privateRoot,
			owner,
			adoptedAt: nextAdoptedAt
		})
	const adoptedRetry = retryAdopted('2026-08-15T00:12:30.000Z')
	if (
		!adoptedRetry.body.equals(adopted.body) ||
		!adoptedRetry.signatureRaw.equals(adopted.signatureRaw)
	) {
		throw new Error('Frontend ADOPTED retry was not idempotent')
	}
	rmSync(adopted.paths.adopted)
	retryAdopted('2026-08-15T00:12:40.000Z')
	if (!existsSync(adopted.paths.adopted)) {
		throw new Error('Frontend ADOPTED public body crash was not repaired')
	}
	rmSync(adopted.paths.adoptedSignature)
	retryAdopted('2026-08-15T00:12:50.000Z')
	if (!existsSync(adopted.paths.adoptedSignature)) {
		throw new Error(
			'Frontend ADOPTED public signature crash was not repaired'
		)
	}
	rmSync(adopted.paths.adoptedSignatureArchive)
	retryAdopted('2026-08-15T00:12:55.000Z')
	if (!existsSync(adopted.paths.adoptedSignatureArchive)) {
		throw new Error(
			'Frontend ADOPTED private signature crash was not repaired'
		)
	}

	const wrongSignature = Buffer.from(readySignatureRaw)
	wrongSignature[0] = wrongSignature[0] === 65 ? 66 : 65
	expectFailure('wrong backend signature', () =>
		verifyRuntimeRebindReady(
			readyRaw,
			wrongSignature,
			backend.publicPath,
			{
				prepared: prepared.value,
				preparedRaw: prepared.body,
				preparedSignatureRaw: prepared.signatureRaw,
				nowMs: Date.parse(readyAt)
			}
		)
	)
	const shiftedReadyTimestamp = {
		...readyValue,
		preparedAt: '2026-08-15T00:05:01.000Z',
		expiresAt: '2026-08-15T00:35:01.000Z'
	}
	expectFailure('READY does not copy PREPARED timestamps exactly', () =>
		validateRuntimeRebindReadyRaw(
			Buffer.from(JSON.stringify(shiftedReadyTimestamp)),
			{
				prepared: prepared.value,
				preparedRaw: prepared.body,
				preparedSignatureRaw: prepared.signatureRaw,
				nowMs: Date.parse(readyAt)
			}
		)
	)
	expectFailure('planned adoption without mutation-start', () =>
		adoptRuntimeRebindForOwner({
			preparedRaw: prepared.body,
			preparedSignatureRaw: prepared.signatureRaw,
			readyRaw,
			readySignatureRaw,
			runtimeRaw: newRuntimeRaw,
			releaseRaw,
			releaseSignatureRaw,
			heartbeatRaw,
			heartbeatSignatureRaw,
			imageAdoptionRaw,
			expectedProcessStartedAt: newProcess,
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot,
			privateRoot,
			owner,
			adoptedAt
		})
	)
	const changedGeneration = {
		...prepared.value,
		generation: 2
	}
	expectFailure('generation gap', () =>
		validateRuntimeRebindPreparedRaw(
			Buffer.from(JSON.stringify(changedGeneration)),
			{
				discovery: discoveryValue,
				discoveryRaw,
				discoverySignatureRaw,
				nowMs: Date.parse(preparedAt)
			}
		)
	)
	for (const [label, invalidPrepared] of [
		[
			'PREPARED wrong CURRENT body hash',
			{ ...prepared.value, backendCurrentEvidenceSha256: '9'.repeat(64) }
		],
		[
			'PREPARED wrong CURRENT signature hash',
			{
				...prepared.value,
				backendCurrentEvidenceSignatureSha256: '9'.repeat(64)
			}
		],
		[
			'PREPARED wrong CURRENT publishedAt',
			{
				...prepared.value,
				backendCurrentPublishedAt: '2026-08-14T23:59:00.000Z'
			}
		]
	]) {
		expectFailure(label, () =>
			validateRuntimeRebindPreparedRaw(
				Buffer.from(JSON.stringify(invalidPrepared)),
				{
					discovery: discoveryValue,
					discoveryRaw,
					discoverySignatureRaw,
					nowMs: Date.parse(preparedAt)
				}
			)
		)
	}
	const missingCurrentBindingPrepared = { ...prepared.value }
	delete missingCurrentBindingPrepared.backendCurrentEvidenceSha256
	expectFailure('PREPARED missing CURRENT body hash', () =>
		validateRuntimeRebindPreparedRaw(
			Buffer.from(JSON.stringify(missingCurrentBindingPrepared)),
			{ nowMs: Date.parse(preparedAt) }
		)
	)
	const unchangedProcess = {
		...adopted.value,
		clientProcessStartedAt: oldProcess
	}
	expectFailure('unchanged adopted process', () =>
		validateRuntimeRebindAdoptedRaw(
			Buffer.from(JSON.stringify(unchangedProcess)),
			{ nowMs: Date.parse(adoptedAt) }
		)
	)
	expectFailure('ADOPTED predates first heartbeat window end', () =>
		validateRuntimeRebindAdoptedRaw(
			Buffer.from(
				JSON.stringify({
					...adopted.value,
					adoptedAt: '2026-08-15T00:10:30.000Z'
				})
			),
			{ nowMs: Date.parse(adoptedAt) }
		)
	)
	const processAtMutation = {
		...adopted.value,
		clientProcessStartedAt: mutationStartedAt,
		firstHeartbeatWindowStartedAt: mutationStartedAt
	}
	expectFailure('planned process does not follow mutation-start', () =>
		validateRuntimeRebindAdoptedRaw(
			Buffer.from(JSON.stringify(processAtMutation)),
			{
				prepared: prepared.value,
				preparedRaw: prepared.body,
				preparedSignatureRaw: prepared.signatureRaw,
				ready: readyValue,
				readyRaw,
				readySignatureRaw,
				mutationRaw: mutation.body,
				mutationSignatureRaw: mutation.signatureRaw,
				frontendPublicKeyPath: frontend.publicPath,
				nowMs: Date.parse(adoptedAt)
			}
		)
	)
	const earlierRecoveryPrepared = {
		...prepared.value,
		rebindMode: 'recovery-adoption',
		observedClientProcessStartedAt: '2026-08-14T23:59:59.000Z'
	}
	expectFailure('recovery process older than previous process', () =>
		validateRuntimeRebindPreparedRaw(
			Buffer.from(JSON.stringify(earlierRecoveryPrepared)),
			{ nowMs: Date.parse(preparedAt) }
		)
	)
	const recoveryPrepared = {
		...prepared.value,
		rebindMode: 'recovery-adoption',
		observedClientProcessStartedAt: newProcess
	}
	const recoveryPreparedRaw = Buffer.from(JSON.stringify(recoveryPrepared))
	const recoveryReady = {
		...readyValue,
		rebindMode: 'recovery-adoption',
		frontendPreparedEvidenceSha256: sha256(recoveryPreparedRaw)
	}
	const recoveryReadyRaw = Buffer.from(JSON.stringify(recoveryReady))
	const recoveryAdoptedWithMutation = {
		...adopted.value,
		rebindMode: 'recovery-adoption',
		frontendPreparedEvidenceSha256: sha256(recoveryPreparedRaw),
		backendReadyEvidenceSha256: sha256(recoveryReadyRaw),
		clientProcessStartedAt: newProcess
	}
	expectFailure('recovery ADOPTED contains mutation-start', () =>
		validateRuntimeRebindAdoptedRaw(
			Buffer.from(JSON.stringify(recoveryAdoptedWithMutation)),
			{
				prepared: recoveryPrepared,
				preparedRaw: recoveryPreparedRaw,
				preparedSignatureRaw: prepared.signatureRaw,
				ready: recoveryReady,
				readyRaw: recoveryReadyRaw,
				readySignatureRaw,
				mutationRaw: mutation.body,
				mutationSignatureRaw: mutation.signatureRaw,
				frontendPublicKeyPath: frontend.publicPath,
				nowMs: Date.parse(adoptedAt)
			}
		)
	)
	const secondRecoveryProcess = '2026-08-15T00:10:30.000Z'
	const driftedRecoveryAdopted = {
		...adopted.value,
		rebindMode: 'recovery-adoption',
		frontendPreparedEvidenceSha256: sha256(recoveryPreparedRaw),
		backendReadyEvidenceSha256: sha256(recoveryReadyRaw),
		clientProcessStartedAt: secondRecoveryProcess,
		firstHeartbeatWindowStartedAt: secondRecoveryProcess
	}
	expectFailure('second recovery process in one generation', () =>
		validateRuntimeRebindAdoptedRaw(
			Buffer.from(JSON.stringify(driftedRecoveryAdopted)),
			{
				prepared: recoveryPrepared,
				preparedRaw: recoveryPreparedRaw,
				preparedSignatureRaw: prepared.signatureRaw,
				ready: recoveryReady,
				readyRaw: recoveryReadyRaw,
				readySignatureRaw,
				nowMs: Date.parse(adoptedAt)
			}
		)
	)
	expectFailure('captured adopted process drift', () =>
		adoptRuntimeRebindForOwner({
			preparedRaw: prepared.body,
			preparedSignatureRaw: prepared.signatureRaw,
			readyRaw,
			readySignatureRaw,
			runtimeRaw: newRuntimeRaw,
			releaseRaw,
			releaseSignatureRaw,
			heartbeatRaw,
			heartbeatSignatureRaw,
			imageAdoptionRaw,
			expectedProcessStartedAt: '2026-08-15T00:10:01.000Z',
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			releaseRoot,
			privateRoot,
			owner,
			adoptedAt
		})
	)
	if (
		classifyRuntimeRebindApplyBoundary({
			prepared: prepared.value,
			liveProcessStartedAt: oldProcess,
			liveContainerGeneration: 0,
			liveContainerRestartCount: 3
		}) !== 'planned-mutation-required' ||
		classifyRuntimeRebindApplyBoundary({
			prepared: prepared.value,
			mutation: mutation.value,
			liveProcessStartedAt: newProcess,
			liveContainerGeneration: 1,
			liveContainerRestartCount: 0
		}) !== 'planned-mutation-complete' ||
		classifyRuntimeRebindApplyBoundary({
			prepared: recoveryPrepared,
			liveProcessStartedAt: newProcess,
			liveContainerGeneration: 0,
			liveContainerRestartCount: 0
		}) !== 'recovery-adoption'
	) {
		throw new Error(
			'Frontend runtime rebind apply boundary was misclassified'
		)
	}
	for (const [label, fixture] of [
		[
			'planned target label with previous process',
			{
				prepared: prepared.value,
				mutation: mutation.value,
				liveProcessStartedAt: oldProcess,
				liveContainerGeneration: 1,
				liveContainerRestartCount: 0
			}
		],
		[
			'planned target label with restart count',
			{
				prepared: prepared.value,
				mutation: mutation.value,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 1,
				liveContainerRestartCount: 1
			}
		],
		[
			'planned target label without mutation-start',
			{
				prepared: prepared.value,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 1,
				liveContainerRestartCount: 0
			}
		],
		[
			'recovery mutation-start contamination',
			{
				prepared: recoveryPrepared,
				mutation: mutation.value,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 0,
				liveContainerRestartCount: 0
			}
		],
		[
			'planned process drift before mutation',
			{
				prepared: prepared.value,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 0,
				liveContainerRestartCount: 0
			}
		],
		[
			'future container generation',
			{
				prepared: prepared.value,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 2,
				liveContainerRestartCount: 0
			}
		],
		[
			'missing container generation',
			{
				prepared: prepared.value,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: undefined,
				liveContainerRestartCount: 0
			}
		],
		[
			'recovery target label',
			{
				prepared: recoveryPrepared,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 1,
				liveContainerRestartCount: 0
			}
		],
		[
			'recovery restart count',
			{
				prepared: recoveryPrepared,
				liveProcessStartedAt: newProcess,
				liveContainerGeneration: 0,
				liveContainerRestartCount: 1
			}
		],
		[
			'second recovery process',
			{
				prepared: recoveryPrepared,
				liveProcessStartedAt: secondRecoveryProcess,
				liveContainerGeneration: 0,
				liveContainerRestartCount: 0
			}
		]
	]) {
		expectFailure(label, () => classifyRuntimeRebindApplyBoundary(fixture))
	}
	const invalidDate = {
		...readyValue,
		preparedAt: '2026-02-30T00:06:00.000Z'
	}
	expectFailure('normalized impossible timestamp', () =>
		validateRuntimeRebindReadyRaw(
			Buffer.from(JSON.stringify(invalidDate)),
			{
				nowMs: Date.parse(readyAt)
			}
		)
	)
	const foreignDiscovery = {
		...discoveryValue,
		currentClientRevision: 'f'.repeat(40)
	}
	expectFailure('foreign discovery client', () =>
		validateRuntimeStabilityCurrentRaw(
			Buffer.from(JSON.stringify(foreignDiscovery)),
			{ expectedClientRevision: clientRevision }
		)
	)
	const wrongImageDiscovery = {
		...discoveryValue,
		frontendBinding: {
			...discoveryValue.frontendBinding,
			imageId: `sha256:${'9'.repeat(64)}`
		}
	}
	expectFailure('prepared wrong image binding', () =>
		validateRuntimeRebindPreparedRaw(prepared.body, {
			discovery: wrongImageDiscovery,
			discoveryRaw: Buffer.from(JSON.stringify(wrongImageDiscovery)),
			discoverySignatureRaw,
			nowMs: Date.parse(preparedAt)
		})
	)
	const wrongTreeDiscovery = {
		...discoveryValue,
		frontendBinding: {
			...discoveryValue.frontendBinding,
			releaseTreeSha256: '9'.repeat(64)
		}
	}
	expectFailure('prepared wrong release tree binding', () =>
		validateRuntimeRebindPreparedRaw(prepared.body, {
			discovery: wrongTreeDiscovery,
			discoveryRaw: Buffer.from(JSON.stringify(wrongTreeDiscovery)),
			discoverySignatureRaw,
			nowMs: Date.parse(preparedAt)
		})
	)
	const wrongPreparedSignature = Buffer.from(prepared.signatureRaw)
	wrongPreparedSignature[1] = wrongPreparedSignature[1] === 65 ? 66 : 65
	expectFailure('wrong prepared signature', () =>
		verifyRuntimeRebindPrepared(
			prepared.body,
			wrongPreparedSignature,
			frontend.publicPath,
			{
				discovery: discoveryValue,
				discoveryRaw,
				discoverySignatureRaw,
				nowMs: Date.parse(preparedAt)
			}
		)
	)

	const deployLockTool = realpathSync(
		new URL('./frontend-production-deploy-lock.sh', import.meta.url)
	)
	let flockAvailable = true
	try {
		execFileSync('sh', ['-c', 'command -v flock'], { stdio: 'ignore' })
	} catch {
		flockAvailable = false
	}
	if (flockAvailable) {
		const deployLockRoot = join(root, 'deploy-lock')
		mkdirSync(deployLockRoot, { mode: 0o700 })
		const deployLockPath = join(deployLockRoot, '.production-deploy.lock')
		const lockArguments = [
			'deploy-lock-test',
			deployLockTool,
			deployLockPath,
			String(owner.uid),
			String(owner.gid)
		]
		const acquireOnce = () =>
			execFileSync(
				'bash',
				[
					'-c',
					'source "$1"; _acquire_frontend_production_deploy_lock_for_owner sequential "$2" "$3" "$4"',
					...lockArguments
				],
				{ stdio: 'pipe' }
			)
		acquireOnce()
		const firstLockMetadata = statSync(deployLockPath)
		acquireOnce()
		const secondLockMetadata = statSync(deployLockPath)
		if (
			(firstLockMetadata.mode & 0o777) !== 0o600 ||
			firstLockMetadata.ino !== secondLockMetadata.ino ||
			firstLockMetadata.nlink !== 1
		) {
			throw new Error(
				'Frontend production deploy lock inode was not durable'
			)
		}
		execFileSync(
			'bash',
			[
				'-c',
				`set -euo pipefail
source "$1"
_acquire_frontend_production_deploy_lock_for_owner holder "$2" "$3" "$4"
if bash -c 'exec 9>&-; unset WINWIDGET_FRONTEND_PRODUCTION_DEPLOY_LOCK_HELD FRONTEND_PRODUCTION_DEPLOY_LOCK_FD; source "$1"; _acquire_frontend_production_deploy_lock_for_owner contender "$2" "$3" "$4"' contender "$1" "$2" "$3" "$4"; then
  exit 91
fi
if (
  exec 9>&-
  exec 9<>"$2"
  export WINWIDGET_FRONTEND_PRODUCTION_DEPLOY_LOCK_HELD="$2"
  export FRONTEND_PRODUCTION_DEPLOY_LOCK_FD=9
  _acquire_frontend_production_deploy_lock_for_owner false-claim "$2" "$3" "$4"
); then
  exit 92
fi
mv "$2" "$2.replaced"
: > "$2"
chmod 600 "$2"
if _frontend_production_deploy_lock_validate_descriptor_for_owner "$2" 9 "$3" "$4"; then
  exit 93
fi`,
				...lockArguments
			],
			{ stdio: 'pipe' }
		)

		const symlinkLockRoot = join(root, 'deploy-lock-symlink')
		mkdirSync(symlinkLockRoot, { mode: 0o700 })
		const symlinkTarget = join(symlinkLockRoot, 'target')
		const symlinkLock = join(symlinkLockRoot, '.production-deploy.lock')
		writeFileSync(symlinkTarget, '', { mode: 0o600 })
		symlinkSync(symlinkTarget, symlinkLock)
		let symlinkRejected = false
		try {
			execFileSync(
				'bash',
				[
					'-c',
					'source "$1"; _acquire_frontend_production_deploy_lock_for_owner symlink "$2" "$3" "$4"',
					'deploy-lock-symlink-test',
					deployLockTool,
					symlinkLock,
					String(owner.uid),
					String(owner.gid)
				],
				{ stdio: 'pipe' }
			)
		} catch {
			symlinkRejected = true
		}
		if (!symlinkRejected) {
			throw new Error(
				'Frontend production deploy lock symlink was accepted'
			)
		}
	}

	const deployScript = readFileSync(
		new URL('./deploy-production.sh', import.meta.url),
		'utf8'
	)
	const workflow = readFileSync(
		new URL('../.github/workflows/deploy-production.yml', import.meta.url),
		'utf8'
	)
	const composeSource = readFileSync(
		new URL('../deploy/docker-compose.prod.yml', import.meta.url),
		'utf8'
	)
	const runtimeRebindSource = readFileSync(
		new URL(
			'./identity-avatar-client-runtime-rebind.mjs',
			import.meta.url
		),
		'utf8'
	)
	const publicEvidenceSource = readFileSync(
		new URL(
			'../src/shared/server/identity-avatar-client-evidence.ts',
			import.meta.url
		),
		'utf8'
	)
	const publicEvidenceModulePath = join(
		root,
		'identity-avatar-client-evidence.mjs'
	)
	writeFileSync(
		publicEvidenceModulePath,
		ts.transpileModule(publicEvidenceSource, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022
			}
		}).outputText
	)
	const { getRuntimeRebindArtifactResponse } = await import(
		pathToFileURL(publicEvidenceModulePath)
	)
	const publicRouteOptions = {
		releaseRoot,
		liveClientRevision: clientRevision
	}
	const exactResponseHeaders = (response, expected) => {
		const actual = Object.fromEntries(response.headers.entries())
		if (JSON.stringify(actual) !== JSON.stringify(expected)) {
			throw new Error(
				`Runtime rebind response headers drifted: ${JSON.stringify(actual)}`
			)
		}
	}
	const wrongPathResponse = getRuntimeRebindArtifactResponse(
		clientRevision,
		'generation-000001',
		'mutation-start-v2.json',
		publicRouteOptions
	)
	if (
		wrongPathResponse.status !== 404 ||
		(await wrongPathResponse.text()) !== ''
	) {
		throw new Error(
			'Wrong runtime rebind public path did not return empty 404'
		)
	}
	exactResponseHeaders(wrongPathResponse, {
		'cache-control': 'no-store, max-age=0',
		'content-type': 'text/plain; charset=utf-8',
		pragma: 'no-cache',
		'x-content-type-options': 'nosniff',
		'x-winwidget-revision': clientRevision
	})
	rmSync(mutation.paths.mutationStart)
	rmSync(mutation.paths.mutationStartSignature)
	const absentMutationResponse = getRuntimeRebindArtifactResponse(
		clientRevision,
		'generation-000001',
		'mutation-start-v1.json',
		publicRouteOptions
	)
	if (
		absentMutationResponse.status !== 404 ||
		(await absentMutationResponse.text()) !== ''
	) {
		throw new Error('Absent mutation-start pair did not return empty 404')
	}
	writeFileSync(mutation.paths.mutationStart, mutation.body, {
		mode: 0o644
	})
	const partialMutationResponse = getRuntimeRebindArtifactResponse(
		clientRevision,
		'generation-000001',
		'mutation-start-v1.json',
		publicRouteOptions
	)
	if (
		partialMutationResponse.status !== 503 ||
		(await partialMutationResponse.text()) !== ''
	) {
		throw new Error('Partial mutation-start pair did not return empty 503')
	}
	exactResponseHeaders(partialMutationResponse, {
		'cache-control': 'no-store, max-age=0',
		pragma: 'no-cache',
		'x-content-type-options': 'nosniff'
	})
	writeFileSync(
		mutation.paths.mutationStartSignature,
		mutation.signatureRaw,
		{ mode: 0o644 }
	)
	const mutationResponse = getRuntimeRebindArtifactResponse(
		clientRevision,
		'generation-000001',
		'mutation-start-v1.json',
		publicRouteOptions
	)
	const mutationResponseRaw = Buffer.from(
		await mutationResponse.arrayBuffer()
	)
	if (
		mutationResponse.status !== 200 ||
		!mutationResponseRaw.equals(mutation.body) ||
		JSON.stringify(
			Object.keys(JSON.parse(mutationResponseRaw.toString()))
		) !== JSON.stringify(RUNTIME_REBIND_MUTATION_START_KEYS)
	) {
		throw new Error(
			'Exact mutation-start public response leaked or drifted'
		)
	}
	exactResponseHeaders(mutationResponse, {
		'cache-control': 'no-store, max-age=0',
		'content-type': 'application/json; charset=utf-8',
		pragma: 'no-cache',
		'x-content-type-options': 'nosniff',
		'x-winwidget-revision': clientRevision
	})
	const adoptedBeforeHeartbeatRaw = Buffer.from(
		JSON.stringify({
			...adopted.value,
			adoptedAt: '2026-08-15T00:10:30.000Z'
		})
	)
	writeFileSync(adopted.paths.adopted, adoptedBeforeHeartbeatRaw)
	const earlyAdoptedResponse = getRuntimeRebindArtifactResponse(
		clientRevision,
		'generation-000001',
		'adopted-v1.json',
		publicRouteOptions
	)
	if (
		earlyAdoptedResponse.status !== 503 ||
		(await earlyAdoptedResponse.text()) !== ''
	) {
		throw new Error(
			'Public ADOPTED accepted adoption before heartbeat end'
		)
	}
	writeFileSync(adopted.paths.adopted, adopted.body)
	const sourceLines = source =>
		source.split('\n').map((line, index) => ({
			index,
			text: line.trim()
		}))
	const executableLineIndexes = (source, pattern) =>
		sourceLines(source)
			.filter(
				line =>
					line.text.length > 0 &&
					!line.text.startsWith('#') &&
					pattern.test(line.text)
			)
			.map(line => line.index)
	const deployEvents = source => {
		const patterns = [
			[
				'archive-ready',
				/^node "\$identity_avatar_runtime_rebind_tool" archive-ready-live \\$/
			],
			[
				'classify-boundary',
				/^node "\$identity_avatar_runtime_rebind_tool" classify-apply-boundary \\$/
			],
			[
				'publish-mutation',
				/^node "\$identity_avatar_runtime_rebind_tool" publish-mutation-start-live \\$/
			],
			[
				'force-recreate',
				/^compose up -d --no-build --force-recreate client$/
			],
			[
				'adopt-live',
				/^node "\$identity_avatar_runtime_rebind_tool" adopt-live \\$/
			],
			[
				'timer-enable',
				/^systemctl enable --now winwidget-identity-avatar-client-log-soak\.timer$/
			]
		]
		return sourceLines(source).flatMap(line => {
			if (line.text.startsWith('#') || /^echo\b/.test(line.text)) return []
			const event = patterns.find(([, pattern]) => pattern.test(line.text))
			return event ? [event[0]] : []
		})
	}
	const expectedDeployEvents = [
		'archive-ready',
		'archive-ready',
		'classify-boundary',
		'publish-mutation',
		'archive-ready',
		'classify-boundary',
		'force-recreate',
		'classify-boundary',
		'adopt-live',
		'timer-enable'
	]
	const deadStringDecoratedDeploy = `# node "$identity_avatar_runtime_rebind_tool" publish-mutation-start-live \\\n+echo 'compose up -d --no-build --force-recreate client'\n${deployScript}`
	const applyEvidenceCallIndexes = executableLineIndexes(
		runtimeRebindSource,
		/^const applyEvidence = validateRuntimeRebindApplyEvidenceForOwner\(\{$/
	)
	const applyBoundaryCaseStartIndexes = executableLineIndexes(
		deployScript,
		/^case "\$identity_avatar_runtime_rebind_boundary_action" in$/
	)
	const applyBoundaryCaseEnd =
		applyBoundaryCaseStartIndexes.length === 1
			? sourceLines(deployScript).find(
					line =>
						line.index > applyBoundaryCaseStartIndexes[0] &&
						line.text === 'esac'
				)?.index
			: undefined
	if (applyBoundaryCaseEnd === undefined) {
		throw new Error('Frontend apply boundary case was not uniquely found')
	}
	const applyBoundaryCase = deployScript
		.split('\n')
		.slice(applyBoundaryCaseStartIndexes[0], applyBoundaryCaseEnd + 1)
		.join('\n')
	const postExpiryRetryCaseOutput = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
compose() {
	echo 'unexpected compose during post-expiry retry' >&2
	return 97
}
identity_avatar_runtime_rebind_boundary_action='planned-mutation-complete'
identity_avatar_runtime_rebind_fresh_process='${expiryBoundaryProcessStartedAt}'
${applyBoundaryCase}
printf '%s' "$identity_avatar_runtime_rebind_expected_process"`
		],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
	)
	const directLockIndexes = executableLineIndexes(
		deployScript,
		/^acquire_frontend_production_deploy_lock 'frontend deployment'$/
	)
	const directRevisionIndexes = executableLineIndexes(
		deployScript,
		/^deploy_revision="\$\(git -C "\$client_root" rev-parse HEAD\)"$/
	)
	const workflowLockIndexes = executableLineIndexes(
		workflow,
		/^frontend_deploy_lock="\$APP_ROOT\/deploy\/frontend\/\.production-deploy\.lock"$/
	)
	const workflowFetchIndexes = executableLineIndexes(
		workflow,
		/^git fetch --no-tags origin refs\/heads\/prod$/
	)
	const workflowUses = sourceLines(workflow)
		.map(line => line.text.match(/^uses: (.+)$/)?.[1])
		.filter(Boolean)
	const forbiddenWorkflowRuntimeTokens = [
		'identity_avatar_client_runtime_rebind',
		'IDENTITY_AVATAR_RUNTIME_REBIND_ACTION',
		'stage-planned',
		'stage-recovery',
		"needs.verify.result == 'skipped'",
		'always()'
	]
	expectFailure('cleanup frontend binding null', () =>
		verifyCleanupFrontendBindingForOwner({ cleanup: null, receipt: null })
	)
	const cleanupVerifierStart = runtimeRebindSource.indexOf(
		'export const verifyCleanupFrontendBindingForOwner = ({'
	)
	const runtimeCliStart = runtimeRebindSource.indexOf(
		'const main = async () => {'
	)
	const cleanupVerifierSource = runtimeRebindSource.slice(
		cleanupVerifierStart,
		runtimeCliStart
	)
	const stageCliStart = runtimeRebindSource.indexOf(
		"if (command === 'stage-live')",
		runtimeCliStart
	)
	const archiveCliStart = runtimeRebindSource.indexOf(
		"if (command === 'archive-ready-live')",
		stageCliStart
	)
	const classifyCliStart = runtimeRebindSource.indexOf(
		"if (command === 'classify-apply-boundary')",
		archiveCliStart
	)
	const stageCliSource = runtimeRebindSource.slice(
		stageCliStart,
		archiveCliStart
	)
	const archiveCliSource = runtimeRebindSource.slice(
		archiveCliStart,
		classifyCliStart
	)
	const stageReceiptGuardIndex = stageCliSource.indexOf(
		'assertRuntimeRebindActiveReceipt(rootOwner)'
	)
	const archiveReceiptGuardIndex = archiveCliSource.indexOf(
		'assertRuntimeRebindActiveReceipt(rootOwner)'
	)
	if (
		JSON.stringify(deployEvents(deployScript)) !==
			JSON.stringify(expectedDeployEvents) ||
		JSON.stringify(deployEvents(deadStringDecoratedDeploy)) !==
			JSON.stringify(expectedDeployEvents) ||
		applyEvidenceCallIndexes.length !== 2 ||
		applyBoundaryCaseStartIndexes.length !== 1 ||
		postExpiryRetryCaseOutput !== expiryBoundaryProcessStartedAt ||
		directLockIndexes.length !== 1 ||
		directRevisionIndexes.length !== 1 ||
		directLockIndexes[0] >= directRevisionIndexes[0] ||
		workflowLockIndexes.length !== 1 ||
		workflowFetchIndexes.length !== 1 ||
		workflowLockIndexes[0] >= workflowFetchIndexes[0] ||
		JSON.stringify(workflowUses) !==
			JSON.stringify([
				'actions/checkout@v6',
				'pnpm/action-setup@v6',
				'actions/setup-node@v6'
			]) ||
		forbiddenWorkflowRuntimeTokens.some(token =>
			workflow.includes(token)
		) ||
		cleanupVerifierStart < 0 ||
		runtimeCliStart < 0 ||
		![
			'!cleanup ||',
			'verifyAppliedRetargetForCleanup({',
			'matchingHistories.length !== 1',
			'adoptedSyntax.generation !== Number(match[1])',
			'!preparedArchiveRaw.equals(preparedRaw)',
			'discovery.currentClientBindingEvidenceSha256 !==',
			'historical.ready.currentClientBindingEvidenceSha256 !==',
			'historical.prepared.currentFrontendRetargetEvidenceSha256 !==',
			'sha256(verifiedRetarget.body)',
			'currentFrontendRetargetEvidenceSignatureSha256 !==',
			'sha256(verifiedRetarget.signatureRaw)'
		].every(fragment => cleanupVerifierSource.includes(fragment)) ||
		stageReceiptGuardIndex < 0 ||
		stageReceiptGuardIndex >=
			stageCliSource.indexOf('localReleaseContext(') ||
		stageReceiptGuardIndex >=
			stageCliSource.indexOf('fetchStableBackendPair({') ||
		archiveReceiptGuardIndex < 0 ||
		archiveReceiptGuardIndex >=
			archiveCliSource.indexOf('runtimeRebindLocalState({') ||
		archiveReceiptGuardIndex >=
			archiveCliSource.indexOf('fetchStableBackendPair({') ||
		executableLineIndexes(
			workflow,
			/^if: github\.ref == 'refs\/heads\/prod'$/
		).length !== 1 ||
		executableLineIndexes(
			workflow,
			/^if: github\.ref == 'refs\/heads\/prod' && needs\.verify\.result == 'success'$/
		).length !== 1 ||
		executableLineIndexes(
			workflow,
			/^if ! flock --exclusive --nonblock 9; then$/
		).length !== 1 ||
		executableLineIndexes(
			workflow,
			/^export WINWIDGET_FRONTEND_PRODUCTION_DEPLOY_LOCK_HELD="\$frontend_deploy_lock"$/
		).length !== 1 ||
		executableLineIndexes(
			composeSource,
			/^ru\.winwidget\.identity-avatar\.runtime-stability-generation: '\$\{IDENTITY_AVATAR_RUNTIME_STABILITY_GENERATION:-0\}'$/
		).length !== 1 ||
		executableLineIndexes(
			deployScript,
			/^--expected-process-started-at "\$identity_avatar_process_started_at"$/
		).length !== 1
	) {
		throw new Error(
			'Frontend runtime rebind deploy/workflow executable contract drifted'
		)
	}

	console.log('Identity avatar client runtime rebind self-test passed')
} finally {
	rmSync(root, { recursive: true, force: true })
}
