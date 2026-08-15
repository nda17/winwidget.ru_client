#!/usr/bin/env node

import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import {
	appendFileSync,
	chmodSync,
	existsSync,
	lstatSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	appendJournalEntry,
	buildHeartbeat,
	clearPendingProbe,
	collectLogWindow,
	loadOrCreatePendingProbe,
	parseJournal,
	prepareAccessLogFile,
	publishJournalEntry,
	readPendingProbe,
	validateFreshHeartbeatCheckpoint,
	validateProbeAttempt,
	validateSoakEvidenceRaw,
	validateStableSoakArtifactPair
} from './identity-avatar-client-log-soak.mjs'
import { sha256 } from './identity-avatar-client-release-evidence.mjs'

const revision = '1'.repeat(40)
const releaseSha = '2'.repeat(64)
const logConfigurationSha = '3'.repeat(64)
const nowMs = Date.now()
const processStartedAt = new Date(nowMs - 120_000).toISOString()
const windowStartedAt = new Date(nowMs - 60_000).toISOString()
const windowEndedAt = new Date(nowMs).toISOString()
const { privateKey, publicKey } = generateKeyPairSync('ed25519')

const buildValue = overrides => ({
	schemaVersion: 1,
	kind: 'identity-avatar-client-log-soak',
	clientRevision: revision,
	releaseEvidenceSha256: releaseSha,
	processStartedAt,
	logConfigurationSha256: logConfigurationSha,
	sequence: 1,
	previousEvidenceSha256: releaseSha,
	windowStartedAt,
	windowEndedAt,
	hosts: ['winwidget.ru', 'www.winwidget.ru'],
	probeClass: 'soak-probe',
	probeRequestCount: 1,
	logFiles: [],
	logSetSha256: sha256('[]'),
	apiV1FilesRequestCount: 0,
	uploadsGetHeadRequestCount: 0,
	uploadsSuccessfulGetHeadCount: 0,
	rotationContinuityPassed: true,
	futureSkewPassed: true,
	generatedAt: windowEndedAt,
	...overrides
})

const raw = value => Buffer.from(JSON.stringify(value))
const validBody = raw(buildValue())
const validSignature = Buffer.from(
	`${sign(null, validBody, privateKey).toString('base64')}\n`
)
const validationOptions = {
	expectedRevision: revision,
	expectedReleaseSha: releaseSha,
	expectedProcessStartedAt: processStartedAt,
	expectedLogConfigurationSha: logConfigurationSha
}

validateSoakEvidenceRaw(validBody, validationOptions)
validateStableSoakArtifactPair({
	firstBody: validBody,
	signatureFile: validSignature,
	secondBody: validBody,
	expectedBody: validBody,
	...validationOptions,
	publicKey
})

assert.throws(
	() =>
		validateStableSoakArtifactPair({
			firstBody: validBody,
			signatureFile: validSignature,
			secondBody: Buffer.concat([validBody, Buffer.from(' ')]),
			expectedBody: validBody,
			...validationOptions,
			publicKey
		}),
	/changed between signature fetches/
)
assert.throws(
	() =>
		validateStableSoakArtifactPair({
			firstBody: validBody,
			signatureFile: Buffer.from(
				`${Buffer.alloc(64).toString('base64')}\n`
			),
			secondBody: validBody,
			expectedBody: validBody,
			...validationOptions,
			publicKey
		}),
	/signature is invalid/
)
assert.throws(
	() =>
		validateSoakEvidenceRaw(
			raw(buildValue({ sequence: 65 })),
			validationOptions
		),
	/identity or counters/
)
assert.throws(
	() =>
		validateSoakEvidenceRaw(validBody, {
			...validationOptions,
			expectedProcessStartedAt: new Date(nowMs - 121_000).toISOString()
		}),
	/identity or counters/
)
assert.throws(
	() =>
		validateSoakEvidenceRaw(
			raw(
				buildValue({
					windowStartedAt: new Date(
						Date.parse(processStartedAt) - 1
					).toISOString()
				})
			),
			validationOptions
		),
	/window is invalid/
)
assert.throws(
	() =>
		validateSoakEvidenceRaw(
			raw(buildValue({ releaseEvidenceSha256: '4'.repeat(64) })),
			validationOptions
		),
	/identity or counters/
)
assert.throws(
	() =>
		validateSoakEvidenceRaw(
			raw(
				buildValue({
					logFiles: [
						{
							pathSha256: '5'.repeat(64),
							device: '01',
							inode: '1',
							generation: '1',
							firstByteOffset: '0',
							lastByteOffset: '0',
							bytes: '0',
							sha256: '6'.repeat(64),
							mtime: windowEndedAt
						}
					],
					logSetSha256: '7'.repeat(64)
				})
			),
			validationOptions
		),
	/canonical decimal/
)

const record = (
	pathClass,
	method,
	status,
	timestamp = windowEndedAt,
	host = 'winwidget.ru'
) => ({
	timestamp,
	host,
	pathClass,
	method,
	status
})
const line = value => Buffer.from(`${JSON.stringify(value)}\n`)
const validHeartbeat = buildHeartbeat({
	revision,
	releaseSha,
	processStartedAt,
	logConfigurationSha,
	sequence: 1,
	windowStartedAt,
	windowEndedAt,
	logWindow: {
		slices: [],
		records: [
			record('soak-probe', 'GET', 204),
			record('uploads', 'GET', 404, windowEndedAt, 'www.winwidget.ru')
		]
	}
})
assert.equal(JSON.parse(validHeartbeat).uploadsGetHeadRequestCount, 1)
const runtimeReadySha = '8'.repeat(64)
const generationHeartbeat = buildHeartbeat({
	revision,
	releaseSha,
	processStartedAt,
	logConfigurationSha,
	sequence: 1,
	initialAnchorSha: runtimeReadySha,
	windowStartedAt,
	windowEndedAt,
	logWindow: {
		slices: [],
		records: [record('soak-probe', 'GET', 204)]
	}
})
assert.equal(
	JSON.parse(generationHeartbeat).previousEvidenceSha256,
	runtimeReadySha
)
validateSoakEvidenceRaw(generationHeartbeat, {
	...validationOptions,
	expectedInitialAnchorSha: runtimeReadySha
})
assert.throws(
	() => validateSoakEvidenceRaw(generationHeartbeat, validationOptions),
	/frozen initial anchor/
)
assert.throws(
	() =>
		buildHeartbeat({
			revision,
			releaseSha,
			processStartedAt,
			logConfigurationSha,
			sequence: 1,
			windowStartedAt,
			windowEndedAt,
			logWindow: {
				slices: [],
				records: [
					record('soak-probe', 'GET', 204),
					record('api-v1-files', 'POST', 500)
				]
			}
		}),
	/identity or counters/
)
assert.throws(
	() =>
		buildHeartbeat({
			revision,
			releaseSha,
			processStartedAt,
			logConfigurationSha,
			sequence: 1,
			windowStartedAt,
			windowEndedAt,
			logWindow: {
				slices: [],
				records: [
					record('soak-probe', 'GET', 204),
					record('uploads', 'HEAD', 302)
				]
			}
		}),
	/identity or counters/
)

const fixtureRoot = realpathSync(
	mkdtempSync(join(tmpdir(), 'identity-avatar-client-soak-'))
)
const expectedUid = process.getuid()
const expectedGid = process.getgid()
try {
	const preparedLog = join(fixtureRoot, 'prepared.log')
	prepareAccessLogFile(preparedLog, { expectedUid, expectedGid })
	assert.equal(readFileSync(preparedLog).length, 0)
	writeFileSync(preparedLog, Buffer.from('existing-nonempty\n'), {
		mode: 0o600
	})
	const existingBefore = readFileSync(preparedLog)
	prepareAccessLogFile(preparedLog, { expectedUid, expectedGid })
	assert.deepEqual(readFileSync(preparedLog), existingBefore)
	const trimmedLog = join(fixtureRoot, 'trimmed.log')
	const preProcessLine = line(
		record(
			'uploads',
			'GET',
			200,
			new Date(Date.parse(processStartedAt) - 1).toISOString()
		)
	)
	const postProcessLine = line(record('soak-probe', 'GET', 204))
	writeFileSync(
		trimmedLog,
		Buffer.concat([preProcessLine, postProcessLine]),
		{
			mode: 0o600
		}
	)
	assert.throws(
		() =>
			collectLogWindow({
				previousCursors: [],
				windowStartedAt: processStartedAt,
				windowEndedAt: new Date(nowMs + 5_000).toISOString(),
				accessLogPath: trimmedLog,
				expectedUid,
				expectedGid
			}),
		/outside the exact signed window/
	)

	const accessLogPath = join(fixtureRoot, 'access.log')
	const firstLine = line(record('soak-probe', 'GET', 204))
	const carriedRecord = record(
		'uploads',
		'GET',
		404,
		new Date(nowMs + 1).toISOString()
	)
	const carriedLine = line(carriedRecord)
	const partialLength = Math.floor(carriedLine.length / 2)
	writeFileSync(
		accessLogPath,
		Buffer.concat([firstLine, carriedLine.subarray(0, partialLength)]),
		{ mode: 0o600 }
	)
	chmodSync(accessLogPath, 0o600)
	const firstWindow = collectLogWindow({
		previousCursors: [],
		windowStartedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath,
		expectedUid,
		expectedGid
	})
	assert.equal(firstWindow.records.length, 1)
	assert.equal(firstWindow.cursors[0].offset, String(firstLine.length))
	appendFileSync(accessLogPath, carriedLine.subarray(partialLength))
	const secondWindow = collectLogWindow({
		previousCursors: firstWindow.cursors,
		windowStartedAt: windowEndedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath,
		expectedUid,
		expectedGid
	})
	assert.equal(secondWindow.records.length, 1)
	assert.equal(secondWindow.records[0].pathClass, 'uploads')

	const concurrentLine = line(
		record('uploads', 'HEAD', 404, new Date(nowMs + 2).toISOString())
	)
	let appended = false
	const concurrentFirst = collectLogWindow({
		previousCursors: secondWindow.cursors,
		windowStartedAt: windowEndedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath,
		expectedUid,
		expectedGid,
		onPinned: ({ path }) => {
			if (!appended && path === accessLogPath) {
				appendFileSync(accessLogPath, concurrentLine)
				appended = true
			}
		}
	})
	assert.equal(concurrentFirst.records.length, 0)
	const concurrentSecond = collectLogWindow({
		previousCursors: concurrentFirst.cursors,
		windowStartedAt: windowEndedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath,
		expectedUid,
		expectedGid
	})
	assert.equal(concurrentSecond.records.length, 1)

	const rotationRoot = join(fixtureRoot, 'rotation')
	mkdirSync(rotationRoot, { mode: 0o700 })
	const rotatingLog = join(rotationRoot, 'access.log')
	writeFileSync(rotatingLog, line(record('soak-probe', 'GET', 204)), {
		mode: 0o600
	})
	const beforeRotation = collectLogWindow({
		previousCursors: [],
		windowStartedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath: rotatingLog,
		expectedUid,
		expectedGid
	})
	renameSync(rotatingLog, `${rotatingLog}.2`)
	writeFileSync(
		`${rotatingLog}.1`,
		line(record('uploads', 'GET', 404, new Date(nowMs + 3).toISOString())),
		{ mode: 0o600 }
	)
	writeFileSync(
		rotatingLog,
		line(
			record('uploads', 'HEAD', 404, new Date(nowMs + 4).toISOString())
		),
		{ mode: 0o600 }
	)
	const afterTwoRotations = collectLogWindow({
		previousCursors: beforeRotation.cursors,
		windowStartedAt: windowEndedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath: rotatingLog,
		expectedUid,
		expectedGid
	})
	assert.equal(afterTwoRotations.records.length, 2)

	const gapRoot = join(fixtureRoot, 'gap')
	mkdirSync(gapRoot, { mode: 0o700 })
	const gapLog = join(gapRoot, 'access.log')
	writeFileSync(gapLog, firstLine, { mode: 0o600 })
	const beforeGap = collectLogWindow({
		previousCursors: [],
		windowStartedAt,
		windowEndedAt: new Date(nowMs + 5_000).toISOString(),
		accessLogPath: gapLog,
		expectedUid,
		expectedGid
	})
	renameSync(gapLog, `${gapLog}.2`)
	writeFileSync(gapLog, firstLine, { mode: 0o600 })
	assert.throws(
		() =>
			collectLogWindow({
				previousCursors: beforeGap.cursors,
				windowStartedAt: windowEndedAt,
				windowEndedAt: new Date(nowMs + 5_000).toISOString(),
				accessLogPath: gapLog,
				expectedUid,
				expectedGid
			}),
		/rotation chain has a gap/
	)

	const pendingPath = join(fixtureRoot, '.probe-pending-v1.json')
	const pendingBinding = {
		path: pendingPath,
		revision,
		releaseSha,
		processStartedAt,
		sequence: 1,
		windowStartedAt,
		probeIdFactory: () => '123e4567-e89b-42d3-a456-426614174000',
		expectedUid,
		expectedGid
	}
	const pendingProbe = loadOrCreatePendingProbe(pendingBinding)
	const pendingMetadata = lstatSync(pendingPath)
	assert.equal(pendingMetadata.nlink, 1)
	assert.equal(pendingMetadata.mode & 0o777, 0o600)
	assert.deepEqual(
		readPendingProbe(pendingPath, { expectedUid, expectedGid }),
		pendingProbe
	)
	const recoveredAfterLogged204 = loadOrCreatePendingProbe({
		...pendingBinding,
		probeIdFactory: () => {
			throw new Error('Crash recovery must reuse the durable pending UUID')
		}
	})
	assert.equal(recoveredAfterLogged204.probeId, pendingProbe.probeId)
	const singleLoggedProbe = [record('soak-probe', 'GET', 204)]
	validateProbeAttempt({
		statusCode: 204,
		pending: pendingProbe,
		records: singleLoggedProbe
	})
	validateProbeAttempt({
		statusCode: 409,
		pending: recoveredAfterLogged204,
		records: singleLoggedProbe
	})
	assert.throws(
		() =>
			validateProbeAttempt({
				statusCode: 409,
				pending: null,
				records: singleLoggedProbe
			}),
		/not bound to a pending probe/
	)
	for (const records of [
		[],
		[...singleLoggedProbe, ...singleLoggedProbe]
	]) {
		assert.throws(
			() =>
				validateProbeAttempt({
					statusCode: 409,
					pending: pendingProbe,
					records
				}),
			/exactly one prior GET 204/
		)
	}
	for (const changedBinding of [
		{ processStartedAt: new Date(nowMs - 121_000).toISOString() },
		{ releaseSha: '4'.repeat(64) },
		{ windowStartedAt: new Date(nowMs - 59_999).toISOString() }
	]) {
		assert.throws(
			() =>
				loadOrCreatePendingProbe({
					...pendingBinding,
					...changedBinding
				}),
			/does not match the active release window/
		)
	}
	assert.equal(existsSync(pendingPath), true)
	clearPendingProbe(
		pendingPath,
		{
			revision,
			releaseSha,
			processStartedAt,
			sequence: 1,
			windowStartedAt
		},
		{ expectedUid, expectedGid }
	)
	assert.equal(existsSync(pendingPath), false)

	const journalRoot = join(fixtureRoot, 'journal')
	mkdirSync(journalRoot, { mode: 0o700 })
	const crashTemporary = join(
		journalRoot,
		`.entry-000001-v1.prepared.tmp-${process.pid}-${Date.now()}`
	)
	writeFileSync(crashTemporary, Buffer.from('{"partial"'), { mode: 0o600 })
	assert.deepEqual(
		parseJournal({
			journalRoot,
			revision,
			releaseSha,
			processStartedAt,
			logConfigurationSha,
			publicKey,
			accessLogPath,
			expectedUid,
			expectedGid
		}),
		[]
	)
	assert.throws(
		() =>
			appendJournalEntry(
				journalRoot,
				{ sequence: 65 },
				{ expectedUid, expectedGid }
			),
		/maximum sequence/
	)

	const publishRoot = join(fixtureRoot, 'published')
	mkdirSync(publishRoot, { mode: 0o700 })
	const publishedItem = {
		entry: { sequence: 1 },
		body: validBody,
		signatureFile: validSignature
	}
	publishJournalEntry(publishRoot, publishedItem)
	const immutableBodyPath = join(publishRoot, 'heartbeat-000001-v1.json')
	const immutableSignaturePath = `${immutableBodyPath}.sig`
	const latestBodyPath = join(publishRoot, 'latest-v1.json')
	const latestSignaturePath = `${latestBodyPath}.sig`
	for (const path of [
		immutableBodyPath,
		immutableSignaturePath,
		latestBodyPath,
		latestSignaturePath
	]) {
		assert.equal(existsSync(path), true)
	}
	rmSync(immutableBodyPath)
	rmSync(immutableSignaturePath)
	rmSync(latestBodyPath)
	rmSync(latestSignaturePath)
	publishJournalEntry(publishRoot, publishedItem)
	assert.deepEqual(readFileSync(immutableBodyPath), validBody)
	assert.deepEqual(readFileSync(latestBodyPath), validBody)
	assert.deepEqual(readFileSync(immutableSignaturePath), validSignature)
	assert.deepEqual(readFileSync(latestSignaturePath), validSignature)
	writeFileSync(latestBodyPath, Buffer.from('tampered-latest'))
	writeFileSync(latestSignaturePath, Buffer.from('tampered-signature'))
	publishJournalEntry(publishRoot, publishedItem)
	assert.deepEqual(readFileSync(latestBodyPath), validBody)
	assert.deepEqual(readFileSync(latestSignaturePath), validSignature)
	writeFileSync(immutableBodyPath, Buffer.from('tampered-immutable'))
	assert.throws(
		() => publishJournalEntry(publishRoot, publishedItem),
		/Immutable soak artifact already differs/
	)
} finally {
	rmSync(fixtureRoot, { recursive: true, force: true })
}

const nginxConfig = readFileSync(
	new URL(
		'../deploy/identity-avatar-client-log-soak.nginx.conf',
		import.meta.url
	),
	'utf8'
)
assert.match(nginxConfig, /\$uri/)
assert.ok(nginxConfig.includes('~^winwidget\\.ru:api-v1-files: 1;'))
assert.ok(nginxConfig.includes('~^www\\.winwidget\\.ru:api-v1-files: 1;'))
assert.ok(nginxConfig.includes('~^winwidget\\.ru:uploads: 1;'))
assert.ok(nginxConfig.includes('~^www\\.winwidget\\.ru:uploads: 1;'))
assert.match(nginxConfig, /winwidget\.ru:soak-probe:127\.0\.0\.1:204 1;/)
assert.doesNotMatch(nginxConfig, /soak-probe:127\.0\.0\.1:409 1;/)
assert.doesNotMatch(nginxConfig, /\$request_uri|\$http_user_agent/)
assert.match(
	nginxConfig,
	/"timestamp".*"host".*"pathClass".*"method".*"status"/
)
const logrotatePolicy = readFileSync(
	new URL(
		'../deploy/identity-avatar-client-log-soak.logrotate',
		import.meta.url
	),
	'utf8'
)
assert.match(logrotatePolicy, /\n\s*rotate 8\n/)
assert.match(logrotatePolicy, /\n\s*nocompress\n/)
assert.match(logrotatePolicy, /\n\s*nodateext\n/)
assert.match(logrotatePolicy, /\n\s*nocopytruncate\n/)
assert.doesNotMatch(logrotatePolicy, /\n\s*copytruncate\n/)

const deployScript = readFileSync(
	new URL('./deploy-production.sh', import.meta.url),
	'utf8'
)
const processStartIndex = deployScript.indexOf(
	'compose up -d --no-build client'
)
const configInstallIndex = deployScript.lastIndexOf(
	'"$identity_avatar_nginx_config_source"',
	processStartIndex
)
assert.ok(
	configInstallIndex >= 0 && configInstallIndex < processStartIndex
)
const prepareAccessLogIndex = deployScript.indexOf('prepare-access-log')
const activeNginxReloadIndex = deployScript.indexOf(
	'systemctl reload nginx.service',
	prepareAccessLogIndex
)
assert.ok(
	prepareAccessLogIndex >= 0 &&
		activeNginxReloadIndex > prepareAccessLogIndex
)
assert.match(deployScript, /OnCalendar=\*-\*-\* 03:00:00 UTC/)
assert.match(deployScript, /RandomizedDelaySec=5m/)
assert.match(deployScript, /StartLimitIntervalSec=10m/)
assert.match(deployScript, /StartLimitBurst=5/)
assert.match(deployScript, /Restart=on-failure/)
assert.match(deployScript, /RestartSec=1m/)
assert.match(deployScript, /checkpoint \\\n/)
assert.match(
	deployScript,
	/--minimum-sequence "\$identity_avatar_required_soak_sequence"/
)
assert.match(deployScript, /verify-fresh-heartbeat \\\n/)
assert.doesNotMatch(
	deployScript,
	/identity_avatar_first_soak_succeeded|property=Result|property=ExecMainStatus/
)
assert.doesNotMatch(
	deployScript,
	/systemctl reset-failed winwidget-identity-avatar-client-log-soak\.service \|\| true/
)
assert.match(
	deployScript,
	/stat -c '%u:%g:%a:%h' "\$identity_avatar_soak_lock"/
)
assert.match(deployScript, /'0:0:600:1'/)
assert.match(deployScript, /constants\.O_CREAT \|/)
assert.match(deployScript, /constants\.O_EXCL \|/)
assert.match(deployScript, /constants\.O_NOFOLLOW/)
assert.doesNotMatch(
	deployScript,
	/install --owner=root --group=root --mode=0600 \/dev\/null "\$identity_avatar_soak_lock"/
)
const soakLockIndex = deployScript.indexOf(
	'--exclusive --nonblock "$identity_avatar_soak_lock_fd"'
)
const soakCheckpointIndex = deployScript.indexOf(
	'"$identity_avatar_log_soak_tool" checkpoint',
	soakLockIndex
)
const soakBoundaryIndex = deployScript.indexOf(
	'identity_avatar_soak_invoked_after=',
	soakCheckpointIndex
)
const soakHeartbeatIndex = deployScript.indexOf(
	'"$identity_avatar_log_soak_tool" heartbeat',
	soakBoundaryIndex
)
const soakVerifyIndex = deployScript.indexOf(
	'"$identity_avatar_log_soak_tool" verify-fresh-heartbeat',
	soakHeartbeatIndex
)
const soakUnlockIndex = deployScript.indexOf(
	'--unlock "$identity_avatar_soak_lock_fd"',
	soakVerifyIndex
)
assert.ok(
	soakLockIndex >= 0 &&
		soakLockIndex < soakCheckpointIndex &&
		soakCheckpointIndex < soakBoundaryIndex &&
		soakBoundaryIndex < soakHeartbeatIndex &&
		soakHeartbeatIndex < soakVerifyIndex &&
		soakVerifyIndex < soakUnlockIndex
)

const startLimitBurst = Number(
	deployScript.match(/StartLimitBurst=(\d+)/)?.[1]
)
const restartSeconds =
	Number(deployScript.match(/RestartSec=(\d+)m/)?.[1]) * 60
const frontendLatestStart = Date.parse('2026-01-01T03:05:00.000Z')
const backendEarliestStart = Date.parse('2026-01-01T03:15:00.000Z')
const simulateTransientFailures = transientFailures => {
	if (transientFailures >= startLimitBurst) return null
	return frontendLatestStart + transientFailures * restartSeconds * 1000
}
assert.equal(startLimitBurst, 5)
assert.equal(restartSeconds, 60)
assert.equal(
	simulateTransientFailures(startLimitBurst - 1),
	Date.parse('2026-01-01T03:09:00.000Z')
)
assert.ok(
	simulateTransientFailures(startLimitBurst - 1) < backendEarliestStart
)
assert.equal(simulateTransientFailures(startLimitBurst), null)
assert.match(deployScript, /--release-sha \$identity_avatar_release_sha/)
assert.match(
	deployScript,
	/--process-started-at \$identity_avatar_process_started_at/
)

const soakProducer = readFileSync(
	new URL('./identity-avatar-client-log-soak.mjs', import.meta.url),
	'utf8'
)
const checkpointSource = soakProducer.slice(
	soakProducer.indexOf('const heartbeatCheckpoint ='),
	soakProducer.indexOf('export const validateFreshHeartbeatCheckpoint')
)
assert.ok(
	checkpointSource.indexOf('publishJournalEntry(soakRoot, latest)') >= 0 &&
		checkpointSource.indexOf('publishJournalEntry(soakRoot, latest)') <
			checkpointSource.indexOf(
				'join(soakRoot, `heartbeat-${sequence}-v1.json`)'
			)
)
const heartbeatSource = soakProducer.slice(
	soakProducer.indexOf('const heartbeat = async')
)
const appendJournalIndex = heartbeatSource.indexOf(
	'appendJournalEntry(journalRoot, entry)'
)
const publishHeartbeatIndex = heartbeatSource.indexOf(
	'publishJournalEntry(soakRoot, item)'
)
const clearPendingIndex = heartbeatSource.indexOf(
	'clearPendingProbe(pendingProbePath',
	publishHeartbeatIndex
)
assert.ok(
	appendJournalIndex >= 0 &&
		appendJournalIndex < publishHeartbeatIndex &&
		publishHeartbeatIndex < clearPendingIndex
)

const probeRoute = readFileSync(
	new URL(
		'../src/app/.well-known/winwidget/identity-avatar-client/soak-probe/[clientRevision]/[probeId]/route.ts',
		import.meta.url
	),
	'utf8'
)
assert.match(probeRoute, /claimSoakProbe/)
assert.match(probeRoute, /status,/)

const runtimeValidator = readFileSync(
	new URL(
		'../src/shared/server/identity-avatar-client-evidence.ts',
		import.meta.url
	),
	'utf8'
)
assert.match(runtimeValidator, /windowStartedAt < processStartedAt/)
assert.match(runtimeValidator, /value\.sequence > 64/)

const firstInvokedAfter = new Date(nowMs - 1_000).toISOString()
const firstCheckpoint = {
	sequence: 1,
	bodySha256: '4'.repeat(64),
	generatedAt: new Date(nowMs).toISOString()
}
assert.equal(
	validateFreshHeartbeatCheckpoint({
		beforeSequence: 0,
		beforeBodySha256: '0'.repeat(64),
		after: firstCheckpoint,
		invokedAfter: firstInvokedAfter,
		nowMs
	}),
	firstCheckpoint
)
assert.throws(
	() =>
		validateFreshHeartbeatCheckpoint({
			beforeSequence: 1,
			beforeBodySha256: '5'.repeat(64),
			after: firstCheckpoint,
			invokedAfter: firstInvokedAfter,
			nowMs
		}),
	/exactly once/
)
assert.throws(
	() =>
		validateFreshHeartbeatCheckpoint({
			beforeSequence: 0,
			beforeBodySha256: firstCheckpoint.bodySha256,
			after: firstCheckpoint,
			invokedAfter: firstInvokedAfter,
			nowMs
		}),
	/exactly once/
)
assert.throws(
	() =>
		validateFreshHeartbeatCheckpoint({
			beforeSequence: 0,
			beforeBodySha256: '0'.repeat(64),
			after: {
				...firstCheckpoint,
				generatedAt: new Date(nowMs - 2_000).toISOString()
			},
			invokedAfter: firstInvokedAfter,
			nowMs
		}),
	/deployment invocation/
)

console.log('identity_avatar_client_log_soak_tests=passed')
