import {
	hasExactKeys,
	isIsoDate,
	isRecord,
	isUuidV4
} from '@/shared/lib/contract'

export const widgetTypeLabels = {
	WHEEL: 'Колесо фортуны',
	QUIZ: 'Квиз',
	CALLBACK: 'Обратный звонок',
	TIMER: 'Таймер',
	STOP_OFFER: 'Стоп-оффер',
	CALCULATOR: 'Калькулятор'
} as const
export type LeadWidgetType = keyof typeof widgetTypeLabels
export const MAX_WIDGET_SNAPSHOT_BYTES = 256 * 1024
const redactions = [
	'URL_USERINFO_REMOVED',
	'URL_QUERY_REMOVED',
	'URL_FRAGMENT_REMOVED',
	'URL_REJECTED'
] as const
export interface WidgetLeadSnapshot {
	schemaVersion: 1
	widget: {
		type: LeadWidgetType
		id: string
		name: string
		publishedVersion: number
	}
	lead: {
		id: string
		createdAt: string
		contactName: string | null
		contactRaw: string | null
		phoneRaw: string | null
		phoneE164: string | null
		email: string | null
		pageUrl: string | null
		redactions: (typeof redactions)[number][]
	}
	details:
		| { type: 'WHEEL'; bonus: string | null }
		| {
				type: 'QUIZ'
				result: string | null
				answers: {
					questionId: string
					questionText: string | null
					options: { id: string; text: string | null }[]
				}[]
		  }
		| {
				type: 'CALLBACK'
				timeSlot: string | null
				timezone: string | null
		  }
		| { type: 'TIMER' | 'STOP_OFFER' }
		| {
				type: 'CALCULATOR'
				calculatedPrice: string
				currency: 'RUB' | 'EUR' | 'USD'
				answers: {
					fieldId: string
					fieldLabel: string
					type: 'number' | 'select' | 'radio' | 'checkbox'
					value: number | string | string[]
					valueLabel: string
				}[]
		  }
}
export interface WidgetEntryDetails {
	schemaVersion: 1
	workspaceId: string
	entryId: string
	sourceId: string
	payload: WidgetLeadSnapshot
}

function ensure(condition: unknown): asserts condition {
	if (!condition) throw new Error('Invalid widget snapshot')
}
function record(value: unknown, keys?: string[]): Record<string, unknown> {
	ensure(isRecord(value) && (!keys || hasExactKeys(value, keys)))
	return value
}
function unicode(value: string) {
	for (let index = 0; index < value.length; index++) {
		const code = value.charCodeAt(index)
		ensure(code !== 0xfffd && !(code >= 0xdc00 && code <= 0xdfff))
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(++index)
			ensure(next >= 0xdc00 && next <= 0xdfff)
		}
	}
}
function text(value: unknown, max: number): asserts value is string {
	ensure(
		typeof value === 'string' &&
			value.length <= max &&
			!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
	)
	unicode(value)
}
function identifier(value: unknown, max = 255): string {
	ensure(
		typeof value === 'string' &&
			value.length > 0 &&
			value.length <= max &&
			!/[\s\u0000-\u001f\u007f]/u.test(value)
	)
	unicode(value)
	return value
}
function list(value: unknown): unknown[] {
	ensure(Array.isArray(value) && value.length <= 20)
	return value
}
function unique(values: string[]) {
	ensure(new Set(values).size === values.length)
}
function canonicalDate(value: unknown) {
	ensure(isIsoDate(value) && value.length === 24)
}

/** Own reader for the frozen Widgets v1 wire contract; no runtime/backend imports. */
export const parseWidgetLeadSnapshot = (
	value: unknown
): WidgetLeadSnapshot | null => {
	try {
		ensure(
			new TextEncoder().encode(JSON.stringify(value)).byteLength <=
				MAX_WIDGET_SNAPSHOT_BYTES
		)
		const payload = record(value, [
			'schemaVersion',
			'widget',
			'lead',
			'details'
		])
		ensure(payload.schemaVersion === 1)
		const widget = record(payload.widget, [
			'type',
			'id',
			'name',
			'publishedVersion'
		])
		ensure(
			typeof widget.type === 'string' &&
				Object.hasOwn(widgetTypeLabels, widget.type)
		)
		identifier(widget.id)
		text(widget.name, 200)
		ensure(
			Number.isInteger(widget.publishedVersion) &&
				Number(widget.publishedVersion) > 0 &&
				Number(widget.publishedVersion) <= 2147483647
		)
		const lead = record(payload.lead, [
			'id',
			'createdAt',
			'contactName',
			'contactRaw',
			'phoneRaw',
			'phoneE164',
			'email',
			'pageUrl',
			'redactions'
		])
		identifier(lead.id)
		canonicalDate(lead.createdAt)
		for (const key of ['contactName', 'contactRaw', 'phoneRaw'])
			if (lead[key] !== null) text(lead[key], 200)
		if (lead.email !== null) text(lead.email, 254)
		ensure(
			lead.phoneE164 === null ||
				(typeof lead.phoneE164 === 'string' &&
					/^\+[1-9][0-9]{7,14}$/.test(lead.phoneE164) &&
					lead.phoneE164 === lead.phoneRaw)
		)
		ensure(
			Array.isArray(lead.redactions) &&
				lead.redactions.length <= 4 &&
				lead.redactions.every(item => redactions.includes(item)) &&
				new Set(lead.redactions).size === lead.redactions.length
		)
		if (lead.pageUrl !== null) {
			text(lead.pageUrl, 500)
			ensure(!/[\u0000-\u0020\u007f]/u.test(lead.pageUrl))
			const url = new URL(lead.pageUrl)
			ensure(
				['https:', 'http:'].includes(url.protocol) &&
					url.href === lead.pageUrl &&
					!url.username &&
					!url.password &&
					!url.search &&
					!url.hash
			)
			url.search = ''
			url.hash = ''
			ensure(url.href === lead.pageUrl)
		}
		const details = record(payload.details)
		ensure(details.type === widget.type)
		switch (details.type) {
			case 'WHEEL':
				record(details, ['type', 'bonus'])
				if (details.bonus !== null) text(details.bonus, 200)
				break
			case 'CALLBACK':
				record(details, ['type', 'timeSlot', 'timezone'])
				for (const key of ['timeSlot', 'timezone'])
					if (details[key] !== null) text(details[key], 100)
				break
			case 'TIMER':
			case 'STOP_OFFER':
				record(details, ['type'])
				break
			case 'QUIZ':
				record(details, ['type', 'result', 'answers'])
				if (details.result !== null) text(details.result, 10000)
				unique(
					list(details.answers).map(raw => {
						const answer = record(raw, [
							'questionId',
							'questionText',
							'options'
						])
						if (answer.questionText !== null)
							text(answer.questionText, 10000)
						unique(
							list(answer.options).map(rawOption => {
								const option = record(rawOption, ['id', 'text'])
								if (option.text !== null) text(option.text, 10000)
								return identifier(option.id, 1024)
							})
						)
						return identifier(answer.questionId, 64)
					})
				)
				break
			case 'CALCULATOR':
				record(details, ['type', 'calculatedPrice', 'currency', 'answers'])
				ensure(
					typeof details.calculatedPrice === 'string' &&
						/^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/.test(
							details.calculatedPrice
						) &&
						typeof details.currency === 'string' &&
						['RUB', 'EUR', 'USD'].includes(details.currency)
				)
				unique(
					list(details.answers).map(raw => {
						const answer = record(raw, [
							'fieldId',
							'fieldLabel',
							'type',
							'value',
							'valueLabel'
						])
						text(answer.fieldLabel, 100)
						text(answer.valueLabel, 4096)
						if (answer.type === 'number')
							ensure(
								typeof answer.value === 'number' &&
									Number.isFinite(answer.value)
							)
						else if (answer.type === 'checkbox')
							unique(
								list(answer.value).map(value => identifier(value, 64))
							)
						else if (answer.type === 'select' || answer.type === 'radio')
							identifier(answer.value, 64)
						else throw new Error('Invalid widget answer')
						return identifier(answer.fieldId, 64)
					})
				)
				break
			default:
				return null
		}
		return value as WidgetLeadSnapshot
	} catch {
		return null
	}
}

export const parseWidgetEntryDetails = (
	value: unknown,
	workspaceId: string,
	entryId: string,
	sourceId: string
): WidgetEntryDetails | null => {
	if (
		!isUuidV4(workspaceId) ||
		!isUuidV4(entryId) ||
		!isUuidV4(sourceId) ||
		!isRecord(value) ||
		!hasExactKeys(value, [
			'schemaVersion',
			'workspaceId',
			'entryId',
			'sourceId',
			'payload'
		]) ||
		value.schemaVersion !== 1 ||
		value.workspaceId !== workspaceId ||
		value.entryId !== entryId ||
		value.sourceId !== sourceId
	)
		return null
	const payload = parseWidgetLeadSnapshot(value.payload)
	return payload
		? { schemaVersion: 1, workspaceId, entryId, sourceId, payload }
		: null
}
