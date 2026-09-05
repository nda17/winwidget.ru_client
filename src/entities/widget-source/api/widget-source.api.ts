import {
	authenticatedRequest,
	invalidContractError
} from '@/shared/api/authenticated-http-client'
import { hasExactKeys, isRecord } from '@/shared/lib/contract'
import {
	isWidgetSourceIdentifier,
	isWidgetSourceInteger,
	isWidgetSourceText,
	isWidgetSourceUuid,
	parseManagedWidgetSource,
	parseWidgetCandidatesPage,
	parseWidgetSourceResult,
	parseWidgetSourcesPage,
	widgetTypes,
	type WidgetSourceCommand,
	type WidgetSourceCommandResult
} from '../model/widget-source.contract'

const root = '/crm/intake/widget-sources'
const checked = <T>(result: T | null): T => {
	if (result === null) throw invalidContractError()
	return result
}
const safeId = (value: unknown): string => {
	if (!isWidgetSourceUuid(value)) throw invalidContractError()
	return value
}
const pageParams = (
	workspaceId: string,
	page: number,
	pageSize: number
) => {
	if (
		!isWidgetSourceInteger(page, 1, 1000000) ||
		!isWidgetSourceInteger(pageSize, 1, 100)
	)
		throw invalidContractError()
	return {
		workspaceId: safeId(workspaceId),
		page: String(page),
		pageSize: String(pageSize)
	}
}
export const listWidgetCandidates = async (
	accessToken: string,
	workspaceId: string,
	page: number,
	pageSize = 25
) =>
	checked(
		parseWidgetCandidatesPage(
			await authenticatedRequest({
				accessToken,
				method: 'GET',
				url: `${root}/candidates`,
				params: pageParams(workspaceId, page, pageSize)
			}),
			workspaceId,
			page,
			pageSize
		)
	)
export const listWidgetSources = async (
	accessToken: string,
	workspaceId: string,
	page: number,
	pageSize = 25
) =>
	checked(
		parseWidgetSourcesPage(
			await authenticatedRequest({
				accessToken,
				method: 'GET',
				url: root,
				params: pageParams(workspaceId, page, pageSize)
			}),
			workspaceId,
			page,
			pageSize
		)
	)
export const getWidgetSource = async (
	accessToken: string,
	workspaceId: string,
	id: string
) =>
	checked(
		parseWidgetSourceResult(
			await authenticatedRequest({
				accessToken,
				method: 'GET',
				url: `${root}/${safeId(id)}`,
				params: { workspaceId: safeId(workspaceId) }
			}),
			workspaceId,
			id
		)
	)

/** Creates no UUID and performs no hidden retry, persistence, logout or cache mutation. */
export const mutateWidgetSource = async (
	accessToken: string,
	command: WidgetSourceCommand
): Promise<WidgetSourceCommandResult> => {
	if (!isRecord(command)) throw invalidContractError()
	const workspaceId = safeId(command.workspaceId),
		commandId = safeId(command.commandId)
	const operation = command.operation
	let id: string | undefined
	let fields: Record<string, string | number | boolean | null>
	if (operation === 'create') {
		if (
			!hasExactKeys(command, [
				'operation',
				'workspaceId',
				'commandId',
				'name',
				'widgetType',
				'widgetId',
				'teamId'
			]) ||
			!isWidgetSourceText(command.name, 200) ||
			!command.name.trim() ||
			!widgetTypes.includes(command.widgetType) ||
			!isWidgetSourceIdentifier(command.widgetId, 255) ||
			!(command.teamId === null || isWidgetSourceUuid(command.teamId))
		)
			throw invalidContractError()
		fields = {
			name: command.name,
			widgetType: command.widgetType,
			widgetId: command.widgetId,
			teamId: command.teamId
		}
	} else if (operation === 'configure' || operation === 'retry') {
		if (
			!hasExactKeys(command, [
				'operation',
				'workspaceId',
				'commandId',
				'id',
				'expectedVersion',
				...(operation === 'configure' ? ['enabled'] : [])
			]) ||
			!isWidgetSourceInteger(command.expectedVersion, 1, 2147483645) ||
			(operation === 'configure' && typeof command.enabled !== 'boolean')
		)
			throw invalidContractError()
		id = safeId(command.id)
		fields = {
			expectedVersion: command.expectedVersion,
			...(operation === 'configure' ? { enabled: command.enabled } : {})
		}
	} else throw invalidContractError()
	// Snapshot all primitive values before yielding; callers cannot alter response binding in flight.
	const body = Object.freeze({
		schemaVersion: 1,
		workspaceId,
		commandId,
		...fields
	})
	const result = await authenticatedRequest({
		accessToken,
		method: 'POST',
		url: `${root}${id ? `/${id}/${operation}` : ''}`,
		headers: { 'Idempotency-Key': commandId },
		data: body
	})
	if (
		!isRecord(result) ||
		!hasExactKeys(result, ['schemaVersion', 'source', 'command']) ||
		result.schemaVersion !== 1 ||
		!isRecord(result.command) ||
		!hasExactKeys(result.command, ['id', 'state']) ||
		result.command.id !== commandId ||
		result.command.state !== 'QUEUED'
	)
		throw invalidContractError()
	const source = checked(
		parseManagedWidgetSource(result.source, workspaceId)
	)
	if (
		(id !== undefined && source.id !== id) ||
		source.syncState !== 'PENDING' ||
		source.lastErrorCode !== null
	)
		throw invalidContractError()
	if (operation === 'create') {
		if (
			source.version !== 1 ||
			source.generation !== 1 ||
			!source.enabled ||
			source.appliedControlVersion !== null ||
			source.name !== String(fields.name).trim() ||
			source.widgetType !== fields.widgetType ||
			source.widgetId !== fields.widgetId ||
			source.teamId !== fields.teamId
		)
			throw invalidContractError()
	} else if (
		source.version !==
			Number(fields.expectedVersion) +
				(operation === 'configure' ? 1 : 0) ||
		(operation === 'configure' && source.enabled !== fields.enabled)
	)
		throw invalidContractError()
	return {
		schemaVersion: 1,
		source,
		command: { id: commandId, state: 'QUEUED' }
	}
}
