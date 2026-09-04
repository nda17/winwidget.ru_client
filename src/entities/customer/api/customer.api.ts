import {
	authenticatedRequest,
	invalidContractError
} from '@/shared/api/authenticated-http-client'
import {
	parseCustomerPage,
	parseCustomerResult,
	type CustomerFields,
	type CustomerKind
} from '../model/customer.contract'

export const listCustomers = async (
	accessToken: string,
	kind: CustomerKind,
	workspaceId: string,
	page: number,
	pageSize: number,
	search: string
) => {
	const result = parseCustomerPage(
		await authenticatedRequest({
			accessToken,
			method: 'GET',
			url: `/crm/customers/${kind}`,
			params: {
				workspaceId,
				page: String(page),
				pageSize: String(pageSize),
				search
			}
		}),
		kind,
		workspaceId,
		page,
		pageSize
	)
	if (!result) throw invalidContractError()
	return result
}

export const getCustomer = async (
	accessToken: string,
	kind: CustomerKind,
	workspaceId: string,
	id: string
) => {
	const result = parseCustomerResult(
		await authenticatedRequest({
			accessToken,
			method: 'GET',
			url: `/crm/customers/${kind}/${id}`,
			params: { workspaceId }
		}),
		kind,
		workspaceId,
		id
	)
	if (!result || result.archivedAt !== null) throw invalidContractError()
	return result
}

export interface CustomerMutation {
	kind: CustomerKind
	workspaceId: string
	commandId: string
	id?: string
	expectedVersion?: number
	fields?: CustomerFields
	archive?: boolean
}

export const findCustomerDuplicates = async (
	accessToken: string,
	workspaceId: string,
	phone: string,
	email: string
) => {
	const result = parseCustomerPage(
		await authenticatedRequest({
			accessToken,
			method: 'GET',
			url: '/crm/customers/contacts/duplicates',
			params: {
				workspaceId,
				page: '1',
				pageSize: '25',
				...(phone ? { phone } : {}),
				...(email ? { email } : {})
			}
		}),
		'contacts',
		workspaceId,
		1,
		25
	)
	if (!result) throw invalidContractError()
	return result
}

export const mutateCustomer = async (
	accessToken: string,
	command: CustomerMutation
) => {
	const {
		kind,
		workspaceId,
		commandId,
		id,
		expectedVersion,
		fields,
		archive
	} = command
	const result = parseCustomerResult(
		await authenticatedRequest({
			accessToken,
			method: id && !archive ? 'PUT' : 'POST',
			url: `/crm/customers/${kind}${id ? `/${id}` : ''}${archive ? '/archive' : ''}`,
			headers: { 'Idempotency-Key': commandId },
			data: {
				schemaVersion: 1,
				workspaceId,
				commandId,
				...(id ? { expectedVersion } : {}),
				...(archive ? {} : fields)
			}
		}),
		kind,
		workspaceId,
		id
	)
	if (
		!result ||
		(archive ? result.archivedAt === null : result.archivedAt !== null)
	)
		throw invalidContractError()
	return result
}
