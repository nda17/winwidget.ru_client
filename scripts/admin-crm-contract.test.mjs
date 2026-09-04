import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const sourceUrl = new URL(
	'../src/features/admin-crm/model/crm-template-catalog.contract.ts',
	import.meta.url
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
