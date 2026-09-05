import { describe, expect, it, vi } from 'vitest'
import {
	parseManagedWidgetSource,
	parseWidgetCandidate,
	parseWidgetCandidatesPage,
	parseWidgetEligibility,
	parseWidgetSourceResult,
	parseWidgetSourcesPage,
	widgetTypes
} from './widget-source.contract'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const at = '2026-09-05T00:00:00.000Z'
const eligibility = {
	eligible: true,
	reason: 'ELIGIBLE',
	plan: 'EASY',
	startsAt: '2026-09-01T00:00:00.000Z',
	expiresAt: '2026-10-01T00:00:00.000Z',
	checkedAt: at,
	validUntil: '2026-09-05T00:00:05.000Z'
}
const candidate = {
	widgetType: 'WHEEL',
	widgetId: 'cm-widget-1',
	name: 'Колесо 😀',
	isActive: true,
	publishedVersion: 0,
	createdAt: at,
	connection: 'NONE',
	sourceId: null
}
const source = {
	id,
	workspaceId,
	kind: 'WIDGET',
	name: 'Источник 😀',
	widgetType: 'QUIZ',
	widgetId: 'cm-widget-1',
	teamId: null,
	createdBySubject: 'identity-user',
	version: 1,
	enabled: true,
	generation: 1,
	controlVersion: 1,
	appliedControlVersion: null,
	appliedGeneration: null,
	syncState: 'PENDING',
	lastErrorCode: null,
	createdAt: at,
	updatedAt: at,
	syncedAt: null
}
const candidatesPage = {
	schemaVersion: 1,
	workspaceId,
	page: 1,
	pageSize: 25,
	total: 1,
	eligibility,
	items: [candidate]
}
const sourcesPage = {
	schemaVersion: 1,
	page: 1,
	pageSize: 25,
	total: 1,
	items: [source]
}

describe('managed widget source contracts', () => {
	it.each(widgetTypes)(
		'accepts %s while preserving opaque widget IDs and Unicode',
		widgetType => {
			expect(parseWidgetCandidate({ ...candidate, widgetType })).toEqual({
				...candidate,
				widgetType
			})
			expect(
				parseManagedWidgetSource({ ...source, widgetType }, workspaceId)
			).toEqual({ ...source, widgetType })
		}
	)
	it.each([
		'AI_CONSULTANT',
		'CAMPAIGN',
		['WHEEL'],
		{ value: 'QUIZ' },
		null
	])('rejects unsupported or non-scalar widget type %j', widgetType => {
		expect(parseWidgetCandidate({ ...candidate, widgetType })).toBeNull()
		expect(
			parseManagedWidgetSource({ ...source, widgetType }, workspaceId)
		).toBeNull()
	})
	it('binds local candidate source IDs and never accepts an ID exposed from another workspace', () => {
		expect(
			parseWidgetCandidate({
				...candidate,
				connection: 'THIS_WORKSPACE',
				sourceId: id
			})
		).not.toBeNull()
		expect(
			parseWidgetCandidate({ ...candidate, connection: 'OTHER_WORKSPACE' })
		).not.toBeNull()
		for (const change of [
			{ connection: 'THIS_WORKSPACE' },
			{ connection: 'OTHER_WORKSPACE', sourceId: id },
			{ sourceId: id },
			{ connection: ['NONE'] },
			{ connector: { ownerSubject: 'private' } },
			{ publishedVersion: -1 },
			{ publishedVersion: '1' },
			{ isActive: 1 },
			{ widgetId: 'a'.repeat(256) },
			{ widgetId: 'bad id' },
			{ createdAt: '2026-09-05' }
		])
			expect(parseWidgetCandidate({ ...candidate, ...change })).toBeNull()
	})
	it.each(['\uFFFD', '\uD800', '\uDC00', '\u0000', '\n'])(
		'rejects malformed Unicode/control text %j without stripping data',
		bad => {
			expect(parseWidgetCandidate({ ...candidate, name: bad })).toBeNull()
			expect(
				parseManagedWidgetSource(
					{ ...source, name: `Name${bad}` },
					workspaceId
				)
			).toBeNull()
			expect(
				parseManagedWidgetSource(
					{ ...source, createdBySubject: bad },
					workspaceId
				)
			).toBeNull()
		}
	)
	it('keeps display eligibility as a server snapshot, independent of browser clock', () => {
		const now = vi
			.spyOn(Date, 'now')
			.mockReturnValue(Date.parse('2040-01-01T00:00:00.000Z'))
		try {
			expect(parseWidgetEligibility(eligibility)).toEqual(eligibility)
		} finally {
			now.mockRestore()
		}
		expect(
			parseWidgetEligibility({ ...eligibility, plan: 'HARD' })
		).not.toBeNull()
	})
	it('accepts all documented denials including the inactive legacy nullable period', () => {
		const deny = { ...eligibility, eligible: false, validUntil: at }
		for (const change of [
			{
				reason: 'NO_SUBSCRIPTION',
				plan: null,
				startsAt: null,
				expiresAt: null
			},
			{ reason: 'TRIAL', plan: 'TRIAL', expiresAt: null },
			{ reason: 'INACTIVE', startsAt: null, expiresAt: null },
			{ reason: 'NOT_STARTED', startsAt: '2026-09-06T00:00:00.000Z' },
			{ reason: 'EXPIRED', expiresAt: at }
		])
			expect(parseWidgetEligibility({ ...deny, ...change })).toEqual({
				...deny,
				...change
			})
	})
	it.each([
		{ schemaVersion: 1 },
		{ ownerSubject: 'private' },
		{ subscriptionId: 'private' },
		{ eligible: 'true' },
		{ reason: ['ELIGIBLE'] },
		{ plan: ['EASY'] },
		{ plan: 'TRIAL' },
		{ reason: 'TRIAL' },
		{ reason: 'UNRECOGNIZED' },
		{ validUntil: '2026-09-05T00:00:05.001Z' },
		{ validUntil: at },
		{ validUntil: '2026-09-04T23:59:59.999Z' },
		{ expiresAt: at },
		{ startsAt: '2026-09-06T00:00:00.000Z' },
		{ checkedAt: '2026-09-05T00:00:00Z' },
		{ eligible: false },
		{ eligible: false, reason: 'INACTIVE' },
		{ eligible: false, reason: 'NO_SUBSCRIPTION', validUntil: at },
		{ eligible: false, reason: 'NOT_STARTED', validUntil: at },
		{ eligible: false, reason: 'EXPIRED', validUntil: at }
	])('rejects inconsistent eligibility %j', change => {
		expect(
			parseWidgetEligibility({ ...eligibility, ...change })
		).toBeNull()
	})
	it('accepts truthful synced and pending reconfiguration states', () => {
		const applied = {
			...source,
			appliedControlVersion: 1,
			appliedGeneration: 1,
			syncedAt: at
		}
		expect(
			parseManagedWidgetSource(
				{ ...applied, syncState: 'SYNCED' },
				workspaceId
			)
		).not.toBeNull()
		expect(
			parseManagedWidgetSource(
				{ ...applied, version: 2, controlVersion: 2, enabled: false },
				workspaceId
			)
		).not.toBeNull()
		expect(
			parseManagedWidgetSource(
				{ ...source, lastErrorCode: 'DEPENDENCY_UNAVAILABLE' },
				workspaceId
			)
		).not.toBeNull()
		for (const syncState of ['BLOCKED', 'ERROR'])
			expect(
				parseManagedWidgetSource(
					{ ...source, syncState, lastErrorCode: 'CONTROL_CONFLICT' },
					workspaceId
				)
			).not.toBeNull()
	})
	it.each([
		{ workspaceId: other },
		{ id: '../foreign' },
		{ kind: 'WEBHOOK' },
		{ ownerSubject: 'private' },
		{ name: ' padded ' },
		{ name: '' },
		{ name: 'x'.repeat(201) },
		{ teamId: 'not-uuid' },
		{ version: 0 },
		{ version: 2147483647 },
		{ version: '1' },
		{ controlVersion: 2 },
		{ generation: 2 },
		{ syncState: ['PENDING'] },
		{ syncState: 'DELIVERED' },
		{ syncState: 'SYNCED' },
		{ enabled: 'true' },
		{ lastErrorCode: 'PRIVATE_RAW_ERROR' },
		{ appliedControlVersion: 1 },
		{ appliedGeneration: 1 },
		{ syncedAt: at },
		{ appliedControlVersion: 2, appliedGeneration: 1, syncedAt: at },
		{ appliedControlVersion: 1, appliedGeneration: 2, syncedAt: at },
		{
			syncState: 'SYNCED',
			appliedControlVersion: 1,
			appliedGeneration: 1,
			syncedAt: at,
			lastErrorCode: 'CONTROL_CONFLICT'
		}
	])('rejects invalid source binding/version/proof %j', change => {
		expect(
			parseManagedWidgetSource({ ...source, ...change }, workspaceId)
		).toBeNull()
	})
	it('checks exact source envelopes without inventing a top-level workspaceId', () => {
		expect(
			parseWidgetSourcesPage(sourcesPage, workspaceId, 1, 25)
		).toEqual(sourcesPage)
		expect(
			parseWidgetSourcesPage(
				{ ...sourcesPage, workspaceId },
				workspaceId,
				1,
				25
			)
		).toBeNull()
		expect(parseWidgetSourcesPage(sourcesPage, other, 1, 25)).toBeNull()
		expect(
			parseWidgetSourceResult(
				{ schemaVersion: 1, source },
				workspaceId,
				id
			)
		).toEqual(source)
		expect(
			parseWidgetSourceResult(
				{ schemaVersion: 1, source },
				workspaceId,
				other
			)
		).toBeNull()
		expect(
			parseWidgetSourceResult(
				{ schemaVersion: 1, source, command: {} },
				workspaceId
			)
		).toBeNull()
	})
	it('rejects pagination drift, duplicate items and cross-workspace candidates', () => {
		expect(
			parseWidgetCandidatesPage(candidatesPage, workspaceId, 1, 25)
		).toEqual(candidatesPage)
		expect(
			parseWidgetCandidatesPage(candidatesPage, other, 1, 25)
		).toBeNull()
		for (const change of [
			{ page: 2 },
			{ pageSize: 100 },
			{ schemaVersion: '1' },
			{ total: -1 },
			{ total: 0 },
			{ total: '1' },
			{ total: NaN },
			{ total: 2, items: [candidate, candidate] }
		])
			expect(
				parseWidgetCandidatesPage(
					{ ...candidatesPage, ...change },
					workspaceId,
					1,
					25
				)
			).toBeNull()
		expect(
			parseWidgetSourcesPage(
				{ ...sourcesPage, total: 2, items: [source, source] },
				workspaceId,
				1,
				25
			)
		).toBeNull()
		for (const [page, size] of [
			[0, 25],
			[1000001, 25],
			[1, 0],
			[1, 101]
		]) {
			expect(
				parseWidgetCandidatesPage(
					{ ...candidatesPage, page, pageSize: size },
					workspaceId,
					page,
					size
				)
			).toBeNull()
			expect(
				parseWidgetSourcesPage(
					{ ...sourcesPage, page, pageSize: size },
					workspaceId,
					page,
					size
				)
			).toBeNull()
		}
	})
	it('rejects uppercase or non-v4 UUIDs and missing keys', () => {
		const upper = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'.toUpperCase()
		expect(
			parseManagedWidgetSource({ ...source, id: upper }, workspaceId)
		).toBeNull()
		expect(
			parseManagedWidgetSource(
				{ ...source, id: '22222222-2222-1222-8222-222222222222' },
				workspaceId
			)
		).toBeNull()
		const incomplete: Record<string, unknown> = { ...source }
		delete incomplete.syncedAt
		expect(parseManagedWidgetSource(incomplete, workspaceId)).toBeNull()
		for (const value of [null, [], 'source', false])
			expect(parseManagedWidgetSource(value, workspaceId)).toBeNull()
	})
})
