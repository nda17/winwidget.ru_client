import {
	authenticatedRequest,
	invalidContractError
} from '@/shared/api/authenticated-http-client'
import { hasExactKeys, isRecord } from '@/shared/lib/contract'
import {
	isWidgetSourceInteger,
	isWidgetSourceUuid
} from '../model/widget-source.contract'
import {
	parseWidgetTransfer,
	parseWidgetTransfersPage,
	type WidgetTransferRetryCommand,
	type WidgetTransferCommandResult
} from '../model/widget-transfer.contract'

const sourcePath = (workspaceId: unknown, sourceId: unknown) => {
	if (!isWidgetSourceUuid(workspaceId) || !isWidgetSourceUuid(sourceId))
		throw invalidContractError()
	return `/crm/intake/widget-sources/${sourceId}/transfers`
}
export const listWidgetTransfers = async (
	accessToken: string,
	workspaceId: string,
	sourceId: string,
	page: number,
	pageSize = 25
) => {
	const url = sourcePath(workspaceId, sourceId)
	if (
		!isWidgetSourceInteger(page, 1, 1000000) ||
		!isWidgetSourceInteger(pageSize, 1, 100)
	)
		throw invalidContractError()
	const result = parseWidgetTransfersPage(
		await authenticatedRequest({
			accessToken,
			method: 'GET',
			url,
			params: {
				workspaceId,
				page: String(page),
				pageSize: String(pageSize)
			}
		}),
		workspaceId,
		sourceId,
		page,
		pageSize
	)
	if (!result) throw invalidContractError()
	return result
}
/** Keeps the caller's UUID and exact body; never retries or logs out automatically. */
export const retryWidgetTransfer = async (
	accessToken: string,
	command: WidgetTransferRetryCommand
): Promise<WidgetTransferCommandResult> => {
	if (
		!isRecord(command) ||
		!hasExactKeys(command, [
			'workspaceId',
			'sourceId',
			'transferId',
			'commandId',
			'expectedVersion'
		]) ||
		!isWidgetSourceUuid(command.transferId) ||
		!isWidgetSourceUuid(command.commandId) ||
		!isWidgetSourceInteger(command.expectedVersion, 1, 2147483646)
	)
		throw invalidContractError()
	const { workspaceId, sourceId, transferId, commandId, expectedVersion } =
		command
	const url = `${sourcePath(workspaceId, sourceId)}/${transferId}/retry`
	const body = Object.freeze({
		schemaVersion: 1,
		workspaceId,
		commandId,
		expectedVersion
	})
	const result = await authenticatedRequest({
		accessToken,
		method: 'POST',
		url,
		headers: { 'Idempotency-Key': commandId },
		data: body
	})
	if (
		!isRecord(result) ||
		!hasExactKeys(result, ['schemaVersion', 'transfer', 'command']) ||
		result.schemaVersion !== 1 ||
		!isRecord(result.command) ||
		!hasExactKeys(result.command, ['id', 'state']) ||
		result.command.id !== commandId ||
		result.command.state !== 'QUEUED'
	)
		throw invalidContractError()
	const transfer = parseWidgetTransfer(
		result.transfer,
		workspaceId,
		sourceId
	)
	if (
		!transfer ||
		transfer.id !== transferId ||
		transfer.version !== expectedVersion + 1 ||
		transfer.state !== 'RETRY_PENDING' ||
		transfer.reason !== null
	)
		throw invalidContractError()
	return {
		schemaVersion: 1,
		transfer,
		command: { id: commandId, state: 'QUEUED' }
	}
}
