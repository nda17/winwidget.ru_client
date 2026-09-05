import { resolveWorkspaceSource } from './resolve-workspace-source.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const sourceUrl = resolveWorkspaceSource(
	'src/features/admin-crm/model/crm-template-catalog.contract.ts'
)
const source = await readFile(sourceUrl, 'utf8')
const compiled = ts.transpileModule(source, {
	compilerOptions: {
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2022
	}
}).outputText
const contractModule = { exports: {} }
const loadContract = new Function('exports', 'module', compiled)
loadContract(contractModule.exports, contractModule)
const { parseCrmPipelineTemplateCatalog } = contractModule.exports

const validCatalog = () => ({
	schemaVersion: 1,
	catalogRevision: 1,
	templates: [
		{
			key: 'services',
			version: 1,
			name: 'Услуги',
			description: 'Проверочный шаблон',
			industryTags: ['services'],
			isBlank: false,
			stages: [
				{ key: 'new', name: 'Новая', order: 1, state: 'OPEN' },
				{ key: 'won', name: 'Успех', order: 2, state: 'WON' },
				{ key: 'lost', name: 'Отказ', order: 3, state: 'LOST' }
			]
		}
	]
})

test('accepts the supported immutable WinCRM catalog contract', () => {
	assert.deepEqual(
		parseCrmPipelineTemplateCatalog(validCatalog()),
		validCatalog()
	)
})

test('accepts a newer catalog revision within schema version 1', () => {
	const catalog = validCatalog()
	catalog.catalogRevision = 2
	assert.deepEqual(parseCrmPipelineTemplateCatalog(catalog), catalog)
})

test('rejects a non-positive catalog revision', () => {
	const catalog = validCatalog()
	catalog.catalogRevision = 0
	assert.throws(() => parseCrmPipelineTemplateCatalog(catalog))
})

test('rejects a template version outside the PostgreSQL SMALLINT contract', () => {
	const catalog = validCatalog()
	catalog.templates[0].version = 32768
	assert.throws(() => parseCrmPipelineTemplateCatalog(catalog))
})

test('rejects duplicate template versions', () => {
	const catalog = validCatalog()
	catalog.templates.push(structuredClone(catalog.templates[0]))
	assert.throws(() => parseCrmPipelineTemplateCatalog(catalog))
})

test('rejects broken stage order and terminal semantics', () => {
	const invalidOrder = validCatalog()
	invalidOrder.templates[0].stages[0].order = 2
	assert.throws(() => parseCrmPipelineTemplateCatalog(invalidOrder))

	const invalidTerminal = validCatalog()
	invalidTerminal.templates[0].stages[1].state = 'LOST'
	assert.throws(() => parseCrmPipelineTemplateCatalog(invalidTerminal))
})

test('rejects unknown fields at every catalog contract level', () => {
	const catalogWithExtra = validCatalog()
	catalogWithExtra.unexpected = true
	assert.throws(() => parseCrmPipelineTemplateCatalog(catalogWithExtra))

	const templateWithExtra = validCatalog()
	templateWithExtra.templates[0].unexpected = true
	assert.throws(() => parseCrmPipelineTemplateCatalog(templateWithExtra))

	const stageWithExtra = validCatalog()
	stageWithExtra.templates[0].stages[0].unexpected = true
	assert.throws(() => parseCrmPipelineTemplateCatalog(stageWithExtra))
})

const pricingSource = await readFile(
	resolveWorkspaceSource(
		'src/features/admin-crm/model/crm-pricing.contract.ts'
	),
	'utf8'
)
const pricingCompiled = ts.transpileModule(pricingSource, {
	compilerOptions: {
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2022
	}
}).outputText
const pricingModule = { exports: {} }
new Function('exports', 'module', pricingCompiled)(
	pricingModule.exports,
	pricingModule
)
const {
	parseCrmPricingSettings,
	parseCrmRublesInput,
	formatCrmRublesInput,
	createCrmPricingDraft,
	parseCrmPricingDraft,
	createCrmPricingCommand,
	parseCrmPricingCommandResult
} = pricingModule.exports

const validPricing = () => ({
	schemaVersion: 1,
	productCode: 'WINCRM',
	version: 1,
	currency: 'RUB',
	monthlyPriceMinor: 199000,
	yearlyPriceMinor: 1990000,
	additionalSeatMonthlyPriceMinor: 49000,
	additionalSeatYearlyPriceMinor: 490000,
	includedSeats: 2,
	trialSeatLimit: 5,
	trialDays: 5,
	graceDays: 3,
	createdAt: '2026-09-05T12:00:00.000Z'
})

test('accepts exact WinCRM policy with independently configured seat limits', () => {
	assert.deepEqual(parseCrmPricingSettings(validPricing()), validPricing())
	const updated = { ...validPricing(), version: 2, includedSeats: 10 }
	assert.deepEqual(parseCrmPricingSettings(updated), updated)
})

test('rejects incompatible policy fields, products and fixed lifecycle values', () => {
	for (const patch of [
		{ schemaVersion: 2 },
		{ productCode: 'WIDGETS' },
		{ currency: 'USD' },
		{ version: 0 },
		{ version: Number.MAX_SAFE_INTEGER + 1 },
		{ trialDays: 7 },
		{ graceDays: 0 },
		{ unexpected: 'field' },
		{ createdAt: 'not-a-date' },
		{ createdAt: '2026-02-30T12:00:00.000Z' }
	]) {
		assert.throws(() =>
			parseCrmPricingSettings({ ...validPricing(), ...patch })
		)
	}
	const missingSeatLimit = validPricing()
	delete missingSeatLimit.trialSeatLimit
	assert.throws(() => parseCrmPricingSettings(missingSeatLimit))
	assert.throws(() => parseCrmPricingSettings(null))
})

test('rejects invalid money and a seat count below two in backend responses', () => {
	for (const key of [
		'monthlyPriceMinor',
		'yearlyPriceMinor',
		'additionalSeatMonthlyPriceMinor',
		'additionalSeatYearlyPriceMinor'
	]) {
		for (const value of [0, -1, 0.5, 100000001, Infinity, '199000']) {
			assert.throws(() =>
				parseCrmPricingSettings({ ...validPricing(), [key]: value })
			)
		}
	}
	for (const key of ['includedSeats', 'trialSeatLimit']) {
		for (const value of [0, 1, -1, 2.5, 10001, '2']) {
			assert.throws(() =>
				parseCrmPricingSettings({ ...validPricing(), [key]: value })
			)
		}
	}
})

test('converts decimal rubles exactly, including one kopeck and the upper bound', () => {
	for (const [input, expected] of [
		['1990', 199000],
		['0,01', 1],
		['0.29', 29],
		['10,1', 1010],
		['19.99', 1999],
		[' 0019,99 ', 1999],
		['1000000', 100000000]
	]) {
		assert.equal(parseCrmRublesInput(input), expected)
	}
})

test('rejects empty, negative, rounded, exponent and out-of-range ruble input', () => {
	for (const value of [
		'',
		' ',
		'0',
		'-1',
		'+1',
		'0,001',
		'1.999',
		'1,',
		'1e3',
		'0x10',
		'Infinity',
		'NaN',
		'1 990',
		'1,2.3',
		'1000000.01',
		'9007199254740991'
	]) {
		assert.equal(parseCrmRublesInput(value), null, value)
	}
})

test('formats prices without losing kopecks on a read-edit round trip', () => {
	for (const minor of [1, 29, 99, 100, 101, 110, 199000, 100000000]) {
		assert.equal(parseCrmRublesInput(formatCrmRublesInput(minor)), minor)
	}
	const settings = { ...validPricing(), monthlyPriceMinor: 199099 }
	const values = parseCrmPricingDraft(createCrmPricingDraft(settings))
	assert.equal(values.monthlyPriceMinor, 199099)
	assert.equal(values.includedSeats, 2)
	assert.equal(values.trialSeatLimit, 5)
})

test('draft validation rejects invalid employee limits without silently rounding', () => {
	for (const key of ['includedSeats', 'trialSeatLimit']) {
		for (const value of ['', '1', '1.9', '2.5', '2e1', '10001', '-2']) {
			assert.equal(
				parseCrmPricingDraft({
					...createCrmPricingDraft(validPricing()),
					[key]: value
				}),
				null
			)
		}
	}
})

test('new commands bind exact policy version and integer prices to a UUID', () => {
	const settings = validPricing()
	const draft = createCrmPricingDraft(settings)
	draft.monthlyPriceMinor = '2990,99'
	const command = createCrmPricingCommand(
		settings,
		draft,
		'91000000-0000-4000-8000-000000000001',
		null
	)
	assert.equal(command.expectedVersion, settings.version)
	assert.equal(command.monthlyPriceMinor, 299099)
	assert.equal(command.commandId, '91000000-0000-4000-8000-000000000001')
	assert.equal('currency' in command, false)
	assert.equal('trialDays' in command, false)
	assert.throws(() =>
		createCrmPricingCommand(settings, draft, 'invalid', null)
	)
	assert.throws(() =>
		createCrmPricingCommand(
			settings,
			{ ...draft, includedSeats: '1' },
			command.commandId,
			null
		)
	)
})

test('unknown outcome retries retain original command even after data and draft change', () => {
	const settings = validPricing()
	const command = createCrmPricingCommand(
		settings,
		createCrmPricingDraft(settings),
		'91000000-0000-4000-8000-000000000001',
		null
	)
	const changed = { ...settings, version: 8, monthlyPriceMinor: 499000 }
	const retry = createCrmPricingCommand(
		changed,
		createCrmPricingDraft(changed),
		'91000000-0000-4000-8000-000000000002',
		command
	)
	assert.strictEqual(retry, command)
	assert.equal(retry.expectedVersion, 1)
	assert.equal(retry.monthlyPriceMinor, 199000)
})

test('command acknowledgement must match all submitted prices, limits and next version', () => {
	const settings = validPricing()
	const command = createCrmPricingCommand(
		settings,
		createCrmPricingDraft(settings),
		'91000000-0000-4000-8000-000000000001',
		null
	)
	const result = { ...settings, version: 2 }
	assert.deepEqual(parseCrmPricingCommandResult(result, command), result)
	for (const patch of [
		{ version: 1 },
		{ version: 3 },
		{ includedSeats: 3 },
		{ trialSeatLimit: 6 },
		{ additionalSeatYearlyPriceMinor: 590000 },
		{ monthlyPriceMinor: 299000 }
	]) {
		assert.throws(() =>
			parseCrmPricingCommandResult({ ...result, ...patch }, command)
		)
	}
})
