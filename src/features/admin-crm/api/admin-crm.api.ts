import { axiosInterceptorsRequest } from '@/shared/api'
import {
	parseCrmPipelineTemplateCatalog,
	type CrmPipelineTemplateCatalog
} from '../model/crm-template-catalog.contract'

class AdminCrmService {
	async getTemplateCatalog(): Promise<CrmPipelineTemplateCatalog> {
		const { data } =
			await axiosInterceptorsRequest.get<unknown>('/crm/templates')

		return parseCrmPipelineTemplateCatalog(data)
	}
}

const adminCrmService = new AdminCrmService()

export default adminCrmService
