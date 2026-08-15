#!/usr/bin/env node

import { generateKeyPairSync, sign } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import {
	chmodSync,
	copyFileSync,
	existsSync,
	linkSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	CLIENT_CLEANUP_RETIRED_STATE_CONTRACT,
	bootstrapBackendTrustForOwner,
	createClientSwitchReceiptForOwner,
	deriveReleaseEvidence,
	fetchStableBackendCleanupComplete,
	generateFullReleaseManifest,
	prefetchClientSwitchForOwner,
	provisionSigningKeyPairForOwner,
	readClientCleanupFinalizationForOwner,
	readClientSwitchGuardForOwner,
	sha256,
	validateBackendClientReadyRaw,
	validateBackendCleanupCompleteRaw,
	validateBackendDeploymentHealthRaw,
	validateBackendTrustBootstrapRaw,
	validateClientSwitchReceiptRaw,
	validateFullManifestRaw,
	validateReleaseEvidenceRaw,
	validateRuntimeEvidenceRaw,
	verifyBackendClientReadyAttestation,
	verifyAndPromoteClientSwitchReceiptForOwner,
	verifyBackendCleanupCompleteAttestation,
	verifyReleaseEvidenceSignature,
	writeClientCleanupFinalizationForOwner
} from './identity-avatar-client-release-evidence.mjs'
import { verifyCleanupFrontendBindingForOwner } from './identity-avatar-client-runtime-rebind.mjs'

const revision = 'a'.repeat(40)
const generatedAt = '2026-08-15T00:00:00.000Z'
const processStartedAt = '2026-08-15T00:00:01.000Z'
const temporaryRoot = mkdtempSync(
	join(tmpdir(), 'identity-avatar-client-evidence-')
)

const expectFailure = (label, callback) => {
	let failed = false
	try {
		callback()
	} catch {
		failed = true
	}
	if (!failed) throw new Error(`${label} negative fixture was accepted`)
}

const expectAsyncFailure = async (label, callback) => {
	let failed = false
	try {
		await callback()
	} catch {
		failed = true
	}
	if (!failed) throw new Error(`${label} negative fixture was accepted`)
}

const createFixture = name => {
	const root = join(temporaryRoot, name)
	for (const directory of [
		'.next/server/app',
		'.next/standalone/.next/server',
		'.next/static/chunks'
	]) {
		mkdirSync(join(root, directory), { recursive: true })
	}
	writeFileSync(join(root, '.next/BUILD_ID'), 'bounded-build-id\n')
	writeFileSync(
		join(root, '.next/server/app/avatar.js'),
		'const profile="/profile/avatar";const admin=`/user/${id}/avatar`;'
	)
	writeFileSync(
		join(root, '.next/standalone/.next/server/server.js'),
		'const server=true;'
	)
	writeFileSync(
		join(root, '.next/static/chunks/main.js'),
		'const client=true;'
	)
	writeFileSync(
		join(root, '.next/static/chunks/\u{10000}.js'),
		'const supplementary=true;'
	)
	writeFileSync(
		join(root, '.next/static/chunks/\ue000.js'),
		'const privateUse=true;'
	)
	return root
}

try {
	const root = createFixture('valid')
	const fullManifest = generateFullReleaseManifest({
		repositoryRoot: root,
		clientRevision: revision,
		generatedAt
	})
	const manifest = deriveReleaseEvidence(fullManifest, revision)
	const compactValue = validateReleaseEvidenceRaw(
		manifest,
		revision,
		fullManifest
	)
	const fullValue = JSON.parse(fullManifest.toString('utf8'))
	const privateUseIndex = fullValue.files.findIndex(file =>
		file.path.endsWith('/\ue000.js')
	)
	const supplementaryIndex = fullValue.files.findIndex(file =>
		file.path.endsWith('/\u{10000}.js')
	)
	if (
		privateUseIndex < 0 ||
		supplementaryIndex < 0 ||
		privateUseIndex >= supplementaryIndex
	) {
		throw new Error('Release paths are not UTF-8 bytewise sorted')
	}
	if (
		'files' in compactValue ||
		manifest.includes(Buffer.from('.next/server/app/avatar.js'))
	) {
		throw new Error('Public release evidence exposed full deploy paths')
	}
	const { privateKey, publicKey } = generateKeyPairSync('ed25519')
	const publicKeyPath = join(temporaryRoot, 'public.pem')
	writeFileSync(
		publicKeyPath,
		publicKey.export({ type: 'spki', format: 'pem' })
	)
	const detached = sign(null, manifest, privateKey)
	const signature = Buffer.from(`${detached.toString('base64')}\n`)
	verifyReleaseEvidenceSignature(
		manifest,
		signature,
		publicKeyPath,
		revision
	)
	const duplicatePathManifest = JSON.parse(fullManifest.toString('utf8'))
	duplicatePathManifest.files[1] = {
		...duplicatePathManifest.files[0]
	}
	duplicatePathManifest.totalBytes = duplicatePathManifest.files.reduce(
		(total, file) => total + file.bytes,
		0
	)
	duplicatePathManifest.treeSha256 = sha256(
		JSON.stringify(duplicatePathManifest.files)
	)
	expectFailure('duplicate-bytewise-path', () =>
		validateFullManifestRaw(
			Buffer.from(JSON.stringify(duplicatePathManifest)),
			revision
		)
	)
	const wrongUnicodeOrderManifest = JSON.parse(
		fullManifest.toString('utf8')
	)
	const privateUseFile = wrongUnicodeOrderManifest.files[privateUseIndex]
	wrongUnicodeOrderManifest.files[privateUseIndex] =
		wrongUnicodeOrderManifest.files[supplementaryIndex]
	wrongUnicodeOrderManifest.files[supplementaryIndex] = privateUseFile
	wrongUnicodeOrderManifest.treeSha256 = sha256(
		JSON.stringify(wrongUnicodeOrderManifest.files)
	)
	expectFailure('unicode-bytewise-path-order', () =>
		validateFullManifestRaw(
			Buffer.from(JSON.stringify(wrongUnicodeOrderManifest)),
			revision
		)
	)
	const terminalTraversalManifest = JSON.parse(
		fullManifest.toString('utf8')
	)
	terminalTraversalManifest.files[0].path = '.next/server/.'
	terminalTraversalManifest.treeSha256 = sha256(
		JSON.stringify(terminalTraversalManifest.files)
	)
	expectFailure('terminal-dot-path', () =>
		validateFullManifestRaw(
			Buffer.from(JSON.stringify(terminalTraversalManifest)),
			revision
		)
	)
	const wrongFullHash = JSON.parse(manifest.toString('utf8'))
	wrongFullHash.fullManifestSha256 = 'f'.repeat(64)
	expectFailure('wrong-full-manifest-sha', () =>
		validateReleaseEvidenceRaw(
			Buffer.from(JSON.stringify(wrongFullHash)),
			revision,
			fullManifest
		)
	)
	expectFailure('invalid-utf8-release-evidence', () =>
		validateReleaseEvidenceRaw(Buffer.from([0xff]), revision)
	)

	const wrongSignature = Buffer.from(signature)
	wrongSignature[0] = wrongSignature[0] === 65 ? 66 : 65
	expectFailure('wrong-signature', () =>
		verifyReleaseEvidenceSignature(
			manifest,
			wrongSignature,
			publicKeyPath,
			revision
		)
	)

	const runtime = values =>
		Buffer.from(
			JSON.stringify({
				schemaVersion: 1,
				kind: 'identity-avatar-client-runtime',
				clientRevision: revision,
				processStartedAt: values.processStartedAt,
				releaseEvidenceSha256: values.releaseEvidenceSha256,
				releaseEvidenceSignatureSha256: sha256(signature)
			})
		)
	const validRuntime = runtime({
		processStartedAt,
		releaseEvidenceSha256: sha256(manifest)
	})
	validateRuntimeEvidenceRaw(validRuntime, {
		expectedRevision: revision,
		releaseManifestRaw: manifest,
		releaseSignatureRaw: signature
	})
	expectFailure('wrong-body-sha', () =>
		validateRuntimeEvidenceRaw(
			runtime({
				processStartedAt,
				releaseEvidenceSha256: 'b'.repeat(64)
			}),
			{
				expectedRevision: revision,
				releaseManifestRaw: manifest,
				releaseSignatureRaw: signature
			}
		)
	)
	expectFailure('changed-process-started-at', () =>
		validateRuntimeEvidenceRaw(
			runtime({
				processStartedAt: '2026-08-15T00:00:02.000Z',
				releaseEvidenceSha256: sha256(manifest)
			}),
			{
				expectedRevision: revision,
				releaseManifestRaw: manifest,
				releaseSignatureRaw: signature,
				previousRuntimeRaw: validRuntime
			}
		)
	)

	const keyRootPath = join(temporaryRoot, 'key-recovery')
	mkdirSync(keyRootPath, { mode: 0o700 })
	const keyRoot = realpathSync(keyRootPath)
	const privateKeyPath = join(keyRoot, 'frontend.private.pem')
	const recoveredPublicKeyPath = join(keyRoot, 'frontend.public.pem')
	const keyOwner = {
		expectedUid: process.getuid(),
		expectedGid: process.getgid()
	}
	provisionSigningKeyPairForOwner(
		privateKeyPath,
		recoveredPublicKeyPath,
		keyOwner
	)
	const firstPublicKey = readFileSync(recoveredPublicKeyPath)
	rmSync(recoveredPublicKeyPath)
	provisionSigningKeyPairForOwner(
		privateKeyPath,
		recoveredPublicKeyPath,
		keyOwner
	)
	if (!readFileSync(recoveredPublicKeyPath).equals(firstPublicKey)) {
		throw new Error('Private-only crash recovery changed the public key')
	}
	if (readdirSync(keyRoot).some(name => name.includes('.tmp-'))) {
		throw new Error('Atomic key recovery left a temporary file behind')
	}
	rmSync(privateKeyPath)
	expectFailure('public-only-signing-key', () =>
		provisionSigningKeyPairForOwner(
			privateKeyPath,
			recoveredPublicKeyPath,
			keyOwner
		)
	)
	rmSync(recoveredPublicKeyPath)
	provisionSigningKeyPairForOwner(
		privateKeyPath,
		recoveredPublicKeyPath,
		keyOwner
	)
	const otherPrivateKeyPath = join(keyRoot, 'other.private.pem')
	const otherPublicKeyPath = join(keyRoot, 'other.public.pem')
	provisionSigningKeyPairForOwner(
		otherPrivateKeyPath,
		otherPublicKeyPath,
		keyOwner
	)
	copyFileSync(otherPublicKeyPath, recoveredPublicKeyPath)
	expectFailure('mismatched-signing-key-pair', () =>
		provisionSigningKeyPairForOwner(
			privateKeyPath,
			recoveredPublicKeyPath,
			keyOwner
		)
	)

	const trustRootPath = join(temporaryRoot, 'backend-trust')
	mkdirSync(trustRootPath, { mode: 0o700 })
	const trustRoot = realpathSync(trustRootPath)
	const lifecyclePrivateKeyPath = join(trustRoot, 'lifecycle.private.pem')
	const lifecyclePublicKeyPath = join(trustRoot, 'lifecycle.public.pem')
	provisionSigningKeyPairForOwner(
		lifecyclePrivateKeyPath,
		lifecyclePublicKeyPath,
		keyOwner
	)
	const backendSigning = generateKeyPairSync('ed25519')
	const backendPublicRaw = Buffer.from(
		backendSigning.publicKey.export({ type: 'spki', format: 'pem' })
	)
	const backendTransferPath = join(
		trustRoot,
		'backend.transfer.public.pem'
	)
	const backendPublicPath = join(trustRoot, 'backend.public.pem')
	const backendTrustEvidencePath = join(trustRoot, 'backend-trust-v1.json')
	writeFileSync(backendTransferPath, backendPublicRaw, { mode: 0o600 })
	chmodSync(backendTransferPath, 0o600)
	bootstrapBackendTrustForOwner({
		sourcePath: backendTransferPath,
		destinationPath: backendPublicPath,
		evidencePath: backendTrustEvidencePath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		currentClientRevision: revision,
		installedAt: generatedAt,
		...keyOwner
	})
	if (
		existsSync(backendTransferPath) ||
		!readFileSync(backendPublicPath).equals(backendPublicRaw)
	) {
		throw new Error('Backend trust bootstrap was not durably promoted')
	}
	const backendTrustEvidenceRaw = readFileSync(backendTrustEvidencePath)
	const backendTrustValue = validateBackendTrustBootstrapRaw(
		backendTrustEvidenceRaw,
		{
			destinationPublicKeyRaw: backendPublicRaw,
			frontendLifecyclePublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: revision,
			contractSourcePath: backendTransferPath,
			contractDestinationPath: backendPublicPath
		}
	)
	if (
		JSON.stringify(Object.keys(backendTrustValue)) !==
		JSON.stringify([
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
		])
	) {
		throw new Error('Backend trust bootstrap key order drifted')
	}
	renameSync(
		backendTrustEvidencePath,
		`${backendTrustEvidencePath}.pending`
	)
	writeFileSync(backendTransferPath, backendPublicRaw, { mode: 0o600 })
	chmodSync(backendTransferPath, 0o600)
	bootstrapBackendTrustForOwner({
		sourcePath: backendTransferPath,
		destinationPath: backendPublicPath,
		evidencePath: backendTrustEvidencePath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		currentClientRevision: revision,
		installedAt: '2026-08-15T00:00:30.000Z',
		...keyOwner
	})
	if (
		existsSync(backendTransferPath) ||
		existsSync(`${backendTrustEvidencePath}.pending`) ||
		!readFileSync(backendTrustEvidencePath).equals(backendTrustEvidenceRaw)
	) {
		throw new Error(
			'Backend trust evidence pending publish was not recovered'
		)
	}
	const descendantRevision = 'b'.repeat(40)
	bootstrapBackendTrustForOwner({
		sourcePath: backendTransferPath,
		destinationPath: backendPublicPath,
		evidencePath: backendTrustEvidencePath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		currentClientRevision: descendantRevision,
		installedAt: '2026-08-15T00:01:00.000Z',
		...keyOwner,
		isRevisionAncestor: (ancestor, current) =>
			ancestor === revision && current === descendantRevision
	})
	expectFailure('foreign-bootstrap-revision', () =>
		bootstrapBackendTrustForOwner({
			sourcePath: backendTransferPath,
			destinationPath: backendPublicPath,
			evidencePath: backendTrustEvidencePath,
			frontendPrivateKeyPath: lifecyclePrivateKeyPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: descendantRevision,
			...keyOwner,
			isRevisionAncestor: () => false
		})
	)
	const foreignBackendSigning = generateKeyPairSync('ed25519')
	writeFileSync(
		backendTransferPath,
		foreignBackendSigning.publicKey.export({
			type: 'spki',
			format: 'pem'
		}),
		{ mode: 0o600 }
	)
	chmodSync(backendTransferPath, 0o600)
	expectFailure('backend-key-no-clobber', () =>
		bootstrapBackendTrustForOwner({
			sourcePath: backendTransferPath,
			destinationPath: backendPublicPath,
			evidencePath: backendTrustEvidencePath,
			frontendPrivateKeyPath: lifecyclePrivateKeyPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: descendantRevision,
			...keyOwner,
			isRevisionAncestor: () => true
		})
	)
	rmSync(backendTransferPath)
	if (!readFileSync(backendPublicPath).equals(backendPublicRaw)) {
		throw new Error('Backend key mismatch overwrote the pinned public key')
	}

	const crashRootPath = join(temporaryRoot, 'backend-trust-crash')
	mkdirSync(crashRootPath, { mode: 0o700 })
	const crashRoot = realpathSync(crashRootPath)
	const crashLifecyclePrivate = join(crashRoot, 'lifecycle.private.pem')
	const crashLifecyclePublic = join(crashRoot, 'lifecycle.public.pem')
	provisionSigningKeyPairForOwner(
		crashLifecyclePrivate,
		crashLifecyclePublic,
		keyOwner
	)
	const crashTransfer = join(crashRoot, 'backend.transfer.public.pem')
	const crashDestination = join(crashRoot, 'backend.public.pem')
	const crashPending = `${crashDestination}.bootstrap-v1.pending`
	const crashEvidence = join(crashRoot, 'backend-trust-v1.json')
	writeFileSync(crashTransfer, backendPublicRaw, { mode: 0o600 })
	writeFileSync(crashPending, backendPublicRaw, { mode: 0o600 })
	chmodSync(crashTransfer, 0o600)
	chmodSync(crashPending, 0o600)
	linkSync(crashPending, crashDestination)
	bootstrapBackendTrustForOwner({
		sourcePath: crashTransfer,
		destinationPath: crashDestination,
		evidencePath: crashEvidence,
		frontendPrivateKeyPath: crashLifecyclePrivate,
		frontendPublicKeyPath: crashLifecyclePublic,
		currentClientRevision: revision,
		installedAt: generatedAt,
		...keyOwner
	})
	if (
		existsSync(crashTransfer) ||
		existsSync(crashPending) ||
		!existsSync(crashEvidence)
	) {
		throw new Error(
			'Backend trust bootstrap did not recover a linked publish'
		)
	}

	const partialRootPath = join(temporaryRoot, 'backend-trust-partial')
	mkdirSync(partialRootPath, { mode: 0o700 })
	const partialRoot = realpathSync(partialRootPath)
	const partialLifecyclePrivate = join(
		partialRoot,
		'lifecycle.private.pem'
	)
	const partialLifecyclePublic = join(partialRoot, 'lifecycle.public.pem')
	provisionSigningKeyPairForOwner(
		partialLifecyclePrivate,
		partialLifecyclePublic,
		keyOwner
	)
	const partialDestination = join(partialRoot, 'backend.public.pem')
	writeFileSync(partialDestination, backendPublicRaw, { mode: 0o600 })
	chmodSync(partialDestination, 0o600)
	expectFailure('unrecoverable-backend-trust-partial', () =>
		bootstrapBackendTrustForOwner({
			sourcePath: join(partialRoot, 'missing.transfer.pem'),
			destinationPath: partialDestination,
			evidencePath: join(partialRoot, 'missing-evidence.json'),
			frontendPrivateKeyPath: partialLifecyclePrivate,
			frontendPublicKeyPath: partialLifecyclePublic,
			currentClientRevision: revision,
			...keyOwner
		})
	)

	const deploymentHealth = Buffer.from(
		JSON.stringify({ service: 'api', revision })
	)
	if (
		validateBackendDeploymentHealthRaw(deploymentHealth).revision !==
		revision
	) {
		throw new Error('Backend deployment health revision was not parsed')
	}
	expectFailure('backend-health-key-order', () =>
		validateBackendDeploymentHealthRaw(
			Buffer.from(JSON.stringify({ revision, service: 'api' }))
		)
	)
	const clientReadyValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-ready',
		serverRevision: revision,
		ownershipPhase: 'ACTIVE',
		identityDatabaseId: '123e4567-e89b-12d3-a456-426614174000',
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
		ownershipActivatedAt: '2026-08-14T23:59:00.000Z',
		generatedAt: '2026-08-15T00:00:00.000Z',
		expiresAt: '2026-08-15T02:00:00.000Z'
	}
	const clientReadyRaw = Buffer.from(JSON.stringify(clientReadyValue))
	const clientReadySignature = Buffer.from(
		`${sign(null, clientReadyRaw, backendSigning.privateKey).toString('base64')}\n`
	)
	verifyBackendClientReadyAttestation(
		clientReadyRaw,
		clientReadySignature,
		backendPublicPath,
		{
			expectedServerRevision: revision,
			nowMs: Date.parse('2026-08-15T01:00:00.000Z')
		}
	)
	const mutateClientReady = overrides =>
		Buffer.from(JSON.stringify({ ...clientReadyValue, ...overrides }))
	expectFailure('backend-client-ready-wrong-signature', () =>
		verifyBackendClientReadyAttestation(
			clientReadyRaw,
			signature,
			backendPublicPath,
			{
				expectedServerRevision: revision,
				nowMs: Date.parse('2026-08-15T01:00:00.000Z')
			}
		)
	)
	expectFailure('backend-client-ready-expired', () =>
		validateBackendClientReadyRaw(
			mutateClientReady({
				ownershipActivatedAt: '2026-08-14T20:59:00.000Z',
				generatedAt: '2026-08-14T21:00:00.000Z',
				expiresAt: '2026-08-14T23:00:00.000Z'
			}),
			{
				expectedServerRevision: revision,
				nowMs: Date.parse('2026-08-15T01:00:00.000Z')
			}
		)
	)
	expectFailure('backend-client-ready-future', () =>
		validateBackendClientReadyRaw(
			mutateClientReady({
				generatedAt: '2026-08-15T01:03:00.000Z',
				expiresAt: '2026-08-15T03:03:00.000Z'
			}),
			{
				expectedServerRevision: revision,
				nowMs: Date.parse('2026-08-15T01:00:00.000Z')
			}
		)
	)
	expectFailure('backend-client-ready-wrong-lifetime', () =>
		validateBackendClientReadyRaw(
			mutateClientReady({
				expiresAt: '2026-08-15T02:01:00.000Z'
			}),
			{
				expectedServerRevision: revision,
				nowMs: Date.parse('2026-08-15T01:00:00.000Z')
			}
		)
	)
	expectFailure('backend-client-ready-nonpositive-lifetime', () =>
		validateBackendClientReadyRaw(
			mutateClientReady({
				expiresAt: clientReadyValue.generatedAt
			}),
			{
				expectedServerRevision: revision,
				nowMs: Date.parse('2026-08-14T23:59:59.999Z')
			}
		)
	)
	for (const [label, overrides] of [
		['not-active', { ownershipPhase: 'READY' }],
		['legacy-references', { legacyReferenceMatches: 1 }],
		['writer-not-fenced', { legacyFileWriterFenced: false }],
		[
			'malformed-database-id',
			{ identityDatabaseId: '123e4567-e89b-02d3-7456-426614174000' }
		]
	]) {
		expectFailure(`backend-client-ready-${label}`, () =>
			validateBackendClientReadyRaw(mutateClientReady(overrides), {
				expectedServerRevision: revision,
				nowMs: Date.parse('2026-08-15T01:00:00.000Z')
			})
		)
	}
	expectFailure('backend-client-ready-live-revision', () =>
		validateBackendClientReadyRaw(clientReadyRaw, {
			expectedServerRevision: descendantRevision,
			nowMs: Date.parse('2026-08-15T01:00:00.000Z')
		})
	)

	const switchReceiptPath = join(trustRoot, 'client-switch-v1.json')
	const archivedClientReadyPath = join(
		trustRoot,
		'archived-client-ready-v1.json'
	)
	const archivedClientReadySignaturePath = join(
		trustRoot,
		'archived-client-ready-v1.json.sig'
	)
	createClientSwitchReceiptForOwner({
		receiptPath: switchReceiptPath,
		archiveAttestationPath: archivedClientReadyPath,
		archiveSignaturePath: archivedClientReadySignaturePath,
		clientReadyRaw,
		clientReadySignatureRaw: clientReadySignature,
		backendPublicKeyPath: backendPublicPath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		clientRevision: revision,
		releaseEvidenceSha256: sha256(manifest),
		expectedBackendServerRevision: revision,
		expectedClientReadySha256: sha256(clientReadyRaw),
		expectedClientReadySignatureSha256: sha256(clientReadySignature),
		clientProcessStartedAt: '2026-08-01T00:59:00.000Z',
		soakPinnedAt: '2026-08-15T01:00:00.000Z',
		...keyOwner
	})
	const switchReceiptRaw = readFileSync(switchReceiptPath)
	const switchReceipt = validateClientSwitchReceiptRaw(switchReceiptRaw, {
		backendPublicKeyRaw: backendPublicRaw,
		frontendLifecyclePublicKeyPath: lifecyclePublicKeyPath,
		nowMs: Date.parse('2026-08-15T01:00:00.000Z')
	})
	if (
		switchReceipt.state !== 'soak-pinned' ||
		JSON.stringify(Object.keys(switchReceipt)) !==
			JSON.stringify([
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
			])
	) {
		throw new Error('Client switch receipt schema drifted')
	}
	const malformedReceiptPayload = {
		...switchReceipt,
		identityDatabaseId: '123e4567-e89b-02d3-7456-426614174000'
	}
	delete malformedReceiptPayload.signature
	const malformedReceiptRaw = Buffer.from(
		JSON.stringify({
			...malformedReceiptPayload,
			signature: sign(
				null,
				Buffer.from(JSON.stringify(malformedReceiptPayload)),
				readFileSync(lifecyclePrivateKeyPath)
			).toString('base64')
		})
	)
	expectFailure('client-switch-receipt-malformed-database-id', () =>
		validateClientSwitchReceiptRaw(malformedReceiptRaw, {
			backendPublicKeyRaw: backendPublicRaw,
			frontendLifecyclePublicKeyPath: lifecyclePublicKeyPath,
			nowMs: Date.parse('2026-08-15T01:00:00.000Z')
		})
	)
	const archivePaths = () => ({
		attestationPath: archivedClientReadyPath,
		signaturePath: archivedClientReadySignaturePath
	})
	if (
		readClientSwitchGuardForOwner({
			receiptPath: switchReceiptPath,
			backendPublicKeyPath: backendPublicPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: revision,
			...keyOwner,
			isRevisionAncestor: () => true,
			archivePaths
		}) !== 'soak-pinned' ||
		readClientSwitchGuardForOwner({
			receiptPath: switchReceiptPath,
			backendPublicKeyPath: backendPublicPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: descendantRevision,
			...keyOwner,
			isRevisionAncestor: () => true,
			archivePaths
		}) !== 'cleanup-required'
	) {
		throw new Error(
			'Client switch soak guard did not pin the initial revision'
		)
	}
	const expiryReceiptPath = join(trustRoot, 'expiry-switch-v1.json')
	expectFailure('client-ready-exact-expiry-boundary', () =>
		createClientSwitchReceiptForOwner({
			receiptPath: expiryReceiptPath,
			archiveAttestationPath: join(trustRoot, 'expiry-ready.json'),
			archiveSignaturePath: join(trustRoot, 'expiry-ready.json.sig'),
			clientReadyRaw,
			clientReadySignatureRaw: clientReadySignature,
			backendPublicKeyPath: backendPublicPath,
			frontendPrivateKeyPath: lifecyclePrivateKeyPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			clientRevision: revision,
			releaseEvidenceSha256: sha256(manifest),
			expectedBackendServerRevision: revision,
			expectedClientReadySha256: sha256(clientReadyRaw),
			expectedClientReadySignatureSha256: sha256(clientReadySignature),
			clientProcessStartedAt: '2026-08-15T01:59:00.000Z',
			soakPinnedAt: '2026-08-15T02:00:00.000Z',
			...keyOwner
		})
	)
	if (existsSync(expiryReceiptPath)) {
		throw new Error('Expired client-ready created a switch receipt')
	}

	const cleanupRevision = 'c'.repeat(40)
	const cleanupRuntimeRevision = 'd'.repeat(40)
	const cleanupCompletedAt = '2026-08-15T02:05:00Z'
	const cleanupNow = Date.parse('2026-08-15T02:06:00.000Z')
	const cleanupReleaseRoot = join(trustRoot, 'cleanup-release')
	const cleanupReleaseDirectory = join(cleanupReleaseRoot, revision)
	const cleanupRuntimePrivateRoot = join(
		trustRoot,
		'cleanup-runtime-private'
	)
	const cleanupRuntimePrivateDirectory = join(
		cleanupRuntimePrivateRoot,
		revision
	)
	mkdirSync(cleanupReleaseDirectory, { recursive: true })
	mkdirSync(cleanupRuntimePrivateDirectory, { recursive: true })
	const cleanupArchivePaths = clientRevision => ({
		attestationPath: join(
			cleanupReleaseRoot,
			clientRevision,
			'backend-cleanup-complete-v1.json'
		),
		signaturePath: join(
			cleanupReleaseRoot,
			clientRevision,
			'backend-cleanup-complete-v1.json.sig'
		)
	})
	const cleanupReleaseSignature = Buffer.from(
		`${sign(
			null,
			manifest,
			readFileSync(lifecyclePrivateKeyPath)
		).toString('base64')}\n`
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'release-evidence-v1.json'),
		manifest,
		{ mode: 0o644 }
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'release-evidence-v1.json.sig'),
		cleanupReleaseSignature,
		{ mode: 0o644 }
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'release-full-manifest-v1.json'),
		fullManifest,
		{ mode: 0o600 }
	)
	const cleanupImageId = `sha256:${'5'.repeat(64)}`
	writeFileSync(
		join(cleanupReleaseRoot, `.image-adoption-${revision}-v1.json`),
		Buffer.from(
			JSON.stringify({
				schemaVersion: 1,
				kind: 'identity-avatar-client-image-adoption',
				clientRevision: revision,
				imageId: cleanupImageId,
				fullManifestSha256: compactValue.fullManifestSha256,
				releaseEvidenceSha256: sha256(manifest)
			})
		),
		{ mode: 0o600 }
	)
	const cleanupImageProof = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-image-adoption-v1',
			clientRevision: revision,
			clientImageId: cleanupImageId,
			releaseEvidenceSha256: sha256(manifest),
			releaseEvidenceSignatureSha256: sha256(cleanupReleaseSignature),
			releaseTreeSha256: compactValue.treeSha256,
			releaseFullManifestSha256: compactValue.fullManifestSha256,
			candidateTreeSha256: '6'.repeat(64),
			clientLifecycleContractSha256: '7'.repeat(64),
			adoptedAt: '2026-08-15T00:59:30.000Z'
		})
	)
	const cleanupImageProofSignature = Buffer.from(
		`${sign(
			null,
			cleanupImageProof,
			readFileSync(lifecyclePrivateKeyPath)
		).toString('base64')}\n`
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'image-adoption-v1.json'),
		cleanupImageProof,
		{ mode: 0o644 }
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'image-adoption-v1.json.sig'),
		cleanupImageProofSignature,
		{ mode: 0o644 }
	)
	writeFileSync(
		join(cleanupRuntimePrivateDirectory, 'image-adoption-v1.json'),
		cleanupImageProof,
		{ mode: 0o600 }
	)
	writeFileSync(
		join(cleanupRuntimePrivateDirectory, 'image-adoption-v1.json.sig'),
		cleanupImageProofSignature,
		{ mode: 0o600 }
	)
	const cleanupFrontendBinding = {
		bindingKind: 'initial-client-switch',
		evidenceSha256: sha256(cleanupImageProof),
		evidenceSignatureSha256: sha256(cleanupImageProofSignature),
		clientRevision: revision,
		imageId: cleanupImageId,
		releaseEvidenceSha256: sha256(manifest),
		releaseEvidenceSignatureSha256: sha256(cleanupReleaseSignature),
		releaseTreeSha256: compactValue.treeSha256,
		releaseFullManifestSha256: compactValue.fullManifestSha256,
		processStartedAt: '2026-08-01T00:59:00.000Z'
	}
	const cleanupValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-core-cleanup-complete',
		cleanupPhase: 'COMPLETE',
		ownershipRevision: revision,
		currentRuntimeRevision: cleanupRuntimeRevision,
		cleanupRevision,
		initialClientRevision: revision,
		currentClientRevision: revision,
		identityDatabaseId: clientReadyValue.identityDatabaseId,
		ownershipMarkerSha256: '8'.repeat(64),
		runtimeStabilityCurrentEvidenceSha256: '9'.repeat(64),
		runtimeStabilityCurrentEvidenceSignatureSha256: 'a'.repeat(64),
		runtimeStabilityGeneration: 0,
		runtimeStabilityEvidenceSha256: 'b'.repeat(64),
		runtimeStabilityLedgerGeneration: 0,
		runtimeStabilityLedgerTailState: 'applied',
		runtimeStabilityLedgerTailEvidenceSha256: 'b'.repeat(64),
		runtimeStableSince: '2026-08-08T02:00:00Z',
		currentClientBindingEvidenceSha256: 'a'.repeat(64),
		runtimeRetargetEvidenceSha256: 'd'.repeat(64),
		clientRetargetEvidenceSha256: 'pending',
		frontendBinding: cleanupFrontendBinding,
		clientReadyEvidenceSha256: sha256(clientReadyRaw),
		clientReadyEvidenceSignatureSha256: sha256(clientReadySignature),
		clientSwitchEvidenceSha256: 'a'.repeat(64),
		soakEvidenceSha256: 'b'.repeat(64),
		preClientReferenceZeroEvidenceSha256: 'c'.repeat(64),
		predeployUploadsHandoffSha256: 'd'.repeat(64),
		cleanupRetargetEvidenceSha256: 'e'.repeat(64),
		cleanupReferenceZeroEvidenceSha256: 'f'.repeat(64),
		writerFenceEvidenceSha256: '0'.repeat(64),
		retirementEvidenceSha256: '1'.repeat(64),
		retirementConsumerRecoveryEvidenceCount: 0,
		retirementConsumerRecoveryEvidenceAggregateSha256: '2'.repeat(64),
		revocationEvidenceSha256: '3'.repeat(64),
		nginxEvidenceSha256: '4'.repeat(64),
		smokeEvidenceSha256: '5'.repeat(64),
		coreCleanupImageId: `sha256:${'6'.repeat(64)}`,
		legacyReferencesAbsent: true,
		legacyRoutesAbsent: true,
		legacyObjectsRetired: true,
		ownershipActive: true,
		completedAt: cleanupCompletedAt
	}
	const cleanupRaw = Buffer.from(JSON.stringify(cleanupValue))
	if (
		verifyCleanupFrontendBindingForOwner({
			cleanup: cleanupValue,
			receipt: switchReceipt,
			releaseRoot: cleanupReleaseRoot,
			privateRoot: cleanupRuntimePrivateRoot,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			backendPublicKeyPath: backendPublicPath,
			owner: {
				uid: keyOwner.expectedUid,
				gid: keyOwner.expectedGid
			}
		}) !== cleanupFrontendBinding
	) {
		throw new Error(
			'Initial cleanup frontend binding was not verified locally'
		)
	}
	const cleanupSignature = Buffer.from(
		`${sign(null, cleanupRaw, backendSigning.privateKey).toString('base64')}\n`
	)
	verifyBackendCleanupCompleteAttestation(
		cleanupRaw,
		cleanupSignature,
		backendPublicPath,
		{ nowMs: cleanupNow }
	)
	const mutateCleanup = overrides =>
		Buffer.from(JSON.stringify({ ...cleanupValue, ...overrides }))
	expectFailure('cleanup-complete-wrong-signature', () =>
		verifyBackendCleanupCompleteAttestation(
			cleanupRaw,
			signature,
			backendPublicPath,
			{ nowMs: cleanupNow }
		)
	)
	expectFailure('cleanup-complete-future', () =>
		validateBackendCleanupCompleteRaw(
			mutateCleanup({ completedAt: '2026-08-15T02:09:00Z' }),
			{ nowMs: cleanupNow }
		)
	)
	expectFailure('cleanup-complete-same-ownership-revision', () =>
		validateBackendCleanupCompleteRaw(
			mutateCleanup({ cleanupRevision: revision }),
			{ nowMs: cleanupNow }
		)
	)
	expectFailure('cleanup-complete-malformed-database-id', () =>
		validateBackendCleanupCompleteRaw(
			mutateCleanup({
				identityDatabaseId: '123e4567-e89b-02d3-7456-426614174000'
			}),
			{ nowMs: cleanupNow }
		)
	)
	for (const [label, overrides] of [
		['runtime-retarget-null', { runtimeRetargetEvidenceSha256: null }],
		['client-retarget-null', { clientRetargetEvidenceSha256: null }],
		[
			'runtime-stable-milliseconds',
			{ runtimeStableSince: '2026-08-08T02:00:00.000Z' }
		],
		[
			'completed-milliseconds',
			{ completedAt: '2026-08-15T02:05:00.000Z' }
		],
		[
			'frontend-process-seconds',
			{
				frontendBinding: {
					...cleanupFrontendBinding,
					processStartedAt: '2026-08-01T00:59:00Z'
				}
			}
		],
		[
			'runtime-retarget-pending-after-change',
			{ runtimeRetargetEvidenceSha256: 'pending' }
		],
		[
			'initial-client-binding-record-mismatch',
			{ currentClientBindingEvidenceSha256: 'f'.repeat(64) }
		],
		[
			'client-retarget-pending-after-change',
			{
				currentClientRevision: descendantRevision,
				clientRetargetEvidenceSha256: 'pending',
				currentClientBindingEvidenceSha256: 'pending',
				frontendBinding: {
					...cleanupFrontendBinding,
					bindingKind: 'client-code-retarget',
					clientRevision: descendantRevision
				}
			}
		],
		[
			'aborted-ledger-without-next-generation',
			{ runtimeStabilityLedgerTailState: 'aborted' }
		],
		[
			'recovery-evidence-count-overflow',
			{ retirementConsumerRecoveryEvidenceCount: 65 }
		]
	]) {
		expectFailure(`cleanup-complete-${label}`, () =>
			validateBackendCleanupCompleteRaw(mutateCleanup(overrides), {
				nowMs: cleanupNow
			})
		)
	}
	const { schemaVersion: cleanupSchemaVersion, ...cleanupWithoutVersion } =
		cleanupValue
	expectFailure('cleanup-complete-reordered-keys', () =>
		validateBackendCleanupCompleteRaw(
			Buffer.from(
				JSON.stringify({
					...cleanupWithoutVersion,
					schemaVersion: cleanupSchemaVersion
				})
			),
			{ nowMs: cleanupNow }
		)
	)
	const cleanupWithoutSmoke = { ...cleanupValue }
	delete cleanupWithoutSmoke.smokeEvidenceSha256
	expectFailure('cleanup-complete-missing-key', () =>
		validateBackendCleanupCompleteRaw(
			Buffer.from(JSON.stringify(cleanupWithoutSmoke)),
			{ nowMs: cleanupNow }
		)
	)
	const cleanupResponse = (raw, contentType, responseRevision) =>
		new Response(raw, {
			status: 200,
			headers: {
				'cache-control': 'no-store, max-age=0',
				'content-type': contentType,
				'x-content-type-options': 'nosniff',
				'x-winwidget-revision': responseRevision
			}
		})
	let sameRevisionFetchCount = 0
	const sameRevisionPrefetch = await prefetchClientSwitchForOwner({
		receiptPath: switchReceiptPath,
		backendPublicKeyPath: backendPublicPath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		candidateClientRevision: revision,
		...keyOwner,
		fetchImpl: async () => {
			sameRevisionFetchCount += 1
			throw new Error('Same pinned revision must not fetch cleanup')
		},
		nowMs: cleanupNow,
		archivePaths
	})
	if (
		sameRevisionPrefetch !== 'soak-pinned' ||
		sameRevisionFetchCount !== 0
	) {
		throw new Error('Same pinned revision unexpectedly fetched cleanup')
	}
	const changedCleanupRaw = mutateCleanup({
		smokeEvidenceSha256: '6'.repeat(64)
	})
	const unstableResponses = [
		cleanupResponse(
			cleanupRaw,
			'application/json; charset=utf-8',
			cleanupRevision
		),
		cleanupResponse(
			cleanupSignature,
			'application/octet-stream',
			cleanupRevision
		),
		cleanupResponse(
			changedCleanupRaw,
			'application/json; charset=utf-8',
			cleanupRevision
		)
	]
	await expectAsyncFailure('cleanup-complete-unstable-body-pair', () =>
		fetchStableBackendCleanupComplete({
			fetchImpl: async () => unstableResponses.shift(),
			nowMs: cleanupNow
		})
	)
	const wrongClientCleanupRaw = mutateCleanup({
		currentClientRevision: descendantRevision,
		frontendBinding: {
			...cleanupFrontendBinding,
			clientRevision: descendantRevision
		}
	})
	const wrongClientCleanupSignature = Buffer.from(
		`${sign(
			null,
			wrongClientCleanupRaw,
			backendSigning.privateKey
		).toString('base64')}\n`
	)
	await expectAsyncFailure('cleanup-complete-wrong-client-binding', () =>
		verifyAndPromoteClientSwitchReceiptForOwner({
			receiptPath: switchReceiptPath,
			cleanupRaw: wrongClientCleanupRaw,
			cleanupSignatureRaw: wrongClientCleanupSignature,
			backendPublicKeyPath: backendPublicPath,
			frontendPrivateKeyPath: lifecyclePrivateKeyPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			releasedAt: new Date(cleanupNow).toISOString(),
			...keyOwner,
			archivePaths,
			cleanupArchivePaths,
			releaseRoot: cleanupReleaseRoot,
			runtimeRebindPrivateRoot: cleanupRuntimePrivateRoot
		})
	)
	const stableResponses = [
		cleanupResponse(
			cleanupRaw,
			'application/json; charset=utf-8',
			cleanupRevision
		),
		cleanupResponse(
			cleanupSignature,
			'application/octet-stream',
			cleanupRevision
		),
		cleanupResponse(
			cleanupRaw,
			'application/json; charset=utf-8',
			cleanupRevision
		)
	]
	const releasedPrefetch = await prefetchClientSwitchForOwner({
		receiptPath: switchReceiptPath,
		backendPublicKeyPath: backendPublicPath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		candidateClientRevision: descendantRevision,
		...keyOwner,
		fetchImpl: async () => stableResponses.shift(),
		nowMs: cleanupNow,
		archivePaths,
		cleanupArchivePaths,
		releaseRoot: cleanupReleaseRoot,
		runtimeRebindPrivateRoot: cleanupRuntimePrivateRoot
	})
	if (releasedPrefetch !== 'released' || stableResponses.length !== 0) {
		throw new Error('Stable cleanup prefetch did not release the receipt')
	}
	await verifyAndPromoteClientSwitchReceiptForOwner({
		receiptPath: switchReceiptPath,
		cleanupRaw,
		cleanupSignatureRaw: cleanupSignature,
		backendPublicKeyPath: backendPublicPath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		releasedAt: new Date(cleanupNow).toISOString(),
		...keyOwner,
		archivePaths,
		cleanupArchivePaths,
		releaseRoot: cleanupReleaseRoot,
		runtimeRebindPrivateRoot: cleanupRuntimePrivateRoot
	})
	const releasedReceipt = validateClientSwitchReceiptRaw(
		readFileSync(switchReceiptPath),
		{
			backendPublicKeyRaw: backendPublicRaw,
			frontendLifecyclePublicKeyPath: lifecyclePublicKeyPath,
			nowMs: cleanupNow
		}
	)
	if (
		releasedReceipt.state !== 'released' ||
		releasedReceipt.cleanupRevision !== cleanupRevision ||
		releasedReceipt.cleanupClientRevision !== revision ||
		releasedReceipt.cleanupCompleteSha256 !== sha256(cleanupRaw)
	) {
		throw new Error('Cleanup-complete did not release the switch receipt')
	}
	const permanentCleanupPaths = cleanupArchivePaths(revision)
	if (
		!readFileSync(permanentCleanupPaths.attestationPath).equals(
			cleanupRaw
		) ||
		!readFileSync(permanentCleanupPaths.signaturePath).equals(
			cleanupSignature
		) ||
		(statSync(permanentCleanupPaths.attestationPath).mode & 0o777) !==
			0o600 ||
		(statSync(permanentCleanupPaths.signaturePath).mode & 0o777) !== 0o600
	) {
		throw new Error(
			'Permanent cleanup-complete archive is not exact and private'
		)
	}
	const cleanupFinalizationPath = join(
		trustRoot,
		'client-cleanup-finalized-v1.json'
	)
	const cleanupFinalizationSignaturePath = `${cleanupFinalizationPath}.sig`
	const cleanupFinalizationOptions = {
		proofPath: cleanupFinalizationPath,
		proofSignaturePath: cleanupFinalizationSignaturePath,
		receiptPath: switchReceiptPath,
		backendPublicKeyPath: backendPublicPath,
		frontendPrivateKeyPath: lifecyclePrivateKeyPath,
		frontendPublicKeyPath: lifecyclePublicKeyPath,
		...keyOwner,
		archivePaths,
		cleanupArchivePaths
	}
	const cleanupFinalization = writeClientCleanupFinalizationForOwner(
		cleanupFinalizationOptions
	)
	const cleanupFinalizationRaw = readFileSync(cleanupFinalizationPath)
	const cleanupFinalizationSignatureRaw = readFileSync(
		cleanupFinalizationSignaturePath
	)
	if (
		JSON.stringify(Object.keys(cleanupFinalization)) !==
			JSON.stringify([
				'version',
				'kind',
				'state',
				'cleanupRevision',
				'cleanupClientRevision',
				'clientSwitchReceiptSha256',
				'cleanupCompleteSha256',
				'cleanupCompleteSignatureSha256',
				'retiredStateContractSha256'
			]) ||
		cleanupFinalization.state !== 'finalized' ||
		cleanupFinalization.cleanupRevision !== cleanupRevision ||
		cleanupFinalization.cleanupClientRevision !== revision ||
		cleanupFinalization.clientSwitchReceiptSha256 !==
			sha256(readFileSync(switchReceiptPath)) ||
		cleanupFinalization.cleanupCompleteSha256 !== sha256(cleanupRaw) ||
		cleanupFinalization.cleanupCompleteSignatureSha256 !==
			sha256(cleanupSignature) ||
		CLIENT_CLEANUP_RETIRED_STATE_CONTRACT !==
			'v1:units=not-found,inactive,not-found;paths=service,timer,nginx,logrotate,lock:absent;nginx=reloaded-active' ||
		cleanupFinalization.retiredStateContractSha256 !==
			'145bf136b5ea01cd05d1c952cd0619143ff1d07c769df8960195392d2a6d8e34' ||
		(statSync(cleanupFinalizationPath).mode & 0o777) !== 0o600 ||
		statSync(cleanupFinalizationPath).nlink !== 1 ||
		(statSync(cleanupFinalizationSignaturePath).mode & 0o777) !== 0o600 ||
		statSync(cleanupFinalizationSignaturePath).nlink !== 1
	) {
		throw new Error(
			'Client cleanup finalization proof is not exact and private'
		)
	}
	writeClientCleanupFinalizationForOwner(cleanupFinalizationOptions)
	if (
		!readFileSync(cleanupFinalizationPath).equals(
			cleanupFinalizationRaw
		) ||
		!readFileSync(cleanupFinalizationSignaturePath).equals(
			cleanupFinalizationSignatureRaw
		)
	) {
		throw new Error(
			'Cleanup finalization retry changed deterministic bytes'
		)
	}
	rmSync(cleanupFinalizationPath)
	writeClientCleanupFinalizationForOwner(cleanupFinalizationOptions)
	if (
		!readFileSync(cleanupFinalizationPath).equals(
			cleanupFinalizationRaw
		) ||
		!readFileSync(cleanupFinalizationSignaturePath).equals(
			cleanupFinalizationSignatureRaw
		)
	) {
		throw new Error('Signature-first cleanup finalization did not recover')
	}
	rmSync(cleanupFinalizationSignaturePath)
	expectFailure('cleanup-finalization-body-without-signature', () =>
		writeClientCleanupFinalizationForOwner(cleanupFinalizationOptions)
	)
	writeFileSync(
		cleanupFinalizationSignaturePath,
		cleanupFinalizationSignatureRaw,
		{ mode: 0o600 }
	)
	chmodSync(cleanupFinalizationSignaturePath, 0o600)
	const tamperedCleanupFinalization = {
		...cleanupFinalization,
		retiredStateContractSha256: 'f'.repeat(64)
	}
	writeFileSync(
		cleanupFinalizationPath,
		Buffer.from(JSON.stringify(tamperedCleanupFinalization)),
		{ mode: 0o600 }
	)
	expectFailure('cleanup-finalization-contract-drift', () =>
		readClientCleanupFinalizationForOwner(cleanupFinalizationOptions)
	)
	writeFileSync(cleanupFinalizationPath, cleanupFinalizationRaw, {
		mode: 0o600
	})
	readClientCleanupFinalizationForOwner(cleanupFinalizationOptions)
	const proofBoundReceiptRaw = readFileSync(switchReceiptPath)
	const {
		signature: proofBoundReceiptSignature,
		...proofBoundReceiptPayload
	} = releasedReceipt
	void proofBoundReceiptSignature
	const driftedReceiptPayload = {
		...proofBoundReceiptPayload,
		releasedAt: '2026-08-15T02:05:30.000Z'
	}
	const driftedReceiptRaw = Buffer.from(
		JSON.stringify({
			...driftedReceiptPayload,
			signature: sign(
				null,
				Buffer.from(JSON.stringify(driftedReceiptPayload)),
				readFileSync(lifecyclePrivateKeyPath)
			).toString('base64')
		})
	)
	writeFileSync(switchReceiptPath, driftedReceiptRaw)
	try {
		expectFailure('cleanup-finalization-receipt-drift', () =>
			readClientCleanupFinalizationForOwner(cleanupFinalizationOptions)
		)
	} finally {
		writeFileSync(switchReceiptPath, proofBoundReceiptRaw)
	}
	let releasedAncestryRoot = null
	if (
		readClientSwitchGuardForOwner({
			receiptPath: switchReceiptPath,
			backendPublicKeyPath: backendPublicPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: descendantRevision,
			...keyOwner,
			isRevisionAncestor: (ancestor, current) => {
				releasedAncestryRoot = ancestor
				return ancestor === revision && current === descendantRevision
			},
			archivePaths,
			cleanupArchivePaths
		}) !== 'released' ||
		releasedAncestryRoot !== revision
	) {
		throw new Error('Released switch receipt did not allow a descendant')
	}
	expectFailure('released-switch-foreign-revision', () =>
		readClientSwitchGuardForOwner({
			receiptPath: switchReceiptPath,
			backendPublicKeyPath: backendPublicPath,
			frontendPublicKeyPath: lifecyclePublicKeyPath,
			currentClientRevision: descendantRevision,
			...keyOwner,
			isRevisionAncestor: () => false,
			archivePaths,
			cleanupArchivePaths
		})
	)
	const archivedCleanupBackup = `${permanentCleanupPaths.attestationPath}.backup`
	renameSync(permanentCleanupPaths.attestationPath, archivedCleanupBackup)
	try {
		expectFailure('released-switch-missing-cleanup-archive-body', () =>
			readClientSwitchGuardForOwner({
				receiptPath: switchReceiptPath,
				backendPublicKeyPath: backendPublicPath,
				frontendPublicKeyPath: lifecyclePublicKeyPath,
				currentClientRevision: descendantRevision,
				...keyOwner,
				isRevisionAncestor: () => true,
				archivePaths,
				cleanupArchivePaths
			})
		)
	} finally {
		renameSync(
			archivedCleanupBackup,
			permanentCleanupPaths.attestationPath
		)
	}
	writeFileSync(
		permanentCleanupPaths.attestationPath,
		Buffer.from(`${cleanupRaw.toString('utf8')} `)
	)
	try {
		expectFailure('released-switch-tampered-cleanup-archive', () =>
			readClientSwitchGuardForOwner({
				receiptPath: switchReceiptPath,
				backendPublicKeyPath: backendPublicPath,
				frontendPublicKeyPath: lifecyclePublicKeyPath,
				currentClientRevision: descendantRevision,
				...keyOwner,
				isRevisionAncestor: () => true,
				archivePaths,
				cleanupArchivePaths
			})
		)
	} finally {
		writeFileSync(permanentCleanupPaths.attestationPath, cleanupRaw)
	}
	const releasedReceiptRaw = readFileSync(switchReceiptPath)
	const tamperedReceipt = JSON.parse(releasedReceiptRaw.toString('utf8'))
	tamperedReceipt.cleanupClientRevision = descendantRevision
	writeFileSync(
		switchReceiptPath,
		Buffer.from(JSON.stringify(tamperedReceipt))
	)
	try {
		expectFailure('released-switch-tampered-receipt', () =>
			readClientSwitchGuardForOwner({
				receiptPath: switchReceiptPath,
				backendPublicKeyPath: backendPublicPath,
				frontendPublicKeyPath: lifecyclePublicKeyPath,
				currentClientRevision: descendantRevision,
				...keyOwner,
				isRevisionAncestor: () => true,
				archivePaths,
				cleanupArchivePaths
			})
		)
	} finally {
		writeFileSync(switchReceiptPath, releasedReceiptRaw)
	}

	const deployScript = readFileSync(
		new URL('./deploy-production.sh', import.meta.url),
		'utf8'
	)
	const earlySwitchGuardIndex = deployScript.indexOf(
		'identity_avatar_switch_action="$(\n\tnode "$identity_avatar_release_tool" client-switch-guard'
	)
	const releasedRetargetFenceIndex = deployScript.indexOf(
		'if [[ "$identity_avatar_switch_action" != \'released\' ]]; then\n\tidentity_avatar_require_guard_tool',
		earlySwitchGuardIndex
	)
	const firstRetargetGuardIndex = deployScript.indexOf(
		'node "$identity_avatar_retarget_tool" guard',
		earlySwitchGuardIndex
	)
	const firstComposeMutationIndex = deployScript.indexOf(
		'stage_container_id="$(compose ps -q client)"'
	)
	const releasedStateIndex = deployScript.indexOf(
		'if [[ "$identity_avatar_switch_action" == \'released\' ]]; then',
		earlySwitchGuardIndex + 1
	)
	const finalizeConfirmationIndex = deployScript.indexOf(
		'if [[ "$deployment_mode" == \'finalize-avatar-cleanup\' ]]; then'
	)
	const lockAcquireIndex = deployScript.indexOf(
		"acquire_frontend_production_deploy_lock 'frontend deployment'"
	)
	const finalizeIndex = finalizeConfirmationIndex
	const cleanupBoundaryIndex = deployScript.indexOf(
		'if [[ "$deployment_mode" != \'deploy\' ]]; then',
		earlySwitchGuardIndex
	)
	const releasedTeardownIndex = deployScript.indexOf(
		'if [[ "$identity_avatar_cleanup_released" == \'true\' ]]; then',
		cleanupBoundaryIndex + 1
	)
	const releasedPrebuildEndIndex = deployScript.indexOf(
		'elif [[ "$identity_avatar_runtime_rebind_action" == \'none\' &&',
		releasedTeardownIndex
	)
	const readOnlyFinalizationFunctionIndex = deployScript.indexOf(
		'identity_avatar_print_cleanup_finalize_instruction() {'
	)
	const mutatingFinalizationFunctionIndex = deployScript.indexOf(
		'identity_avatar_remove_retired_log_soak() {'
	)
	const mutatingFinalizationFunctionEndIndex = deployScript.indexOf(
		'identity_avatar_require_guard_tool \\',
		mutatingFinalizationFunctionIndex
	)
	const releasedComposeDeployIndex = deployScript.indexOf(
		'if [[ "$identity_avatar_cleanup_released" == \'true\' ]]; then\n\tidentity_avatar_image_id="$('
	)
	const activeProvisionIndex = deployScript.indexOf(
		'node "$identity_avatar_release_tool" provision-signing-key'
	)
	const finalizerSlice = deployScript.slice(
		earlySwitchGuardIndex,
		releasedRetargetFenceIndex
	)
	const finalizeConfirmationSlice = deployScript.slice(
		finalizeConfirmationIndex,
		lockAcquireIndex
	)
	const releasedPrebuildSlice = deployScript.slice(
		releasedTeardownIndex,
		releasedPrebuildEndIndex
	)
	const readOnlyFinalizationFunction = deployScript.slice(
		readOnlyFinalizationFunctionIndex,
		mutatingFinalizationFunctionIndex
	)
	const mutatingFinalizationFunction = deployScript.slice(
		mutatingFinalizationFunctionIndex,
		mutatingFinalizationFunctionEndIndex
	)
	const releasedDeploySlice = deployScript.slice(
		releasedComposeDeployIndex,
		activeProvisionIndex
	)
	if (
		!deployScript.includes(
			'bootstrap-backend-trust \\\n\t--revision "$APP_REVISION"'
		) ||
		!deployScript.includes('client-switch-guard') ||
		!deployScript.includes('[[ "${nosniff,,}" != \'nosniff\' ]]') ||
		earlySwitchGuardIndex < 0 ||
		releasedRetargetFenceIndex < 0 ||
		firstRetargetGuardIndex < 0 ||
		earlySwitchGuardIndex > releasedRetargetFenceIndex ||
		releasedRetargetFenceIndex > firstRetargetGuardIndex ||
		firstComposeMutationIndex < 0 ||
		earlySwitchGuardIndex > firstComposeMutationIndex ||
		releasedStateIndex < 0 ||
		finalizeConfirmationIndex < 0 ||
		lockAcquireIndex < 0 ||
		finalizeIndex < 0 ||
		cleanupBoundaryIndex < 0 ||
		releasedTeardownIndex < 0 ||
		releasedPrebuildEndIndex < 0 ||
		readOnlyFinalizationFunctionIndex < 0 ||
		mutatingFinalizationFunctionIndex < 0 ||
		mutatingFinalizationFunctionEndIndex < 0 ||
		releasedComposeDeployIndex < 0 ||
		activeProvisionIndex < 0 ||
		finalizeConfirmationIndex > lockAcquireIndex ||
		finalizeIndex > earlySwitchGuardIndex ||
		earlySwitchGuardIndex > cleanupBoundaryIndex ||
		cleanupBoundaryIndex > releasedRetargetFenceIndex ||
		releasedRetargetFenceIndex > releasedStateIndex ||
		releasedStateIndex > releasedTeardownIndex ||
		releasedTeardownIndex > releasedPrebuildEndIndex ||
		releasedTeardownIndex > firstComposeMutationIndex ||
		releasedComposeDeployIndex > activeProvisionIndex ||
		!deployScript.includes('--finalize-avatar-cleanup') ||
		!deployScript.includes('identity_avatar_remove_retired_log_soak') ||
		!deployScript.includes('create-client-switch-receipt') ||
		!deployScript.includes('identity_avatar_backend_client_ready_sha256=')
	) {
		throw new Error(
			'Backend activation gate is not ordered before client mutation'
		)
	}
	const resolverEndIndex = deployScript.indexOf(
		'case "$identity_avatar_switch_action" in',
		earlySwitchGuardIndex
	)
	const releasedResolverFixture = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_release_tool='/fixture/release.mjs'
identity_avatar_retarget_tool='/fixture/missing-retarget.mjs'
identity_avatar_switch_receipt='/fixture/receipt.json'
identity_avatar_runtime_rebind_action='none'
deployment_mode='deploy'
APP_REVISION='${revision}'
client_root='/fixture/client'
identity_avatar_require_guard_tool() {
  echo 'retired retarget tool was required' >&2
  return 91
}
node() {
  if [[ "$1" == "$identity_avatar_release_tool" && "$2" == 'client-switch-guard' ]]; then
    printf 'released'
    return 0
  fi
  echo 'retired retarget tool was called' >&2
  return 92
}
${deployScript.slice(earlySwitchGuardIndex, resolverEndIndex)}
printf '%s' "$identity_avatar_switch_action"`
		],
		{ encoding: 'utf8' }
	)
	if (releasedResolverFixture !== 'released') {
		throw new Error(
			'Released resolver depended on the retired retarget tool'
		)
	}
	const releasedPrebuildBody = releasedPrebuildSlice.slice(
		releasedPrebuildSlice.indexOf('\n') + 1
	)
	const releasedPrebuildSuccess = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_assert_signing_key_retained() { :; }
identity_avatar_assert_retired_log_soak_finalized() { printf 'read-only-finalized-check\n'; }
identity_avatar_remove_retired_log_soak() { echo 'unexpected teardown' >&2; return 95; }
${releasedPrebuildBody}
printf 'released-prebuild-complete\n'`
		],
		{ encoding: 'utf8' }
	)
	if (
		releasedPrebuildSuccess !==
		'read-only-finalized-check\nreleased-prebuild-complete\n'
	) {
		throw new Error(
			'Ordinary released prebuild invoked a mutating cleanup path'
		)
	}
	const releasedPrebuildFailure = spawnSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_assert_signing_key_retained() { :; }
identity_avatar_assert_retired_log_soak_finalized() { echo 'not finalized' >&2; return 94; }
identity_avatar_remove_retired_log_soak() { echo 'unexpected teardown' >&2; return 95; }
${releasedPrebuildBody}
printf 'build-or-compose-reached\n'`
		],
		{ encoding: 'utf8' }
	)
	if (
		releasedPrebuildFailure.status !== 94 ||
		releasedPrebuildFailure.stdout.includes('build-or-compose-reached') ||
		releasedPrebuildFailure.stderr.includes('unexpected teardown')
	) {
		throw new Error(
			'Unfinalized released deploy did not fail before mutation'
		)
	}
	const readOnlyFinalizationFixture = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_soak_service='/fixture/absent-soak.service'
identity_avatar_soak_timer='/fixture/absent-soak.timer'
identity_avatar_nginx_config_target='/fixture/absent-soak.nginx'
identity_avatar_logrotate_target='/fixture/absent-soak.logrotate'
identity_avatar_soak_lock='/fixture/absent-soak.lock'
identity_avatar_release_tool='/fixture/release.mjs'
APP_REVISION='${revision}'
client_root='/fixture/client'
systemctl() {
  case "$1" in
    show) printf 'not-found\n' ;;
    is-active)
      if [[ "$2" == 'nginx.service' ]]; then printf 'active\n'; else printf 'inactive\n'; return 3; fi
      ;;
    is-enabled) printf 'not-found\n'; return 1 ;;
    *) echo 'mutating systemctl command' >&2; return 97 ;;
  esac
}
node() {
  if [[ "$1" == "$identity_avatar_release_tool" && "$2" == 'verify-cleanup-finalization' ]]; then
    printf 'finalized'
    return 0
  fi
  echo 'unexpected proof verifier command' >&2
  return 98
}
${readOnlyFinalizationFunction}
identity_avatar_assert_retired_log_soak_finalized
printf 'read-only-assertion-passed'`
		],
		{ encoding: 'utf8' }
	)
	if (readOnlyFinalizationFixture !== 'read-only-assertion-passed') {
		throw new Error(
			'Read-only cleanup finalization assertion rejected absence'
		)
	}
	const invalidUnitStateFixture = spawnSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_soak_service='/fixture/absent-soak.service'
identity_avatar_soak_timer='/fixture/absent-soak.timer'
identity_avatar_nginx_config_target='/fixture/absent-soak.nginx'
identity_avatar_logrotate_target='/fixture/absent-soak.logrotate'
identity_avatar_soak_lock='/fixture/absent-soak.lock'
identity_avatar_release_tool='/fixture/release.mjs'
APP_REVISION='${revision}'
client_root='/fixture/client'
systemctl() {
  case "$1" in
    show) printf 'not-found\n' ;;
    is-active) printf 'unknown\n'; return 3 ;;
    is-enabled) printf 'not-found\n'; return 1 ;;
    *) return 97 ;;
  esac
}
node() {
  case "$2" in
    read-released-client-switch-binding) printf '${cleanupRevision} ${revision} ${'1'.repeat(64)} ${'2'.repeat(64)} ${'3'.repeat(64)}' ;;
    verify-cleanup-finalization) printf 'finalized' ;;
    *) return 98 ;;
  esac
}
${readOnlyFinalizationFunction}
identity_avatar_assert_retired_log_soak_finalized`
		],
		{ encoding: 'utf8' }
	)
	if (
		invalidUnitStateFixture.status === 0 ||
		!invalidUnitStateFixture.stderr.includes(
			'Retired frontend log-soak cleanup is not finalized'
		)
	) {
		throw new Error(
			'Read-only cleanup assertion accepted an unknown unit state'
		)
	}
	const missingFinalizationFixture = spawnSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_soak_service='${switchReceiptPath}'
identity_avatar_soak_timer='/fixture/absent-soak.timer'
identity_avatar_nginx_config_target='/fixture/absent-soak.nginx'
identity_avatar_logrotate_target='/fixture/absent-soak.logrotate'
identity_avatar_soak_lock='/fixture/absent-soak.lock'
identity_avatar_release_tool='/fixture/release.mjs'
APP_REVISION='${revision}'
client_root='/fixture/client'
systemctl() {
  case "$1" in
    show) printf 'not-found\n' ;;
    is-active)
      if [[ "$2" == 'nginx.service' ]]; then printf 'active\n'; else printf 'inactive\n'; return 3; fi
      ;;
    is-enabled) printf 'not-found\n'; return 1 ;;
    *) return 97 ;;
  esac
}
node() {
  case "$2" in
    read-released-client-switch-binding) printf '${cleanupRevision} ${revision} ${'1'.repeat(64)} ${'2'.repeat(64)} ${'3'.repeat(64)}' ;;
    verify-cleanup-finalization) printf 'finalized' ;;
    *) return 98 ;;
  esac
}
${readOnlyFinalizationFunction}
identity_avatar_assert_retired_log_soak_finalized
printf 'build-or-compose-reached'`
		],
		{ encoding: 'utf8' }
	)
	if (
		missingFinalizationFixture.status === 0 ||
		missingFinalizationFixture.stdout.includes(
			'build-or-compose-reached'
		) ||
		!missingFinalizationFixture.stderr.includes(
			`Run directly on the VPS from exact frontend checkout ${revision}: EXPECTED_REVISION=${revision}`
		)
	) {
		throw new Error('Missing cleanup finalization did not fail closed')
	}
	const teardownRetryFixture = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
identity_avatar_soak_service='/fixture/absent-soak.service'
identity_avatar_soak_timer='/fixture/absent-soak.timer'
identity_avatar_nginx_config_target='/fixture/absent-soak.nginx'
identity_avatar_logrotate_target='/fixture/absent-soak.logrotate'
identity_avatar_soak_lock='/fixture/absent-soak.lock'
APP_REVISION='${revision}'
client_root='/fixture/client'
systemctl() {
  local target="\${@: -1}"
  case "$1" in
    show) printf 'not-found\n' ;;
    daemon-reload) printf 'daemon-reload\n' ;;
    reload)
      [[ "$target" == 'nginx.service' ]]
      printf 'nginx-reload\n'
      ;;
    is-active)
      if [[ "$target" == 'nginx.service' ]]; then
        [[ "$2" == '--quiet' ]] || printf 'active\n'
        return 0
      fi
      [[ "$2" == '--quiet' ]] || printf 'inactive\n'
      return 3
      ;;
    is-enabled)
      [[ "$2" == '--quiet' ]] || printf 'not-found\n'
      return 1
      ;;
    *) echo "unexpected systemctl mutation: $*" >&2; return 97 ;;
  esac
}
nginx() {
  [[ "$1" == '-t' ]]
  printf 'nginx-test\n'
}
${readOnlyFinalizationFunction}
${mutatingFinalizationFunction}
identity_avatar_remove_retired_log_soak
identity_avatar_remove_retired_log_soak`
		],
		{ encoding: 'utf8' }
	)
	for (const marker of ['daemon-reload', 'nginx-test', 'nginx-reload']) {
		if (
			(teardownRetryFixture.match(new RegExp(marker, 'g')) ?? [])
				.length !== 2
		) {
			throw new Error(
				'Retired cleanup retry did not repair the nginx runtime boundary'
			)
		}
	}
	const directFinalizerFixture = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
deployment_mode='finalize-avatar-cleanup'
identity_avatar_runtime_rebind_action='none'
IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION='FINALIZE IDENTITY AVATAR CLIENT CLEANUP ${revision}'
APP_REVISION='${revision}'
client_root='/fixture/client'
identity_avatar_release_tool='/fixture/release.mjs'
identity_avatar_assert_signing_key_retained() { printf 'key-retained\n'; }
identity_avatar_assert_retired_log_soak_finalized() { echo 'ordinary assertion in finalizer' >&2; return 96; }
identity_avatar_remove_retired_log_soak() { printf 'mutating-teardown-called\n'; }
node() {
  case "$2" in
    client-switch-guard) printf 'released' ;;
    read-released-client-switch-binding) printf '${cleanupRevision} ${revision} ${'1'.repeat(64)} ${'2'.repeat(64)} ${'3'.repeat(64)}' ;;
    write-cleanup-finalization) printf 'finalized' ;;
    *) echo 'unexpected release tool command' >&2; return 97 ;;
  esac
}
${finalizerSlice}`
		],
		{ encoding: 'utf8' }
	)
	if (
		(directFinalizerFixture.match(/mutating-teardown-called/g) ?? [])
			.length !== 1 ||
		(directFinalizerFixture.match(/key-retained/g) ?? []).length !== 2 ||
		!directFinalizerFixture.includes(
			'Identity avatar frontend cleanup finalized for revision:'
		)
	) {
		throw new Error('Direct cleanup finalizer did not own the teardown')
	}
	const unreleasedFinalizerFixture = spawnSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
deployment_mode='finalize-avatar-cleanup'
identity_avatar_runtime_rebind_action='none'
IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION='FINALIZE IDENTITY AVATAR CLIENT CLEANUP ${revision}'
APP_REVISION='${revision}'
client_root='/fixture/client'
identity_avatar_release_tool='/fixture/release.mjs'
identity_avatar_retarget_tool='/fixture/retarget-must-not-run.mjs'
identity_avatar_assert_signing_key_retained() { :; }
identity_avatar_remove_retired_log_soak() { echo 'unexpected teardown' >&2; return 95; }
node() {
  if [[ "$1" == "$identity_avatar_release_tool" && "$2" == 'client-switch-guard' ]]; then
    printf 'cleanup-required'
    return 0
  fi
  echo 'unexpected resolver call' >&2
  return 97
}
${finalizerSlice}`
		],
		{ encoding: 'utf8' }
	)
	if (
		unreleasedFinalizerFixture.status === 0 ||
		unreleasedFinalizerFixture.stderr.includes('unexpected teardown') ||
		unreleasedFinalizerFixture.stderr.includes('unexpected resolver call')
	) {
		throw new Error(
			'Direct finalizer traversed the cleanup prefetch resolver'
		)
	}
	if (
		!finalizeConfirmationSlice.includes(
			'FINALIZE IDENTITY AVATAR CLIENT CLEANUP $EXPECTED_REVISION'
		) ||
		!finalizerSlice.includes('identity_avatar_remove_retired_log_soak') ||
		!finalizerSlice.includes('write-cleanup-finalization') ||
		!finalizerSlice.includes('read-released-client-switch-binding') ||
		(
			finalizerSlice.match(
				/identity_avatar_assert_signing_key_retained/g
			) ?? []
		).length !== 4 ||
		[
			'compose ',
			'docker ',
			'git fetch',
			'git merge',
			'prefetch-cleanup',
			'identity_avatar_retarget_tool',
			'curl '
		].some(fragment => finalizerSlice.includes(fragment))
	) {
		throw new Error(
			'Cleanup finalizer is not a narrow receipt-first teardown'
		)
	}
	if (
		!releasedPrebuildSlice.includes(
			'identity_avatar_assert_retired_log_soak_finalized'
		) ||
		releasedPrebuildSlice.includes(
			'identity_avatar_remove_retired_log_soak'
		) ||
		[
			'systemctl stop',
			'systemctl disable',
			'systemctl daemon-reload',
			'systemctl reload',
			'unlinkSync',
			'rmSync',
			'writeFileSync',
			'compose ',
			'docker '
		].some(fragment => releasedPrebuildSlice.includes(fragment)) ||
		[
			'systemctl stop',
			'systemctl disable',
			'systemctl daemon-reload',
			'systemctl reload',
			'unlinkSync',
			'rmSync',
			'writeFileSync',
			'nginx -t',
			'compose ',
			'docker '
		].some(fragment => readOnlyFinalizationFunction.includes(fragment)) ||
		(deployScript.match(/identity_avatar_remove_retired_log_soak/g) ?? [])
			.length !== 2
	) {
		throw new Error(
			'Ordinary released finalization check is not read-only'
		)
	}
	const entrypointRoot = join(temporaryRoot, 'released-entrypoint')
	const entrypointClientRoot = join(entrypointRoot, 'client')
	const entrypointScriptsRoot = join(entrypointClientRoot, 'scripts')
	const entrypointBinRoot = join(entrypointRoot, 'bin')
	const entrypointCommandLog = join(entrypointRoot, 'commands.log')
	const entrypointReleaseTool = join(
		entrypointScriptsRoot,
		'identity-avatar-client-release-evidence.mjs'
	)
	const entrypointLockTool = join(
		entrypointScriptsRoot,
		'frontend-production-deploy-lock.sh'
	)
	const deployScriptPath = fileURLToPath(
		new URL('./deploy-production.sh', import.meta.url)
	)
	mkdirSync(entrypointScriptsRoot, { recursive: true })
	mkdirSync(entrypointBinRoot, { recursive: true })
	writeFileSync(entrypointCommandLog, '')
	writeFileSync(entrypointReleaseTool, '# fixture release tool\n')
	writeFileSync(
		entrypointLockTool,
		[
			'acquire_frontend_production_deploy_lock() {',
			'  printf \'lock:%s\\n\' "$1" >> "$FAKE_COMMAND_LOG"',
			'}',
			''
		].join('\n')
	)
	const writeEntrypointExecutable = (name, lines) => {
		const path = join(entrypointBinRoot, name)
		writeFileSync(path, `${lines.join('\n')}\n`)
		chmodSync(path, 0o755)
	}
	writeEntrypointExecutable('git', [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'printf \'git:%s\\n\' "$*" >> "$FAKE_COMMAND_LOG"',
		'case "$*" in',
		'  *"rev-parse HEAD") printf \'%s\\n\' "$FAKE_GIT_REVISION" ;;',
		'  *"status --porcelain --untracked-files=all") : ;;',
		'  *) echo "unexpected git command: $*" >&2; exit 97 ;;',
		'esac'
	])
	writeEntrypointExecutable('node', [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'printf \'node:%s\\n\' "$*" >> "$FAKE_COMMAND_LOG"',
		'if [[ "$#" -eq 0 ]]; then',
		'  while IFS= read -r _line; do :; done',
		'  exit 0',
		'fi',
		'if [[ "$1" != "$FAKE_RELEASE_TOOL" ]]; then',
		'  echo "unexpected node target: $1" >&2',
		'  exit 97',
		'fi',
		'case "${2:-}" in',
		'  client-switch-guard) printf \'%s\' "${FAKE_RELEASE_STATE:-released}" ;;',
		'  read-released-client-switch-binding) printf \'%s\' "$FAKE_RELEASE_BINDING" ;;',
		'  verify-cleanup-finalization)',
		'    if [[ "${FAKE_FINALIZATION_PROOF_STATE:-missing}" != \'finalized\' ]]; then exit 94; fi',
		"    printf 'finalized'",
		'    ;;',
		"  write-cleanup-finalization) printf 'finalized' ;;",
		'  *) echo "unexpected release command: ${2:-missing}" >&2; exit 98 ;;',
		'esac'
	])
	writeEntrypointExecutable('systemctl', [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'target="${@: -1}"',
		'printf \'systemctl:%s\\n\' "$*" >> "$FAKE_COMMAND_LOG"',
		'case "$1" in',
		"  show) printf 'not-found\\n' ;;",
		'  daemon-reload) : ;;',
		'  reload) [[ "$target" == \'nginx.service\' ]] ;;',
		'  is-active)',
		'    if [[ "$target" == \'nginx.service\' ]]; then',
		"      [[ \"${2:-}\" == '--quiet' ]] || printf 'active\\n'",
		'      exit 0',
		'    fi',
		"    [[ \"${2:-}\" == '--quiet' ]] || printf 'inactive\\n'",
		'    exit 3',
		'    ;;',
		'  is-enabled)',
		"    [[ \"${2:-}\" == '--quiet' ]] || printf 'not-found\\n'",
		'    exit 1',
		'    ;;',
		'  *) echo "unexpected systemctl mutation: $*" >&2; exit 99 ;;',
		'esac'
	])
	writeEntrypointExecutable('nginx', [
		'#!/usr/bin/env bash',
		'set -euo pipefail',
		'printf \'nginx:%s\\n\' "$*" >> "$FAKE_COMMAND_LOG"',
		'[[ "$1" == \'-t\' ]]'
	])
	const entrypointBinding = `${cleanupRevision} ${revision} ${'1'.repeat(64)} ${'2'.repeat(64)} ${'3'.repeat(64)}`
	const entrypointEnvironment = {
		...process.env,
		PATH: `${entrypointBinRoot}:${process.env.PATH}`,
		APP_ROOT: entrypointRoot,
		CLIENT_ROOT: entrypointClientRoot,
		EXPECTED_REVISION: revision,
		IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION: `FINALIZE IDENTITY AVATAR CLIENT CLEANUP ${revision}`,
		IDENTITY_AVATAR_RUNTIME_REBIND_ACTION: 'none',
		FAKE_COMMAND_LOG: entrypointCommandLog,
		FAKE_GIT_REVISION: revision,
		FAKE_RELEASE_TOOL: entrypointReleaseTool,
		FAKE_RELEASE_STATE: 'released',
		FAKE_RELEASE_BINDING: entrypointBinding,
		FAKE_FINALIZATION_PROOF_STATE: 'finalized'
	}
	const directEntrypoint = spawnSync(
		'bash',
		[deployScriptPath, '--finalize-avatar-cleanup'],
		{ encoding: 'utf8', env: entrypointEnvironment }
	)
	const directEntrypointLog = readFileSync(entrypointCommandLog, 'utf8')
	const directGuardIndex = directEntrypointLog.indexOf(
		'client-switch-guard'
	)
	const directFirstBindingIndex = directEntrypointLog.indexOf(
		'read-released-client-switch-binding'
	)
	const directDaemonReloadIndex = directEntrypointLog.indexOf(
		'systemctl:daemon-reload'
	)
	const directNginxTestIndex = directEntrypointLog.indexOf('nginx:-t')
	const directNginxReloadIndex = directEntrypointLog.indexOf(
		'systemctl:reload nginx.service'
	)
	const directLastBindingIndex = directEntrypointLog.lastIndexOf(
		'read-released-client-switch-binding'
	)
	const directProofWriteIndex = directEntrypointLog.indexOf(
		'write-cleanup-finalization'
	)
	if (
		directEntrypoint.status !== 0 ||
		!directEntrypoint.stdout.includes(
			'Identity avatar frontend cleanup finalized for revision:'
		) ||
		!(
			directGuardIndex >= 0 &&
			directGuardIndex < directFirstBindingIndex &&
			directFirstBindingIndex < directDaemonReloadIndex &&
			directDaemonReloadIndex < directNginxTestIndex &&
			directNginxTestIndex < directNginxReloadIndex &&
			directNginxReloadIndex < directLastBindingIndex &&
			directLastBindingIndex < directProofWriteIndex
		) ||
		(
			directEntrypointLog.match(/read-released-client-switch-binding/g) ??
			[]
		).length !== 2 ||
		[
			'prefetch-cleanup',
			'retarget',
			'curl:',
			'docker:',
			'compose:',
			'git:fetch',
			'git:merge'
		].some(fragment => directEntrypointLog.includes(fragment))
	) {
		throw new Error(
			'Direct cleanup finalizer entrypoint is not narrow and ordered'
		)
	}
	writeFileSync(entrypointCommandLog, '')
	const invalidConfirmationEntrypoint = spawnSync(
		'bash',
		[deployScriptPath, '--finalize-avatar-cleanup'],
		{
			encoding: 'utf8',
			env: {
				...entrypointEnvironment,
				IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION:
					'INVALID CLEANUP CONFIRMATION'
			}
		}
	)
	const invalidConfirmationLog = readFileSync(entrypointCommandLog, 'utf8')
	if (
		invalidConfirmationEntrypoint.status === 0 ||
		!invalidConfirmationEntrypoint.stderr.includes(
			'Cleanup finalization confirmation is invalid'
		) ||
		invalidConfirmationLog.includes('lock:') ||
		invalidConfirmationLog.includes('client-switch-guard') ||
		invalidConfirmationLog.includes('systemctl:daemon-reload') ||
		invalidConfirmationLog.includes('write-cleanup-finalization')
	) {
		throw new Error('Direct finalizer did not validate confirmation first')
	}
	writeFileSync(entrypointCommandLog, '')
	const missingConfirmationEnvironment = { ...entrypointEnvironment }
	delete missingConfirmationEnvironment.IDENTITY_AVATAR_CLEANUP_FINALIZE_CONFIRMATION
	const missingConfirmationEntrypoint = spawnSync(
		'bash',
		[deployScriptPath, '--finalize-avatar-cleanup'],
		{ encoding: 'utf8', env: missingConfirmationEnvironment }
	)
	const missingConfirmationLog = readFileSync(entrypointCommandLog, 'utf8')
	if (
		missingConfirmationEntrypoint.status === 0 ||
		!missingConfirmationEntrypoint.stderr.includes(
			'Cleanup finalization confirmation is invalid'
		) ||
		missingConfirmationLog.includes('lock:') ||
		missingConfirmationLog.includes('client-switch-guard') ||
		missingConfirmationLog.includes('systemctl:daemon-reload') ||
		missingConfirmationLog.includes('write-cleanup-finalization')
	) {
		throw new Error('Direct finalizer accepted a missing confirmation')
	}
	writeFileSync(entrypointCommandLog, '')
	const readOnlyAssertionEntrypoint = spawnSync(
		'bash',
		[deployScriptPath, '--assert-avatar-cleanup-finalized'],
		{ encoding: 'utf8', env: entrypointEnvironment }
	)
	const readOnlyAssertionLog = readFileSync(entrypointCommandLog, 'utf8')
	if (
		readOnlyAssertionEntrypoint.status !== 0 ||
		!readOnlyAssertionLog.includes('client-switch-guard') ||
		!readOnlyAssertionLog.includes('verify-cleanup-finalization') ||
		[
			'read-released-client-switch-binding',
			'write-cleanup-finalization',
			'systemctl:stop',
			'systemctl:disable',
			'systemctl:daemon-reload',
			'systemctl:reload',
			'nginx:',
			'prefetch-cleanup',
			'retarget',
			'docker:',
			'compose:'
		].some(fragment => readOnlyAssertionLog.includes(fragment))
	) {
		throw new Error(
			'Cleanup finalization assertion entrypoint is not read-only'
		)
	}
	writeFileSync(entrypointCommandLog, '')
	const wrongHeadEntrypoint = spawnSync(
		'bash',
		[deployScriptPath, '--finalize-avatar-cleanup'],
		{
			encoding: 'utf8',
			env: {
				...entrypointEnvironment,
				FAKE_RELEASE_BINDING: `${cleanupRevision} ${descendantRevision} ${'1'.repeat(64)} ${'2'.repeat(64)} ${'3'.repeat(64)}`
			}
		}
	)
	const wrongHeadLog = readFileSync(entrypointCommandLog, 'utf8')
	if (
		wrongHeadEntrypoint.status === 0 ||
		!wrongHeadEntrypoint.stderr.includes(
			'Cleanup finalization must run from the exact cleanupClientRevision'
		) ||
		wrongHeadLog.includes('systemctl:daemon-reload') ||
		wrongHeadLog.includes('write-cleanup-finalization')
	) {
		throw new Error('Direct finalizer accepted a descendant checkout')
	}
	writeFileSync(entrypointCommandLog, '')
	const unreleasedEntrypoint = spawnSync(
		'bash',
		[deployScriptPath, '--finalize-avatar-cleanup'],
		{
			encoding: 'utf8',
			env: {
				...entrypointEnvironment,
				FAKE_RELEASE_STATE: 'cleanup-required'
			}
		}
	)
	const unreleasedEntrypointLog = readFileSync(
		entrypointCommandLog,
		'utf8'
	)
	if (
		unreleasedEntrypoint.status === 0 ||
		!unreleasedEntrypoint.stderr.includes(
			'already released signed receipt'
		) ||
		[
			'prefetch-cleanup',
			'retarget',
			'systemctl:daemon-reload',
			'write-cleanup-finalization'
		].some(fragment => unreleasedEntrypointLog.includes(fragment))
	) {
		throw new Error('Direct finalizer traversed an unreleased resolver')
	}
	writeFileSync(entrypointCommandLog, '')
	const ordinaryMissingProofEntrypoint = spawnSync(
		'bash',
		[deployScriptPath],
		{
			encoding: 'utf8',
			env: {
				...entrypointEnvironment,
				FAKE_FINALIZATION_PROOF_STATE: 'missing'
			}
		}
	)
	const ordinaryMissingProofLog = readFileSync(
		entrypointCommandLog,
		'utf8'
	)
	if (
		ordinaryMissingProofEntrypoint.status === 0 ||
		ordinaryMissingProofEntrypoint.stdout.includes(
			'Deploying frontend revision:'
		) ||
		!ordinaryMissingProofEntrypoint.stderr.includes(
			`Run directly on the VPS from exact frontend checkout ${revision}: EXPECTED_REVISION=${revision}`
		) ||
		!ordinaryMissingProofLog.includes('verify-cleanup-finalization') ||
		[
			'prefetch-cleanup',
			'retarget',
			'systemctl:stop',
			'systemctl:disable',
			'systemctl:daemon-reload',
			'systemctl:reload',
			'nginx:',
			'docker:',
			'compose:'
		].some(fragment => ordinaryMissingProofLog.includes(fragment))
	) {
		throw new Error(
			'Ordinary released entrypoint did not fail read-only before build'
		)
	}
	if (
		!deployScript
			.slice(releasedTeardownIndex, releasedComposeDeployIndex)
			.includes('compose build client') ||
		!releasedDeploySlice.includes('compose up -d --no-build client') ||
		!releasedDeploySlice.includes(
			'Frontend revision verified after permanent avatar cleanup'
		) ||
		[
			'bootstrap-backend-trust',
			'backend-client-ready',
			'prepare-access-log',
			'identity_avatar_runtime_rebind_tool',
			'identity_avatar_retarget_tool',
			'systemctl enable'
		].some(fragment => releasedDeploySlice.includes(fragment))
	) {
		throw new Error(
			'Released deploy did not retire Avatar lifecycle protocols'
		)
	}
	const deployWorkflow = readFileSync(
		new URL('../.github/workflows/deploy-production.yml', import.meta.url),
		'utf8'
	)
	const retargetStageIndex = deployWorkflow.indexOf(
		'node "$retarget_tool" stage'
	)
	const currentGuardIndex = deployWorkflow.indexOf(
		'current_avatar_state="$('
	)
	const workflowReleasedFastPathIndex = deployWorkflow.indexOf(
		'if [[ "$current_avatar_state" == \'released\' ]]; then',
		currentGuardIndex
	)
	const workflowRetargetRequireIndex = deployWorkflow.indexOf(
		'test -f "$retarget_tool"',
		currentGuardIndex
	)
	const workflowRetargetGuardIndex = deployWorkflow.indexOf(
		'node "$retarget_tool" guard',
		currentGuardIndex
	)
	const prefetchIndex = deployWorkflow.indexOf('prefetch_state="$(')
	const fetchIndex = deployWorkflow.indexOf(
		'git fetch --no-tags origin refs/heads/prod'
	)
	const workflowFinalizationAssertIndex = deployWorkflow.indexOf(
		'--assert-avatar-cleanup-finalized',
		currentGuardIndex
	)
	const postfetchIndex = deployWorkflow.indexOf('postfetch_state="$(')
	const ancestryIndex = deployWorkflow.lastIndexOf(
		'git merge-base --is-ancestor'
	)
	const mergeIndex = deployWorkflow.indexOf(
		'git merge --ff-only "$EXPECTED_REVISION"'
	)
	const deployIndex = deployWorkflow.lastIndexOf(
		'bash scripts/deploy-production.sh'
	)
	if (
		retargetStageIndex < 0 ||
		currentGuardIndex < 0 ||
		workflowReleasedFastPathIndex < 0 ||
		workflowRetargetRequireIndex < 0 ||
		workflowRetargetGuardIndex < 0 ||
		prefetchIndex < 0 ||
		workflowFinalizationAssertIndex < 0 ||
		!(
			currentGuardIndex < workflowReleasedFastPathIndex &&
			workflowReleasedFastPathIndex < workflowRetargetRequireIndex &&
			workflowRetargetRequireIndex < workflowRetargetGuardIndex &&
			currentGuardIndex < retargetStageIndex &&
			retargetStageIndex < prefetchIndex &&
			prefetchIndex < workflowFinalizationAssertIndex &&
			workflowFinalizationAssertIndex < fetchIndex &&
			fetchIndex < postfetchIndex &&
			postfetchIndex < ancestryIndex &&
			ancestryIndex < mergeIndex &&
			mergeIndex < deployIndex
		) ||
		(deployWorkflow.match(/github\.ref == 'refs\/heads\/prod'/g) ?? [])
			.length !== 2 ||
		!deployWorkflow.includes(
			'test "$fetched_revision" = "$EXPECTED_REVISION"'
		) ||
		!deployWorkflow.includes(
			'git merge-base --is-ancestor "$current_revision" "$EXPECTED_REVISION"'
		) ||
		!deployWorkflow.includes(
			'STAGE IDENTITY AVATAR CLIENT SOAK RETARGET $DEPLOY_REVISION'
		) ||
		deployWorkflow.includes('--finalize-avatar-cleanup') ||
		deployWorkflow.includes('git pull') ||
		deployWorkflow.includes('git checkout')
	) {
		throw new Error('VPS checkout mutates before the frozen switch guards')
	}
	const workflowReceiptResolverStart = deployWorkflow.indexOf(
		'if [[ -e "$receipt_path" || -L "$receipt_path" ]]; then',
		currentGuardIndex - 500
	)
	const workflowReceiptResolverEnd = deployWorkflow.indexOf(
		'git fetch --no-tags origin refs/heads/prod',
		workflowReceiptResolverStart
	)
	const workflowReleasedResolverFixture = execFileSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
receipt_path='${switchReceiptPath}'
evidence_tool='${publicKeyPath}'
retarget_tool='/fixture/missing-retarget.mjs'
client_root='/fixture/client'
APP_ROOT='/fixture/app'
current_revision='${revision}'
EXPECTED_REVISION='${descendantRevision}'
ALLOW_IDENTITY_AVATAR_CLIENT_RETARGET=0
avatar_cleanup_released=0
cleanup_finalization_assertions=0
node() {
  if [[ "$1" == "$evidence_tool" && "$2" == 'client-switch-guard' ]]; then
    printf 'released'
    return 0
  fi
  echo 'workflow called retired retarget tool' >&2
  return 93
}
bash() {
  if [[ "$1" == "$client_root/scripts/deploy-production.sh" && "$2" == '--assert-avatar-cleanup-finalized' ]]; then
    cleanup_finalization_assertions=$((cleanup_finalization_assertions + 1))
    return 0
  fi
  echo 'workflow invoked an unexpected deploy command' >&2
  return 94
}
${deployWorkflow.slice(
	workflowReceiptResolverStart,
	workflowReceiptResolverEnd
)}
printf '%s:%s:%s' "$prefetch_state" "$avatar_cleanup_released" "$cleanup_finalization_assertions"`
		],
		{ encoding: 'utf8' }
	)
	if (workflowReleasedResolverFixture !== 'released:1:1') {
		throw new Error(
			'Workflow released resolver required the retarget tool'
		)
	}
	const workflowUnfinalizedFixture = spawnSync(
		'bash',
		[
			'-c',
			`set -euo pipefail
receipt_path='${switchReceiptPath}'
evidence_tool='${publicKeyPath}'
retarget_tool='/fixture/missing-retarget.mjs'
client_root='/fixture/client'
current_revision='${revision}'
EXPECTED_REVISION='${descendantRevision}'
APP_ROOT='/fixture/app'
ALLOW_IDENTITY_AVATAR_CLIENT_RETARGET=0
avatar_cleanup_released=0
node() {
  if [[ "$1" == "$evidence_tool" && "$2" == 'client-switch-guard' ]]; then
    printf 'released'
    return 0
  fi
  echo 'workflow called retired retarget tool' >&2
  return 93
}
bash() {
  if [[ "$1" == "$client_root/scripts/deploy-production.sh" && "$2" == '--assert-avatar-cleanup-finalized' ]]; then
    echo 'cleanup finalization is missing' >&2
    return 94
  fi
  return 95
}
${deployWorkflow.slice(
	workflowReceiptResolverStart,
	workflowReceiptResolverEnd
)}
printf 'fetch-or-checkout-reached'`
		],
		{ encoding: 'utf8' }
	)
	if (
		workflowUnfinalizedFixture.status !== 94 ||
		workflowUnfinalizedFixture.stdout.includes(
			'fetch-or-checkout-reached'
		) ||
		!workflowUnfinalizedFixture.stderr.includes(
			'cleanup finalization is missing'
		)
	) {
		throw new Error(
			'Workflow did not fail before fetch on missing finalization proof'
		)
	}

	const lazyFixtureRoot = createFixture('lazy-forbidden')
	writeFileSync(
		join(lazyFixtureRoot, '.next/static/chunks/lazy-admin.js'),
		'const retiredEndpoint="/api/v1/files";'
	)
	expectFailure('lazy-only-forbidden-reference', () =>
		generateFullReleaseManifest({
			repositoryRoot: lazyFixtureRoot,
			clientRevision: revision,
			generatedAt
		})
	)

	const lazyRelativeFixtureRoot = createFixture('lazy-relative-forbidden')
	writeFileSync(
		join(lazyRelativeFixtureRoot, '.next/static/chunks/lazy-cabinet.js'),
		'const endpoint="/files";const query={folder:"user-avatar",filePath:path};'
	)
	expectFailure('lazy-only-relative-file-shape', () =>
		generateFullReleaseManifest({
			repositoryRoot: lazyRelativeFixtureRoot,
			clientRevision: revision,
			generatedAt
		})
	)

	console.log('identity_avatar_client_release_evidence_tests=passed')
} finally {
	rmSync(temporaryRoot, { recursive: true, force: true })
}
