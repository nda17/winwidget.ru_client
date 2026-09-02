import {
	parseCrmAccessBootstrap,
	parseCrmTrialActivation,
	type CrmAccessBootstrapResponse,
	type CrmTrialActivationResponse
} from '@/entities/crm-access'
import {
	parsePipelineTemplateCatalog,
	type PipelineTemplateCatalog
} from '@/entities/pipeline-template'
import {
	authenticatedRequest,
	invalidContractError
} from '@/shared/api/authenticated-http-client'

export const getCrmAccessBootstrap = async (
	accessToken: string,
	workspaceId?: string
): Promise<CrmAccessBootstrapResponse> => {
	const response = await authenticatedRequest({
		accessToken,
		method: 'GET',
		url: '/crm/access/bootstrap',
		params: workspaceId ? { workspaceId } : undefined
	})
	const parsed = parseCrmAccessBootstrap(response, workspaceId)
	if (!parsed) throw invalidContractError()
	return parsed
}

export const activateCrmTrial = async (
	accessToken: string,
	command: { workspaceId: string; commandId: string }
): Promise<CrmTrialActivationResponse> => {
	const response = await authenticatedRequest({
		accessToken,
		method: 'POST',
		url: '/crm/access/trial',
		headers: { 'Idempotency-Key': command.commandId },
		data: { schemaVersion: 1, ...command }
	})
	const parsed = parseCrmTrialActivation(response, command.workspaceId)
	if (!parsed) throw invalidContractError()
	return parsed
}

export const getPipelineTemplates = async (
	accessToken: string
): Promise<PipelineTemplateCatalog> => {
	const response = await authenticatedRequest({
		accessToken,
		method: 'GET',
		url: '/crm/templates'
	})
	const parsed = parsePipelineTemplateCatalog(response)
	if (!parsed) throw invalidContractError()
	return parsed
}
