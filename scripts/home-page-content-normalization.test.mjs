import { resolveWorkspaceSource } from './resolve-workspace-source.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const defaultsPath = resolveWorkspaceSource(
	'src/entities/home-page-content/model/home-page-content.defaults.ts'
)
const editorPath = resolveWorkspaceSource(
	'src/screens/admin/ui/content-settings/home-content-editor/HomeContentEditor.tsx'
)

const defaultsSource = await readFile(defaultsPath, 'utf8')
const editorSource = await readFile(editorPath, 'utf8')
const compiledDefaults = ts.transpileModule(defaultsSource, {
	compilerOptions: {
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2022
	},
	fileName: defaultsPath.pathname
}).outputText
const defaultsModule = { exports: {} }

new Function('exports', 'module', compiledDefaults)(
	defaultsModule.exports,
	defaultsModule
)

const {
	DEFAULT_HOME_PAGE_CONTENT,
	normalizeHomePageContent,
	normalizeHomePageDemoWidgetsContent
} = defaultsModule.exports

const demoWidgetKeys = ['bubbleTexts', 'enabled']
const bubbleTextKeys = [
	'aiConsultant',
	'calculator',
	'callback',
	'countdown',
	'quiz',
	'stopOffer',
	'wheel'
]

test('legacy demo widget keys are removed from the normalized PATCH round trip', () => {
	const legacyContent = structuredClone(DEFAULT_HOME_PAGE_CONTENT)
	legacyContent.demoWidgets.labels = {
		wheel: 'Legacy wheel label'
	}
	legacyContent.demoWidgets.legacyMode = true
	legacyContent.demoWidgets.bubbleTexts.legacyBubble = 'Legacy bubble'
	legacyContent.tools.items[4].previewType = 'unsupportedPreview'

	const normalized = normalizeHomePageContent(legacyContent)
	const patchContent = {
		...normalized,
		demoWidgets: normalizeHomePageDemoWidgetsContent(
			normalized.demoWidgets
		)
	}
	const { head, body, ...structuredPatchContent } = patchContent
	void head
	void body

	assert.deepEqual(
		Object.keys(structuredPatchContent.demoWidgets).sort(),
		demoWidgetKeys
	)
	assert.deepEqual(
		Object.keys(structuredPatchContent.demoWidgets.bubbleTexts).sort(),
		bubbleTextKeys
	)
	assert.equal(
		structuredPatchContent.tools.items[4].previewType,
		'aiConsultant'
	)
	assert.deepEqual(
		normalizeHomePageContent(structuredPatchContent).demoWidgets,
		structuredPatchContent.demoWidgets
	)
})

test('current demo widgets payload remains unchanged after canonicalization', () => {
	const currentPayload = structuredClone(
		DEFAULT_HOME_PAGE_CONTENT.demoWidgets
	)

	assert.deepEqual(
		normalizeHomePageDemoWidgetsContent(currentPayload),
		currentPayload
	)
})

test('admin save preparation canonicalizes demo widgets at the PATCH boundary', () => {
	assert.match(
		editorSource,
		/demoWidgets:\s*normalizeHomePageDemoWidgetsContent\(content\.demoWidgets\)/
	)
})
