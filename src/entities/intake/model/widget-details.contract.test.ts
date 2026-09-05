import { describe, expect, it } from 'vitest'
import {
	MAX_WIDGET_SNAPSHOT_BYTES,
	parseWidgetEntryDetails,
	parseWidgetLeadSnapshot,
	type LeadWidgetType,
	type WidgetLeadSnapshot
} from './widget-details.contract'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const entryId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const details: Record<LeadWidgetType, WidgetLeadSnapshot['details']> = {
	WHEEL: { type: 'WHEEL', bonus: 'Скидка 10%' },
	QUIZ: {
		type: 'QUIZ',
		result: 'Подходящий вариант',
		answers: [
			{
				questionId: 'q1',
				questionText: 'Что нужно?',
				options: [{ id: 'one', text: 'Первый вариант' }]
			}
		]
	},
	CALLBACK: {
		type: 'CALLBACK',
		timeSlot: '12:00–14:00',
		timezone: 'Europe/Moscow'
	},
	TIMER: { type: 'TIMER' },
	STOP_OFFER: { type: 'STOP_OFFER' },
	CALCULATOR: {
		type: 'CALCULATOR',
		calculatedPrice: '999999999999.99',
		currency: 'RUB',
		answers: [
			{
				fieldId: 'n',
				fieldLabel: 'Количество',
				type: 'number',
				value: 2.5,
				valueLabel: '2,5'
			},
			{
				fieldId: 's',
				fieldLabel: 'Пакет',
				type: 'select',
				value: 'option1',
				valueLabel: 'Большой'
			},
			{
				fieldId: 'r',
				fieldLabel: 'Вариант',
				type: 'radio',
				value: 'option2',
				valueLabel: 'Второй'
			},
			{
				fieldId: 'c',
				fieldLabel: 'Услуги',
				type: 'checkbox',
				value: ['option1', 'option2'],
				valueLabel: 'Оба'
			}
		]
	}
}
const snapshot = (type: LeadWidgetType = 'TIMER'): WidgetLeadSnapshot => ({
	schemaVersion: 1,
	widget: {
		id: 'cm-widget',
		type,
		name: 'Заявка 😊',
		publishedVersion: 4
	},
	lead: {
		id: 'cm-lead',
		createdAt: '2026-09-05T10:00:00.000Z',
		contactName: null,
		contactRaw: null,
		phoneRaw: '+79001234567',
		phoneE164: '+79001234567',
		email: null,
		pageUrl: 'https://example.test/form',
		redactions: ['URL_QUERY_REMOVED']
	},
	details: structuredClone(details[type])
})
describe('Widgets six-type stored snapshot contract', () => {
	it.each(Object.keys(details) as LeadWidgetType[])(
		'reads exact %s source data without normalizing source values',
		type => {
			const value = snapshot(type)
			expect(parseWidgetLeadSnapshot(value)).toEqual(value)
		}
	)
	it('keeps absent, empty and whitespace source name distinct from normalized Inbox name', () => {
		for (const contactName of [null, '', '  ', 'Иван']) {
			const value = snapshot()
			value.lead.contactName = contactName
			expect(parseWidgetLeadSnapshot(value)?.lead.contactName).toBe(
				contactName
			)
		}
	})
	it.each([
		{ schemaVersion: 2 },
		{ extra: 'hidden-data' },
		{ widget: { ...snapshot().widget, type: 'AI_CONSULTANT' } },
		{ widget: { ...snapshot().widget, publishedVersion: 0 } },
		{ widget: { ...snapshot().widget, id: 'bad id' } },
		{ widget: { ...snapshot().widget, config: {} } },
		{ lead: { ...snapshot().lead, ip: 'private' } },
		{ lead: { ...snapshot().lead, createdAt: '2026-09-05' } },
		{ lead: { ...snapshot().lead, phoneE164: '+79007654321' } },
		{ lead: { ...snapshot().lead, phoneE164: '79001234567' } },
		{ lead: { ...snapshot().lead, redactions: ['UNKNOWN'] } },
		{
			lead: {
				...snapshot().lead,
				redactions: ['URL_REJECTED', 'URL_REJECTED']
			}
		},
		{ details: { type: 'WHEEL', bonus: null } },
		{ details: { type: 'TIMER', secret: 'not-allowed' } }
	])('rejects malformed shapes and unwanted fields', patch => {
		expect(parseWidgetLeadSnapshot({ ...snapshot(), ...patch })).toBeNull()
	})
	it.each([
		'<script>alert(1)</script>',
		'x\u0000y',
		'\ud800',
		'\udc00',
		'\ufffd'
	])(
		'rejects unsupported source text without exposing it in errors',
		name => {
			const value = snapshot()
			value.widget.name = name
			expect(parseWidgetLeadSnapshot(value)).toBeNull()
		}
	)
	it.each([
		'javascript:alert(1)',
		'data:text/html,private',
		'https://user:pass@example.test/',
		'https://example.test/?token=private',
		'https://example.test/#private',
		'https://example.test/?',
		'https://example.test/#',
		'https://example.test',
		' https://example.test/'
	])('rejects unredacted or noncanonical URLs', pageUrl => {
		const value = snapshot()
		value.lead.pageUrl = pageUrl
		expect(parseWidgetLeadSnapshot(value)).toBeNull()
	})
	it('rejects unknown, repeated, oversized and incorrectly typed answers', () => {
		const quiz = snapshot('QUIZ')
		if (quiz.details.type !== 'QUIZ') throw new Error('fixture')
		quiz.details.answers.push(quiz.details.answers[0])
		expect(parseWidgetLeadSnapshot(quiz)).toBeNull()
		quiz.details.answers = Array.from({ length: 21 }, (_, index) => ({
			questionId: `q${index}`,
			questionText: null,
			options: []
		}))
		expect(parseWidgetLeadSnapshot(quiz)).toBeNull()
		quiz.details.answers = [
			{
				questionId: 'q',
				questionText: null,
				options: [
					{ id: 'a', text: null },
					{ id: 'a', text: null }
				]
			}
		]
		expect(parseWidgetLeadSnapshot(quiz)).toBeNull()
		for (const value of ['NaN', Number.NaN, Infinity]) {
			const calc = snapshot('CALCULATOR')
			if (calc.details.type !== 'CALCULATOR') throw new Error('fixture')
			calc.details.answers[0] = { ...calc.details.answers[0], value }
			expect(parseWidgetLeadSnapshot(calc)).toBeNull()
		}
		for (const calculatedPrice of [
			'1e2',
			'10',
			'-1.00',
			'1000000000000.00'
		]) {
			const calc = snapshot('CALCULATOR')
			calc.details = {
				...details.CALCULATOR,
				calculatedPrice
			} as WidgetLeadSnapshot['details']
			expect(parseWidgetLeadSnapshot(calc)).toBeNull()
		}
	})
	it('enforces the exact 256 KiB UTF-8 boundary without truncating emoji', () => {
		const value = snapshot('QUIZ')
		if (value.details.type !== 'QUIZ') throw new Error('fixture')
		value.details.result = ''
		value.details.answers = Array.from({ length: 2 }, (_, question) => ({
			questionId: `q${question}`,
			questionText: 'Вопрос',
			options: Array.from({ length: 13 }, (_, option) => ({
				id: `o${option}`,
				text: 'x'.repeat(9900)
			}))
		}))
		const padding =
			MAX_WIDGET_SNAPSHOT_BYTES -
			new TextEncoder().encode(JSON.stringify(value)).byteLength
		expect(padding).toBeGreaterThan(0)
		expect(padding).toBeLessThan(10000)
		value.details.result = 'x'.repeat(padding)
		expect(parseWidgetLeadSnapshot(value)).not.toBeNull()
		value.details.result += '😊'
		expect(parseWidgetLeadSnapshot(value)).toBeNull()
	})
	it('rejects a cyclic object and binds the detail envelope to all expected identifiers', () => {
		const circular: Record<string, unknown> = {}
		circular.self = circular
		expect(parseWidgetLeadSnapshot(circular)).toBeNull()
		const value = {
			schemaVersion: 1,
			workspaceId,
			entryId,
			sourceId,
			payload: snapshot()
		}
		expect(
			parseWidgetEntryDetails(value, workspaceId, entryId, sourceId)
		).toEqual(value)
		for (const patch of [
			{ workspaceId: sourceId },
			{ entryId: sourceId },
			{ sourceId: entryId },
			{ extra: true },
			{ schemaVersion: 2 }
		])
			expect(
				parseWidgetEntryDetails(
					{ ...value, ...patch },
					workspaceId,
					entryId,
					sourceId
				)
			).toBeNull()
	})
})
