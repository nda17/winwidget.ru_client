import {
	authenticatedRequest,
	invalidContractError
} from '@/shared/api/authenticated-http-client'
import { isUuidV4 } from '@/shared/lib/contract'
import { parseWidgetEntryDetails } from '../model/widget-details.contract'

export const getWidgetEntryDetails = async (
	accessToken: string,
	workspaceId: string,
	entryId: string,
	sourceId: string
) => {
	if (![workspaceId, entryId, sourceId].every(isUuidV4))
		throw invalidContractError()
	const response = await authenticatedRequest({
		accessToken,
		method: 'GET',
		url: `/crm/intake/inbox/${entryId}/widget-details`,
		params: { workspaceId }
	})
	const result = parseWidgetEntryDetails(
		response,
		workspaceId,
		entryId,
		sourceId
	)
	if (!result) throw invalidContractError()
	return result
}
