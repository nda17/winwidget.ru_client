import {
	authenticatedRequest,
	invalidContractError
} from '@/shared/api/authenticated-http-client'
import { parseSalesAnalytics } from '../model/sales-analytics.contract'

export const getSalesAnalytics = async (
	accessToken: string,
	workspaceId: string
) => {
	const result = parseSalesAnalytics(
		await authenticatedRequest({
			accessToken,
			method: 'GET',
			url: '/crm/sales/analytics',
			params: { workspaceId }
		})
	)
	if (!result) throw invalidContractError()
	return result
}
