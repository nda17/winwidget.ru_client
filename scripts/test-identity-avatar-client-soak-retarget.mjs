#!/usr/bin/env node

import { generateKeyPairSync, sign } from 'node:crypto'
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
	createClientSwitchReceiptForOwner,
	sha256
} from './identity-avatar-client-release-evidence.mjs'
import {
	CLIENT_RETARGET_CRITICAL_FILES,
	commitRetargetOutcome,
	fetchStableRetargetAck,
	prefetchCleanupAfterRetarget,
	readRetargetGuard,
	retargetPaths,
	stageClientRetarget,
	prepareRetargetOutcome,
	validateRetargetAckRaw,
	validateRetargetIntentRaw,
	validateRetargetOutcomeRaw,
	validateRetargetStateRaw,
	verifyRetargetOutcome
} from './identity-avatar-client-soak-retarget.mjs'
import {
	adoptRuntimeRebindForOwner,
	archiveAndValidateReadyForOwner,
	createRuntimeRebindMutationStartForOwner,
	prepareRuntimeRebindForOwner,
	verifyCleanupFrontendBindingForOwner
} from './identity-avatar-client-runtime-rebind.mjs'

const temporaryRoot = realpathSync(
	mkdtempSync(join(tmpdir(), 'identity-avatar-client-soak-retarget-'))
)
const sourceRoot = resolve(new URL('..', import.meta.url).pathname)
const expectedOwner = { uid: process.getuid(), gid: process.getgid() }
const ownerRevision = 'a'.repeat(40)
const backendRuntimeRevision = 'b'.repeat(40)
const databaseId = '123e4567-e89b-12d3-a456-426614174000'
const preparedAt = '2026-08-15T00:10:00.000Z'
const processStartedAt = '2026-08-15T00:20:00.000Z'
const heartbeatAt = '2026-08-15T00:21:00.000Z'
const verifiedAt = '2026-08-15T00:22:00.000Z'

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

const git = (root, ...args) => {
	const result = spawnSync('git', ['-C', root, ...args], {
		encoding: 'utf8'
	})
	if (result.status !== 0) {
		throw new Error(`Git fixture failed: ${args.join(' ')}`)
	}
	return result.stdout.trim()
}

const writeKeyPair = (root, name, pair) => {
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

const signedLine = (body, privateKey) =>
	Buffer.from(`${sign(null, body, privateKey).toString('base64')}\n`)

try {
	const repositoryRoot = join(temporaryRoot, 'repository')
	mkdirSync(repositoryRoot, { mode: 0o700 })
	for (const path of CLIENT_RETARGET_CRITICAL_FILES) {
		const source = join(sourceRoot, path)
		const destination = join(repositoryRoot, path)
		mkdirSync(dirname(destination), { recursive: true })
		cpSync(source, destination)
		chmodSync(destination, statSync(source).mode & 0o111 ? 0o755 : 0o644)
	}
	git(repositoryRoot, 'init', '-b', 'prod')
	git(repositoryRoot, 'config', 'user.name', 'Retarget Test')
	git(repositoryRoot, 'config', 'user.email', 'retarget@example.invalid')
	git(repositoryRoot, 'add', '.')
	git(repositoryRoot, 'commit', '-m', 'initial frozen lifecycle')
	const initialClientRevision = git(repositoryRoot, 'rev-parse', 'HEAD')
	writeFileSync(join(repositoryRoot, 'safe-descendant.txt'), 'one\n')
	git(repositoryRoot, 'add', 'safe-descendant.txt')
	git(repositoryRoot, 'commit', '-m', 'safe descendant')
	const candidateClientRevision = git(repositoryRoot, 'rev-parse', 'HEAD')
	git(repositoryRoot, 'checkout', '--detach', initialClientRevision)

	const trustRoot = join(temporaryRoot, 'trust')
	const retargetRoot = join(temporaryRoot, 'retarget')
	const releaseRoot = join(temporaryRoot, 'release')
	const runtimePrivateRoot = join(temporaryRoot, 'runtime-private')
	for (const path of [
		trustRoot,
		retargetRoot,
		releaseRoot,
		runtimePrivateRoot
	]) {
		mkdirSync(path, { mode: 0o700 })
	}
	const frontendPair = generateKeyPairSync('ed25519')
	const backendPair = generateKeyPairSync('ed25519')
	const frontend = writeKeyPair(trustRoot, 'frontend', frontendPair)
	const backend = writeKeyPair(trustRoot, 'backend', backendPair)
	const receiptPath = join(trustRoot, 'client-switch-v1.json')
	const statePath = join(trustRoot, 'retarget-state-v1.json')
	const readyValue = {
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
		ownershipActivatedAt: '2026-08-14T23:58:00.000Z',
		generatedAt: '2026-08-14T23:59:00.000Z',
		expiresAt: '2026-08-15T01:59:00.000Z'
	}
	const readyRaw = Buffer.from(JSON.stringify(readyValue))
	const readySignatureRaw = signedLine(readyRaw, backendPair.privateKey)
	const switchReceipt = createClientSwitchReceiptForOwner({
		receiptPath,
		archiveAttestationPath: join(trustRoot, 'ready.json'),
		archiveSignaturePath: join(trustRoot, 'ready.json.sig'),
		clientReadyRaw: readyRaw,
		clientReadySignatureRaw: readySignatureRaw,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		clientRevision: initialClientRevision,
		releaseEvidenceSha256: 'c'.repeat(64),
		expectedBackendServerRevision: ownerRevision,
		expectedClientReadySha256: sha256(readyRaw),
		expectedClientReadySignatureSha256: sha256(readySignatureRaw),
		clientProcessStartedAt: '2026-08-15T00:00:00.000Z',
		soakPinnedAt: '2026-08-15T00:01:00.000Z',
		expectedUid: expectedOwner.uid,
		expectedGid: expectedOwner.gid
	})

	const staged = await stageClientRetarget({
		repositoryRoot,
		toClientRevision: candidateClientRevision,
		currentBackendRuntimeRevision: backendRuntimeRevision,
		receiptPath,
		statePath,
		retargetRoot,
		releaseRoot,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		preparedAt,
		fetchCandidate: false,
		owner: expectedOwner
	})
	if (
		staged.retargetSequence !== 1 ||
		readRetargetGuard({
			currentClientRevision: candidateClientRevision,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath,
			nowMs: Date.parse(preparedAt),
			repositoryRoot,
			owner: expectedOwner
		}) !== 'retarget-staged'
	) {
		throw new Error(
			'Signed retarget state did not authorize its exact candidate'
		)
	}
	const stateRaw = readFileSync(statePath)
	const intentPath = retargetPaths(
		candidateClientRevision,
		retargetRoot,
		releaseRoot
	).intent
	const intentRaw = readFileSync(intentPath)
	validateRetargetIntentRaw(intentRaw, {
		frontendPublicKeyPath: frontend.publicPath,
		nowMs: Date.parse(preparedAt)
	})
	validateRetargetStateRaw(stateRaw, {
		frontendPublicKeyPath: frontend.publicPath,
		nowMs: Date.parse(preparedAt)
	})

	const hiddenState = `${statePath}.hidden`
	renameSync(statePath, hiddenState)
	if (
		readRetargetGuard({
			currentClientRevision: candidateClientRevision,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath,
			nowMs: Date.parse(preparedAt),
			repositoryRoot,
			owner: expectedOwner
		}) !== 'cleanup-required'
	) {
		throw new Error(
			'A staged intent without its committed state opened checkout'
		)
	}
	renameSync(hiddenState, statePath)
	const originalIntent = JSON.parse(intentRaw.toString('utf8'))
	if (
		originalIntent.previousBackendAckEvidenceSha256 !== null ||
		originalIntent.previousBackendAckEvidenceSignatureSha256 !== null
	) {
		throw new Error(
			'First retarget intent unexpectedly binds a backend ACK'
		)
	}
	const { signature: ignoredIntentSignature, ...tamperedIntentPayload } = {
		...originalIntent,
		preparedAt: '2026-08-15T00:10:01.000Z'
	}
	void ignoredIntentSignature
	const tamperedIntentRaw = Buffer.from(
		JSON.stringify({
			...tamperedIntentPayload,
			signature: sign(
				null,
				Buffer.from(JSON.stringify(tamperedIntentPayload)),
				frontendPair.privateKey
			).toString('base64')
		})
	)
	writeFileSync(intentPath, tamperedIntentRaw, { mode: 0o600 })
	expectFailure('state-to-intent-hash', () =>
		readRetargetGuard({
			currentClientRevision: candidateClientRevision,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath,
			nowMs: Date.parse(preparedAt) + 1000,
			repositoryRoot,
			owner: expectedOwner
		})
	)
	writeFileSync(intentPath, intentRaw, { mode: 0o600 })

	const releaseFiles = [
		{ path: '.next/server/a.js', bytes: 40, sha256: '1'.repeat(64) },
		{
			path: '.next/standalone/a.js',
			bytes: 42,
			sha256: '2'.repeat(64)
		},
		{ path: '.next/static/a.js', bytes: 46, sha256: '3'.repeat(64) }
	]
	const releaseChecks = [
		'full-next-server-tree-scanned',
		'full-next-standalone-tree-scanned',
		'full-next-static-tree-scanned',
		'legacy-api-v1-files-absent',
		'legacy-uploads-absent',
		'migration-credential-identifiers-absent',
		'identity-profile-avatar-api-present',
		'identity-admin-avatar-api-present'
	]
	const fullManifestRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-release-full-manifest',
			clientRevision: candidateClientRevision,
			nextBuildId: 'retarget-build',
			scanRoots: ['.next/server', '.next/standalone', '.next/static'],
			files: releaseFiles,
			fileCount: releaseFiles.length,
			totalBytes: 128,
			treeSha256: sha256(JSON.stringify(releaseFiles)),
			checks: releaseChecks,
			generatedAt: '2026-08-15T00:19:00.000Z'
		})
	)
	const releaseValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-release',
		clientRevision: candidateClientRevision,
		nextBuildId: 'retarget-build',
		scanRoots: ['.next/server', '.next/standalone', '.next/static'],
		fileCount: 3,
		totalBytes: 128,
		treeSha256: sha256(JSON.stringify(releaseFiles)),
		checks: releaseChecks,
		fullManifestSha256: sha256(fullManifestRaw),
		generatedAt: '2026-08-15T00:19:00.000Z'
	}
	const releaseRaw = Buffer.from(JSON.stringify(releaseValue))
	const releaseSignatureRaw = signedLine(
		releaseRaw,
		frontendPair.privateKey
	)
	const runtimeRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-runtime',
			clientRevision: candidateClientRevision,
			processStartedAt,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw)
		})
	)
	const heartbeatValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-log-soak',
		clientRevision: candidateClientRevision,
		releaseEvidenceSha256: sha256(releaseRaw),
		processStartedAt,
		logConfigurationSha256: 'f'.repeat(64),
		sequence: 1,
		previousEvidenceSha256: sha256(releaseRaw),
		windowStartedAt: processStartedAt,
		windowEndedAt: heartbeatAt,
		hosts: ['winwidget.ru', 'www.winwidget.ru'],
		probeClass: 'soak-probe',
		probeRequestCount: 1,
		logFiles: [],
		logSetSha256: sha256(JSON.stringify([])),
		apiV1FilesRequestCount: 0,
		uploadsGetHeadRequestCount: 0,
		uploadsSuccessfulGetHeadCount: 0,
		rotationContinuityPassed: true,
		futureSkewPassed: true,
		generatedAt: heartbeatAt
	}
	const heartbeatRaw = Buffer.from(JSON.stringify(heartbeatValue))
	const heartbeatSignatureRaw = signedLine(
		heartbeatRaw,
		frontendPair.privateKey
	)
	const prepared = prepareRetargetOutcome({
		repositoryRoot,
		clientRevision: candidateClientRevision,
		currentBackendRuntimeRevision: backendRuntimeRevision,
		releaseRaw,
		releaseSignatureRaw,
		runtimeRaw,
		heartbeatRaw,
		heartbeatSignatureRaw,
		receiptPath,
		statePath,
		retargetRoot,
		releaseRoot,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		verifiedAt,
		owner: expectedOwner
	})
	const paths = retargetPaths(
		candidateClientRevision,
		retargetRoot,
		releaseRoot
	)
	rmSync(paths.outcomeSignature)
	const recovered = prepareRetargetOutcome({
		repositoryRoot,
		clientRevision: candidateClientRevision,
		currentBackendRuntimeRevision: backendRuntimeRevision,
		releaseRaw,
		releaseSignatureRaw,
		runtimeRaw,
		heartbeatRaw,
		heartbeatSignatureRaw,
		receiptPath,
		statePath,
		retargetRoot,
		releaseRoot,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		verifiedAt: '2026-08-15T00:22:30.000Z',
		owner: expectedOwner
	})
	if (
		!prepared.body.equals(recovered.body) ||
		!existsSync(paths.outcomeSignature)
	) {
		throw new Error(
			'Body-before-signature crash was not recovered idempotently'
		)
	}
	verifyRetargetOutcome(
		recovered.body,
		recovered.signatureRaw,
		frontend.publicPath,
		{
			expectedClientRevision: candidateClientRevision,
			expectedBodySha256: sha256(recovered.body),
			nowMs: Date.parse('2026-08-15T00:23:00.000Z')
		}
	)
	const applied = commitRetargetOutcome({
		repositoryRoot,
		clientRevision: candidateClientRevision,
		publicBodyRaw: recovered.body,
		publicSignatureRaw: recovered.signatureRaw,
		receiptPath,
		statePath,
		retargetRoot,
		releaseRoot,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		nowMs: Date.parse('2026-08-15T00:23:00.000Z'),
		owner: expectedOwner
	})
	if (
		applied.state !== 'applied' ||
		readRetargetGuard({
			currentClientRevision: candidateClientRevision,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath,
			nowMs: Date.parse('2026-08-15T00:23:00.000Z'),
			repositoryRoot,
			owner: expectedOwner
		}) !== 'retarget-applied'
	) {
		throw new Error(
			'Public outcome did not atomically advance retarget state'
		)
	}
	const appliedStateRaw = readFileSync(statePath)
	const ackValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-client-soak-retarget-ack',
		ownershipRevision: ownerRevision,
		currentBackendRuntimeRevision: backendRuntimeRevision,
		initialClientRevision,
		previousClientRevision: initialClientRevision,
		currentClientRevision: candidateClientRevision,
		identityDatabaseId: databaseId,
		clientSwitchEvidenceSha256: '1'.repeat(64),
		clientRetargetEvidenceSha256: '2'.repeat(64),
		frontendRetargetEvidenceSha256: sha256(recovered.body),
		frontendRetargetEvidenceSignatureSha256: sha256(
			recovered.signatureRaw
		),
		retargetSequence: 1,
		soakResetAt: '2026-08-15T00:23:00Z',
		acknowledgedAt: '2026-08-15T00:24:00Z'
	}
	const ackRaw = Buffer.from(JSON.stringify(ackValue))
	const ackSignatureRaw = signedLine(ackRaw, backendPair.privateKey)
	validateRetargetAckRaw(ackRaw, {
		expectedBodySha256: sha256(ackRaw),
		nowMs: Date.parse('2026-08-15T00:25:00.000Z')
	})
	const ackFetch = (body, signatureRaw) => async url =>
		new Response(String(url).endsWith('.sig') ? signatureRaw : body, {
			status: 200,
			headers: {
				'cache-control': 'no-store, max-age=0',
				'content-type': String(url).endsWith('.sig')
					? 'application/octet-stream'
					: 'application/json',
				'x-content-type-options': 'nosniff',
				'x-winwidget-revision': ownerRevision
			}
		})
	const stableAck = await fetchStableRetargetAck({
		fetchImpl: ackFetch(ackRaw, ackSignatureRaw),
		backendPublicKeyPath: backend.publicPath,
		nowMs: Date.parse('2026-08-15T00:25:00.000Z')
	})
	if (!stableAck.body.equals(ackRaw)) {
		throw new Error('Stable backend retarget ACK bytes drifted')
	}
	await expectAsyncFailure('backend-ack-signature', () =>
		fetchStableRetargetAck({
			fetchImpl: ackFetch(
				ackRaw,
				signedLine(ackRaw, frontendPair.privateKey)
			),
			backendPublicKeyPath: backend.publicPath,
			nowMs: Date.parse('2026-08-15T00:25:00.000Z')
		})
	)

	git(repositoryRoot, 'checkout', '-B', 'prod', candidateClientRevision)
	writeFileSync(join(repositoryRoot, 'safe-descendant-2.txt'), 'two\n')
	git(repositoryRoot, 'add', 'safe-descendant-2.txt')
	git(repositoryRoot, 'commit', '-m', 'second safe descendant')
	const secondCandidateRevision = git(repositoryRoot, 'rev-parse', 'HEAD')
	git(repositoryRoot, 'checkout', '--detach', candidateClientRevision)
	const backendRuntimeRevisionAfterRetarget = 'c'.repeat(40)
	await expectAsyncFailure('backend-ack-required', () =>
		stageClientRetarget({
			repositoryRoot,
			toClientRevision: secondCandidateRevision,
			currentBackendRuntimeRevision: backendRuntimeRevisionAfterRetarget,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			preparedAt: '2026-08-15T00:25:00.000Z',
			fetchCandidate: false,
			fetchImpl: async () => {
				throw new Error('ACK unavailable')
			},
			owner: expectedOwner
		})
	)
	const unrelatedAckRaw = Buffer.from(
		JSON.stringify({
			...ackValue,
			currentBackendRuntimeRevision: 'd'.repeat(40)
		})
	)
	await expectAsyncFailure('backend-ack-previous-runtime-binding', () =>
		stageClientRetarget({
			repositoryRoot,
			toClientRevision: secondCandidateRevision,
			currentBackendRuntimeRevision: backendRuntimeRevisionAfterRetarget,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			preparedAt: '2026-08-15T00:25:00.000Z',
			fetchCandidate: false,
			fetchImpl: ackFetch(
				unrelatedAckRaw,
				signedLine(unrelatedAckRaw, backendPair.privateKey)
			),
			owner: expectedOwner
		})
	)
	const stagedSecond = await stageClientRetarget({
		repositoryRoot,
		toClientRevision: secondCandidateRevision,
		currentBackendRuntimeRevision: backendRuntimeRevisionAfterRetarget,
		receiptPath,
		statePath,
		retargetRoot,
		releaseRoot,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		preparedAt: '2026-08-15T00:25:00.000Z',
		fetchCandidate: false,
		fetchImpl: ackFetch(ackRaw, ackSignatureRaw),
		owner: expectedOwner
	})
	if (
		stagedSecond.retargetSequence !== 2 ||
		stagedSecond.currentBackendRuntimeRevision !==
			backendRuntimeRevisionAfterRetarget ||
		stagedSecond.previousBackendAckEvidenceSha256 !== sha256(ackRaw) ||
		stagedSecond.previousBackendAckEvidenceSignatureSha256 !==
			sha256(ackSignatureRaw)
	) {
		throw new Error(
			'Second retarget did not bind the previous backend ACK and new live runtime'
		)
	}
	writeFileSync(statePath, appliedStateRaw, { mode: 0o600 })
	rmSync(
		retargetPaths(secondCandidateRevision, retargetRoot, releaseRoot)
			.intent
	)

	const invalidDate = JSON.parse(recovered.body.toString('utf8'))
	invalidDate.verifiedAt = '2026-02-30T00:22:00.000Z'
	expectFailure('normalized-impossible-date', () =>
		validateRetargetOutcomeRaw(Buffer.from(JSON.stringify(invalidDate)), {
			expectedClientRevision: candidateClientRevision,
			nowMs: Date.parse('2026-08-15T00:23:00.000Z')
		})
	)
	const cleanupReleaseDirectory = join(
		releaseRoot,
		candidateClientRevision
	)
	const cleanupPrivateDirectory = join(
		runtimePrivateRoot,
		candidateClientRevision
	)
	mkdirSync(cleanupReleaseDirectory, { recursive: true })
	mkdirSync(cleanupPrivateDirectory, { recursive: true })
	writeFileSync(
		join(cleanupReleaseDirectory, 'release-evidence-v1.json'),
		releaseRaw,
		{ mode: 0o644 }
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'release-evidence-v1.json.sig'),
		releaseSignatureRaw,
		{ mode: 0o644 }
	)
	writeFileSync(
		join(cleanupReleaseDirectory, 'release-full-manifest-v1.json'),
		fullManifestRaw,
		{ mode: 0o600 }
	)
	const cleanupImageId = `sha256:${'c'.repeat(64)}`
	const cleanupImageAdoptionRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-image-adoption',
			clientRevision: candidateClientRevision,
			imageId: cleanupImageId,
			fullManifestSha256: sha256(fullManifestRaw),
			releaseEvidenceSha256: sha256(releaseRaw)
		})
	)
	writeFileSync(
		join(
			releaseRoot,
			`.image-adoption-${candidateClientRevision}-v1.json`
		),
		cleanupImageAdoptionRaw,
		{ mode: 0o600 }
	)
	const cleanupImageProofRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-image-adoption-v1',
			clientRevision: candidateClientRevision,
			clientImageId: cleanupImageId,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
			releaseTreeSha256: releaseValue.treeSha256,
			releaseFullManifestSha256: releaseValue.fullManifestSha256,
			candidateTreeSha256: 'd'.repeat(64),
			clientLifecycleContractSha256: 'e'.repeat(64),
			adoptedAt: '2026-08-15T00:20:30.000Z'
		})
	)
	const cleanupImageProofSignatureRaw = signedLine(
		cleanupImageProofRaw,
		frontendPair.privateKey
	)
	for (const [path, raw, mode] of [
		[
			join(cleanupReleaseDirectory, 'image-adoption-v1.json'),
			cleanupImageProofRaw,
			0o644
		],
		[
			join(cleanupReleaseDirectory, 'image-adoption-v1.json.sig'),
			cleanupImageProofSignatureRaw,
			0o644
		],
		[
			join(cleanupPrivateDirectory, 'image-adoption-v1.json'),
			cleanupImageProofRaw,
			0o600
		],
		[
			join(cleanupPrivateDirectory, 'image-adoption-v1.json.sig'),
			cleanupImageProofSignatureRaw,
			0o600
		]
	]) {
		writeFileSync(path, raw, { mode })
	}
	const cleanupFrontendBinding = {
		bindingKind: 'client-code-retarget',
		evidenceSha256: sha256(cleanupImageProofRaw),
		evidenceSignatureSha256: sha256(cleanupImageProofSignatureRaw),
		clientRevision: candidateClientRevision,
		imageId: cleanupImageId,
		releaseEvidenceSha256: sha256(releaseRaw),
		releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
		releaseTreeSha256: releaseValue.treeSha256,
		releaseFullManifestSha256: releaseValue.fullManifestSha256,
		processStartedAt
	}
	const runtimeDiscoveryValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-runtime-stability-current-v1',
		ownershipRevision: ownerRevision,
		currentRuntimeRevision: backendRuntimeRevision,
		initialClientRevision,
		currentClientRevision: candidateClientRevision,
		identityDatabaseId: databaseId,
		currentClientBindingEvidenceSha256: '0'.repeat(64),
		runtimeStabilityGeneration: 0,
		runtimeStabilityEvidenceSha256: 'd'.repeat(64),
		runtimeStabilityLedgerGeneration: 0,
		runtimeStabilityLedgerTailState: 'applied',
		runtimeStabilityLedgerTailEvidenceSha256: 'd'.repeat(64),
		runtimeRetargetEvidenceSha256: 'f'.repeat(64),
		clientRetargetEvidenceSha256: '0'.repeat(64),
		frontendBinding: cleanupFrontendBinding,
		publishedAt: '2026-08-15T00:23:30.000Z'
	}
	const runtimeDiscoveryRaw = Buffer.from(
		JSON.stringify(runtimeDiscoveryValue)
	)
	const runtimeDiscoverySignatureRaw = signedLine(
		runtimeDiscoveryRaw,
		backendPair.privateKey
	)
	const runtimePreparedAt = '2026-08-15T00:24:00.000Z'
	const runtimePrepared = prepareRuntimeRebindForOwner({
		discoveryRaw: runtimeDiscoveryRaw,
		discoverySignatureRaw: runtimeDiscoverySignatureRaw,
		runtimeRaw,
		releaseRaw,
		releaseSignatureRaw,
		imageAdoptionRaw: cleanupImageAdoptionRaw,
		imageProofRaw: cleanupImageProofRaw,
		imageProofSignatureRaw: cleanupImageProofSignatureRaw,
		rebindMode: 'planned-restart',
		receiptRaw: readFileSync(receiptPath),
		backendPublicKeyRaw: readFileSync(backend.publicPath),
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot: runtimePrivateRoot,
		preparedAt: runtimePreparedAt,
		owner: expectedOwner
	})
	if (
		runtimePrepared.value.currentFrontendRetargetEvidenceSha256 !==
			sha256(recovered.body) ||
		runtimePrepared.value
			.currentFrontendRetargetEvidenceSignatureSha256 !==
			sha256(recovered.signatureRaw)
	) {
		throw new Error(
			'Runtime PREPARED did not bind the applied retarget pair'
		)
	}
	const runtimeReadyValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-frontend-runtime-rebind-ready-v1',
		ownershipRevision: ownerRevision,
		currentRuntimeRevision: backendRuntimeRevision,
		initialClientRevision,
		currentClientRevision: candidateClientRevision,
		identityDatabaseId: databaseId,
		currentClientBindingEvidenceSha256:
			runtimeDiscoveryValue.currentClientBindingEvidenceSha256,
		frontendPreparedEvidenceSha256: sha256(runtimePrepared.body),
		frontendPreparedEvidenceSignatureSha256: sha256(
			runtimePrepared.signatureRaw
		),
		previousRuntimeStabilityEvidenceSha256:
			runtimeDiscoveryValue.runtimeStabilityEvidenceSha256,
		generation: runtimePrepared.value.generation,
		rebindMode: 'planned-restart',
		previousFrontendImageId: cleanupImageId,
		previousFrontendReleaseEvidenceSha256: sha256(releaseRaw),
		previousFrontendReleaseEvidenceSignatureSha256: sha256(
			releaseSignatureRaw
		),
		previousFrontendReleaseTreeSha256: releaseValue.treeSha256,
		previousFrontendReleaseFullManifestSha256:
			releaseValue.fullManifestSha256,
		previousClientProcessStartedAt: processStartedAt,
		preparedAt: runtimePreparedAt,
		expiresAt: '2026-08-15T00:54:00.000Z'
	}
	const runtimeReadyRaw = Buffer.from(JSON.stringify(runtimeReadyValue))
	const runtimeReadySignatureRaw = signedLine(
		runtimeReadyRaw,
		backendPair.privateKey
	)
	archiveAndValidateReadyForOwner({
		preparedRaw: runtimePrepared.body,
		preparedSignatureRaw: runtimePrepared.signatureRaw,
		readyRaw: runtimeReadyRaw,
		readySignatureRaw: runtimeReadySignatureRaw,
		backendPublicKeyPath: backend.publicPath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot: runtimePrivateRoot,
		owner: expectedOwner,
		nowMs: Date.parse(runtimePreparedAt)
	})
	const runtimeMutation = createRuntimeRebindMutationStartForOwner({
		preparedRaw: runtimePrepared.body,
		preparedSignatureRaw: runtimePrepared.signatureRaw,
		readyRaw: runtimeReadyRaw,
		readySignatureRaw: runtimeReadySignatureRaw,
		liveImageId: cleanupImageId,
		liveProcessStartedAt: processStartedAt,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot: runtimePrivateRoot,
		owner: expectedOwner,
		mutationStartedAt: '2026-08-15T00:24:01.000Z'
	})
	const runtimeProcessStartedAt = '2026-08-15T00:25:00.000Z'
	const runtimeAfterRebindRaw = Buffer.from(
		JSON.stringify({
			schemaVersion: 1,
			kind: 'identity-avatar-client-runtime',
			clientRevision: candidateClientRevision,
			processStartedAt: runtimeProcessStartedAt,
			releaseEvidenceSha256: sha256(releaseRaw),
			releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw)
		})
	)
	const runtimeHeartbeatValue = {
		...heartbeatValue,
		processStartedAt: runtimeProcessStartedAt,
		previousEvidenceSha256: sha256(runtimeReadyRaw),
		windowStartedAt: runtimeProcessStartedAt,
		windowEndedAt: '2026-08-15T00:31:00.000Z',
		generatedAt: '2026-08-15T00:31:00.000Z'
	}
	const runtimeHeartbeatRaw = Buffer.from(
		JSON.stringify(runtimeHeartbeatValue)
	)
	const runtimeHeartbeatSignatureRaw = signedLine(
		runtimeHeartbeatRaw,
		frontendPair.privateKey
	)
	const runtimeAdopted = adoptRuntimeRebindForOwner({
		preparedRaw: runtimePrepared.body,
		preparedSignatureRaw: runtimePrepared.signatureRaw,
		readyRaw: runtimeReadyRaw,
		readySignatureRaw: runtimeReadySignatureRaw,
		mutationRaw: runtimeMutation.body,
		mutationSignatureRaw: runtimeMutation.signatureRaw,
		runtimeRaw: runtimeAfterRebindRaw,
		releaseRaw,
		releaseSignatureRaw,
		heartbeatRaw: runtimeHeartbeatRaw,
		heartbeatSignatureRaw: runtimeHeartbeatSignatureRaw,
		imageAdoptionRaw: cleanupImageAdoptionRaw,
		expectedProcessStartedAt: runtimeProcessStartedAt,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		releaseRoot,
		privateRoot: runtimePrivateRoot,
		owner: expectedOwner,
		adoptedAt: '2026-08-15T00:32:00.000Z'
	})
	writeFileSync(runtimeAdopted.paths.heartbeat, runtimeHeartbeatRaw, {
		mode: 0o644
	})
	writeFileSync(
		runtimeAdopted.paths.heartbeatSignature,
		runtimeHeartbeatSignatureRaw,
		{ mode: 0o644 }
	)
	const runtimeFrontendBinding = {
		bindingKind: 'frontend-runtime-rebind',
		evidenceSha256: sha256(runtimeAdopted.body),
		evidenceSignatureSha256: sha256(runtimeAdopted.signatureRaw),
		clientRevision: candidateClientRevision,
		imageId: cleanupImageId,
		releaseEvidenceSha256: sha256(releaseRaw),
		releaseEvidenceSignatureSha256: sha256(releaseSignatureRaw),
		releaseTreeSha256: releaseValue.treeSha256,
		releaseFullManifestSha256: releaseValue.fullManifestSha256,
		processStartedAt: runtimeProcessStartedAt
	}
	const cleanupRevision = 'f'.repeat(40)
	const cleanupValue = {
		schemaVersion: 1,
		kind: 'identity-avatar-core-cleanup-complete',
		cleanupPhase: 'COMPLETE',
		ownershipRevision: ownerRevision,
		currentRuntimeRevision: backendRuntimeRevision,
		cleanupRevision,
		initialClientRevision,
		currentClientRevision: candidateClientRevision,
		identityDatabaseId: databaseId,
		ownershipMarkerSha256: 'a'.repeat(64),
		runtimeStabilityCurrentEvidenceSha256: 'b'.repeat(64),
		runtimeStabilityCurrentEvidenceSignatureSha256: 'c'.repeat(64),
		runtimeStabilityGeneration: 0,
		runtimeStabilityEvidenceSha256: 'd'.repeat(64),
		runtimeStabilityLedgerGeneration: 0,
		runtimeStabilityLedgerTailState: 'applied',
		runtimeStabilityLedgerTailEvidenceSha256: 'd'.repeat(64),
		runtimeStableSince: '2026-08-15T00:33:00Z',
		currentClientBindingEvidenceSha256: '0'.repeat(64),
		runtimeRetargetEvidenceSha256: 'f'.repeat(64),
		clientRetargetEvidenceSha256: '0'.repeat(64),
		frontendBinding: cleanupFrontendBinding,
		clientReadyEvidenceSha256: sha256(readyRaw),
		clientReadyEvidenceSignatureSha256: sha256(readySignatureRaw),
		clientSwitchEvidenceSha256: '0'.repeat(64),
		soakEvidenceSha256: '1'.repeat(64),
		preClientReferenceZeroEvidenceSha256: '2'.repeat(64),
		predeployUploadsHandoffSha256: '3'.repeat(64),
		cleanupRetargetEvidenceSha256: '4'.repeat(64),
		cleanupReferenceZeroEvidenceSha256: '5'.repeat(64),
		writerFenceEvidenceSha256: '6'.repeat(64),
		retirementEvidenceSha256: '7'.repeat(64),
		retirementConsumerRecoveryEvidenceCount: 0,
		retirementConsumerRecoveryEvidenceAggregateSha256: '8'.repeat(64),
		revocationEvidenceSha256: '9'.repeat(64),
		nginxEvidenceSha256: 'a'.repeat(64),
		smokeEvidenceSha256: 'b'.repeat(64),
		coreCleanupImageId: `sha256:${'d'.repeat(64)}`,
		legacyReferencesAbsent: true,
		legacyRoutesAbsent: true,
		legacyObjectsRetired: true,
		ownershipActive: true,
		completedAt: '2026-08-22T00:34:00Z'
	}
	const verifyCleanupBinding = cleanup =>
		verifyCleanupFrontendBindingForOwner({
			cleanup,
			receipt: switchReceipt,
			repositoryRoot,
			receiptPath,
			retargetStatePath: statePath,
			retargetRoot,
			releaseRoot,
			privateRoot: runtimePrivateRoot,
			frontendPublicKeyPath: frontend.publicPath,
			backendPublicKeyPath: backend.publicPath,
			owner: expectedOwner
		})
	if (verifyCleanupBinding(cleanupValue) !== cleanupFrontendBinding) {
		throw new Error('Client-code cleanup binding was not verified locally')
	}
	const runtimeCleanupValue = {
		...cleanupValue,
		frontendBinding: runtimeFrontendBinding
	}
	if (
		verifyCleanupBinding(runtimeCleanupValue) !== runtimeFrontendBinding
	) {
		throw new Error(
			'Runtime-rebind cleanup binding was not verified locally'
		)
	}
	expectFailure('runtime cleanup unmatched ADOPTED digest', () =>
		verifyCleanupBinding({
			...runtimeCleanupValue,
			frontendBinding: {
				...runtimeFrontendBinding,
				evidenceSha256: 'f'.repeat(64)
			}
		})
	)
	expectFailure('runtime cleanup process source drift', () =>
		verifyCleanupBinding({
			...runtimeCleanupValue,
			frontendBinding: {
				...runtimeFrontendBinding,
				processStartedAt
			}
		})
	)
	expectFailure('runtime cleanup discovery READY binding drift', () =>
		verifyCleanupBinding({
			...runtimeCleanupValue,
			currentClientBindingEvidenceSha256: 'e'.repeat(64)
		})
	)
	const runtimePreparedArchiveBackup = readFileSync(
		runtimeAdopted.paths.preparedArchive
	)
	writeFileSync(
		runtimeAdopted.paths.preparedArchive,
		Buffer.from(`${runtimePreparedArchiveBackup.toString('utf8')} `)
	)
	try {
		expectFailure('runtime cleanup private PREPARED drift', () =>
			verifyCleanupBinding(runtimeCleanupValue)
		)
	} finally {
		writeFileSync(
			runtimeAdopted.paths.preparedArchive,
			runtimePreparedArchiveBackup
		)
	}
	const runtimeAdoptedArchiveBackup = readFileSync(
		runtimeAdopted.paths.adoptedArchive
	)
	writeFileSync(
		runtimeAdopted.paths.adoptedArchive,
		Buffer.from(`${runtimeAdoptedArchiveBackup.toString('utf8')} `)
	)
	try {
		expectFailure('runtime cleanup private ADOPTED drift', () =>
			verifyCleanupBinding(runtimeCleanupValue)
		)
	} finally {
		writeFileSync(
			runtimeAdopted.paths.adoptedArchive,
			runtimeAdoptedArchiveBackup
		)
	}
	const runtimeDiscoveryBackup = `${runtimeAdopted.paths.discovery}.backup`
	renameSync(runtimeAdopted.paths.discovery, runtimeDiscoveryBackup)
	try {
		expectFailure('runtime cleanup missing archived CURRENT', () =>
			verifyCleanupBinding(runtimeCleanupValue)
		)
	} finally {
		renameSync(runtimeDiscoveryBackup, runtimeAdopted.paths.discovery)
	}
	const runtimeAdoptedPublicBackup = `${runtimeAdopted.paths.adopted}.backup`
	renameSync(runtimeAdopted.paths.adopted, runtimeAdoptedPublicBackup)
	try {
		expectFailure('runtime cleanup missing unique ADOPTED', () =>
			verifyCleanupBinding(runtimeCleanupValue)
		)
	} finally {
		renameSync(runtimeAdoptedPublicBackup, runtimeAdopted.paths.adopted)
	}
	const generationTwoPublicRoot = join(
		dirname(runtimeAdopted.paths.publicRoot),
		'generation-000002'
	)
	const generationTwoPrivateRoot = join(
		dirname(runtimeAdopted.paths.privateGenerationRoot),
		'generation-000002'
	)
	renameSync(runtimeAdopted.paths.publicRoot, generationTwoPublicRoot)
	renameSync(
		runtimeAdopted.paths.privateGenerationRoot,
		generationTwoPrivateRoot
	)
	try {
		expectFailure('runtime cleanup directory generation drift', () =>
			verifyCleanupBinding(runtimeCleanupValue)
		)
	} finally {
		renameSync(
			generationTwoPrivateRoot,
			runtimeAdopted.paths.privateGenerationRoot
		)
		renameSync(generationTwoPublicRoot, runtimeAdopted.paths.publicRoot)
	}
	const cleanupRaw = Buffer.from(JSON.stringify(cleanupValue))
	const cleanupSignatureRaw = signedLine(
		cleanupRaw,
		backendPair.privateKey
	)
	let cleanupFetchIndex = 0
	const cleanupResponses = [
		[cleanupRaw, 'application/json; charset=utf-8'],
		[cleanupSignatureRaw, 'application/octet-stream'],
		[cleanupRaw, 'application/json; charset=utf-8']
	]
	const released = await prefetchCleanupAfterRetarget({
		repositoryRoot,
		receiptPath,
		statePath,
		retargetRoot,
		releaseRoot,
		runtimeRebindPrivateRoot: runtimePrivateRoot,
		backendPublicKeyPath: backend.publicPath,
		frontendPrivateKeyPath: frontend.privatePath,
		frontendPublicKeyPath: frontend.publicPath,
		nowMs: Date.parse('2026-08-22T00:35:00.000Z'),
		owner: expectedOwner,
		archivePaths: () => ({
			attestationPath: join(trustRoot, 'ready.json'),
			signaturePath: join(trustRoot, 'ready.json.sig')
		}),
		fetchImpl: async () => {
			const fixture = cleanupResponses[cleanupFetchIndex]
			cleanupFetchIndex += 1
			if (!fixture) throw new Error('Unexpected cleanup-complete fetch')
			return new Response(fixture[0], {
				status: 200,
				headers: {
					'cache-control': 'no-store, max-age=0',
					'content-type': fixture[1],
					'x-content-type-options': 'nosniff',
					'x-winwidget-revision': cleanupRevision
				}
			})
		}
	})
	if (
		released.state !== 'released' ||
		cleanupFetchIndex !== 3 ||
		readRetargetGuard({
			currentClientRevision: candidateClientRevision,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPublicKeyPath: frontend.publicPath,
			nowMs: Date.parse('2026-08-22T00:35:00.000Z'),
			repositoryRoot,
			owner: expectedOwner
		}) !== 'cleanup-released'
	) {
		throw new Error(
			'Cleanup did not release the final applied client revision'
		)
	}
	const releasedStateSnapshot = readFileSync(statePath)
	const forbiddenIntentPath = retargetPaths(
		secondCandidateRevision,
		retargetRoot,
		releaseRoot
	).intent
	let releasedStageFetchCount = 0
	await expectAsyncFailure('released-retarget-stage-before-fetch', () =>
		stageClientRetarget({
			repositoryRoot,
			toClientRevision: secondCandidateRevision,
			currentBackendRuntimeRevision: backendRuntimeRevisionAfterRetarget,
			receiptPath,
			statePath,
			retargetRoot,
			releaseRoot,
			backendPublicKeyPath: backend.publicPath,
			frontendPrivateKeyPath: frontend.privatePath,
			frontendPublicKeyPath: frontend.publicPath,
			preparedAt: '2026-08-22T00:35:00.000Z',
			fetchCandidate: true,
			fetchImpl: async () => {
				releasedStageFetchCount += 1
				throw new Error('Released retarget must not fetch')
			},
			owner: expectedOwner
		})
	)
	if (
		releasedStageFetchCount !== 0 ||
		!readFileSync(statePath).equals(releasedStateSnapshot) ||
		existsSync(forbiddenIntentPath)
	) {
		throw new Error(
			'Released retarget stage fetched or mutated local evidence'
		)
	}

	const deployScript = readFileSync(
		join(sourceRoot, 'scripts/deploy-production.sh'),
		'utf8'
	)
	const workflowSource = readFileSync(
		join(sourceRoot, '.github/workflows/deploy-production.yml'),
		'utf8'
	)
	const earlyPinnedGuard = deployScript.indexOf(
		'identity_avatar_switch_action="$(\n\tnode "$identity_avatar_release_tool" client-switch-guard'
	)
	const firstRuntimeMutation = Math.min(
		...[
			deployScript.indexOf('compose build client'),
			deployScript.indexOf('docker image tag'),
			deployScript.indexOf('prepare-access-log')
		].filter(index => index >= 0)
	)
	if (
		earlyPinnedGuard < 0 ||
		!Number.isFinite(firstRuntimeMutation) ||
		earlyPinnedGuard >= firstRuntimeMutation ||
		!deployScript.includes(
			'"$identity_avatar_switch_action" =~ ^(soak-pinned|retarget-applied)$'
		) ||
		!deployScript.includes(
			'deployment is deferred without runtime mutation.'
		)
	) {
		throw new Error(
			'Same-revision soak retry must defer before build, log rotation and Compose'
		)
	}
	const workflowPinnedDefer = workflowSource.indexOf(
		'if [[ "$prefetch_state" =~ ^(soak-pinned|retarget-applied)$ ]]'
	)
	const workflowFetch = workflowSource.indexOf(
		'git fetch --no-tags origin refs/heads/prod'
	)
	if (
		workflowPinnedDefer < 0 ||
		workflowFetch < 0 ||
		workflowPinnedDefer >= workflowFetch ||
		!workflowSource.includes(
			'[[ "$current_revision" == "$EXPECTED_REVISION" ]]'
		) ||
		!workflowSource.includes(
			'deployment is deferred before fetch and runtime mutation.'
		)
	) {
		throw new Error(
			'Workflow must no-op an exact soak-pinned revision before fetching or invoking deploy'
		)
	}
	const prepareIndex = deployScript.indexOf('prepare-outcome')
	const commitIndex = deployScript.indexOf('commit-outcome')
	const timerIndex = deployScript.indexOf(
		'systemctl enable --now winwidget-identity-avatar-client-log-soak.timer'
	)
	if (
		prepareIndex < 0 ||
		commitIndex <= prepareIndex ||
		timerIndex <= commitIndex ||
		!deployScript.includes('identity_avatar_before_soak_sequence > 1') ||
		!deployScript.includes(
			'identity_avatar_client_retarget_evidence_sha256='
		)
	) {
		throw new Error(
			'Retarget publication is not ordered before timer enablement'
		)
	}

	console.log('Identity avatar client soak retarget tests passed')
} finally {
	rmSync(temporaryRoot, { recursive: true, force: true })
}
