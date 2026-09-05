export { default as adminCrmService } from './api/admin-crm.api'
export {
	CRM_PRICE_FIELDS,
	CRM_SEAT_FIELDS,
	createCrmPricingCommand,
	createCrmPricingDraft,
	parseCrmPricingDraft,
	type CrmPricingCommand,
	type CrmPricingDraft,
	type CrmPricingField,
	type CrmPricingSettings
} from './model/crm-pricing.contract'
export {
	parseCrmPipelineTemplateCatalog,
	type CrmPipelineStageState,
	type CrmPipelineTemplate,
	type CrmPipelineTemplateCatalog,
	type CrmPipelineTemplateStage
} from './model/crm-template-catalog.contract'
