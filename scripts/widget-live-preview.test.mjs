import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const previewPath = new URL(
	'../src/features/edit-widget-settings/ui/shared/WidgetLivePreview.tsx',
	import.meta.url
)
const stylesPath = new URL(
	'../src/features/edit-widget-settings/ui/shared/WidgetLivePreview.module.scss',
	import.meta.url
)
const widgetSettingsPath = new URL(
	'../src/screens/widget-settings/ui/WidgetSettings.tsx',
	import.meta.url
)
const widgetSettingsStylesPath = new URL(
	'../src/screens/widget-settings/ui/WidgetSettings.module.scss',
	import.meta.url
)

const [
	previewSource,
	stylesSource,
	widgetSettingsSource,
	widgetSettingsStylesSource
] = await Promise.all([
	readFile(previewPath, 'utf8'),
	readFile(stylesPath, 'utf8'),
	readFile(widgetSettingsPath, 'utf8'),
	readFile(widgetSettingsStylesPath, 'utf8')
])

test('sandbox reports mounted and failed widget runtimes to the parent', () => {
	assert.match(previewSource, /postPreviewEvent\('preview-ready'\)/)
	assert.match(
		previewSource,
		/postPreviewEvent\('preview-error', reason\)/
	)
	assert.match(previewSource, /reportPreviewError\('script-load-failed'\)/)
	assert.match(
		previewSource,
		/reportPreviewError\('widget-mount-timeout'\)/
	)
	assert.match(
		previewSource,
		/onerror="if \(window\.__winwidgetPreviewScriptError\)/
	)
	assert.match(
		previewSource,
		/function isPreviewElementVisible\(element\)/
	)
	assert.match(
		previewSource,
		/isPreviewElementVisible\(root\.querySelector\(target\.dialogContainer\)\)/
	)
	assert.match(
		previewSource,
		/isPreviewElementVisible\(root\.querySelector\(target\.dialogContent\)\)/
	)
})

test('preview exposes loading, error and retry states until sandbox readiness', () => {
	assert.match(previewSource, /data\.event === 'preview-ready'/)
	assert.match(previewSource, /data\.event === 'preview-error'/)
	assert.match(
		previewSource,
		/useLayoutEffect\(\(\) => \{[\s\S]*?handleMessage/
	)
	assert.match(previewSource, /PREVIEW_LOAD_TIMEOUT_MS = 12_000/)
	assert.match(previewSource, /Загружаем предпросмотр\.\.\./)
	assert.match(previewSource, /Предпросмотр не загрузился/)
	assert.match(previewSource, /onClick=\{retryPreviewLoad\}/)
	assert.match(previewSource, /Повторить загрузку/)
	assert.match(
		previewSource,
		/currentState\.key === previewKey && currentState\.status === 'loading'/
	)
	assert.match(
		previewSource,
		/if \(!isCollapsed \|\| !retryToastIdRef\.current\) return[\s\S]*?toast\.dismiss\(retryToastIdRef\.current\)/
	)
	assert.match(previewSource, /aria-hidden=\{previewStatus !== 'ready'\}/)
	assert.match(
		previewSource,
		/tabIndex=\{previewStatus === 'ready' \? 0 : -1\}/
	)
})

test('sandbox warms the widget origin, runtime and only required phone helpers', () => {
	assert.match(
		previewSource,
		/rel="preconnect" href="\$\{safeWidgetsOrigin\}"/
	)
	assert.match(
		previewSource,
		/rel="preload" href="\$\{safeScriptUrl\}" as="script"/
	)
	assert.match(
		previewSource,
		/type === 'aiConsultant'[\s\S]*?\? ''[\s\S]*?winwidget-phone\.js[\s\S]*?libphonenumber-min\.js/
	)
})

test('every widget runtime maps to its exact script, host and visible surface', () => {
	const stageLayouts = previewSource.slice(
		previewSource.indexOf('var sandboxStageLayouts = {'),
		previewSource.indexOf('function postPreviewEvent')
	)
	const expectedMappings = [
		['wheel', 'wheel.js', 'wheel-widget-host', '#main-wrapper.visible'],
		['quiz', 'quiz.js', 'quiz-widget-host', '#wq-wrap.visible'],
		[
			'callback',
			'callback.js',
			'callback-widget-host',
			'#callback-widget-overlay'
		],
		['timer', 'timer.js', 'timer-widget-host', '#timer-widget-overlay'],
		[
			'stopOffer',
			'stop-offer.js',
			'stop-offer-widget-host',
			'#wso-overlay'
		],
		[
			'aiConsultant',
			'ai-consultant.js',
			'ai-consultant-widget-host',
			'#waic-overlay.waic-overlay-open'
		],
		[
			'calculator',
			'calculator.js',
			'calculator-widget-host',
			'#wwc-overlay.visible'
		]
	]

	for (const [type, script, host, dialogContainer] of expectedMappings) {
		assert.ok(previewSource.includes(`${type}: '${script}'`))
		const layoutStart = stageLayouts.indexOf(`${type}: {`)
		assert.notEqual(layoutStart, -1)
		const layoutEnd = stageLayouts.indexOf('\n\t\t\t\t},', layoutStart)
		const layout = stageLayouts.slice(
			layoutStart,
			layoutEnd === -1 ? stageLayouts.length : layoutEnd
		)
		assert.ok(layout.includes(`host: '${host}'`))
		assert.ok(layout.includes(`dialogContainer: '${dialogContainer}'`))
	}

	assert.match(
		previewSource,
		/supportsLauncherPreview = props\.type !== 'stopOffer'/
	)
	assert.match(previewSource, /\{supportsLauncherPreview && \(/)
})

test('AI consultant preview exposes only public config and complete JSON replies', () => {
	const aiConfigBranch = previewSource.slice(
		previewSource.indexOf("if (props.type === 'aiConsultant')"),
		previewSource.indexOf(
			"const dataType = getDataType(props.config.dataType, 'NONE')"
		)
	)
	const aiMessageMock = previewSource.slice(
		previewSource.indexOf("previewType === 'aiConsultant'"),
		previewSource.indexOf("url.indexOf('/' + previewKey + '/lead')")
	)

	assert.ok(aiConfigBranch)
	assert.match(aiConfigBranch, /operatorName:/)
	assert.match(aiConfigBranch, /greeting:/)
	assert.match(aiConfigBranch, /inactivityTimeoutMinutes:/)
	assert.match(aiConfigBranch, /farewellMessage:/)
	assert.match(aiConfigBranch, /turnstileSiteKey: 'preview-site-key'/)
	assert.match(aiConfigBranch, /turnstileAction: 'ai-consultant-session'/)
	assert.doesNotMatch(aiConfigBranch, /instructionsPrompt/)

	assert.ok(aiMessageMock)
	assert.match(previewSource, /window\.turnstile = \{/)
	assert.match(
		previewSource,
		/window\.__winwidgetPreviewDisableAutoFocus = true/
	)
	assert.match(previewSource, /preview-turnstile-token/)
	assert.match(aiMessageMock, /\/api\/v1\/ai-consultant\/.*?\/session/)
	assert.match(aiMessageMock, /sessionToken: 'preview-session-token'/)
	assert.match(aiMessageMock, /\/api\/v1\/ai-consultant\/.*?\/messages/)
	assert.match(aiMessageMock, /outcome: 'ANSWER'/)
	assert.match(aiMessageMock, /reply:/)
	assert.doesNotMatch(
		aiMessageMock,
		/ReadableStream|EventSource|text\/event-stream/
	)
	assert.doesNotMatch(previewSource, /winwidgetAiConsultantAutoOpen/)
})

test('preview identity depends only on public config', () => {
	const previewSetup = previewSource.slice(
		previewSource.indexOf('const WidgetLivePreview ='),
		previewSource.indexOf('const cropStyle =')
	)

	assert.match(previewSetup, /stablePreviewProps/)
	assert.match(
		previewSetup,
		/JSON\.stringify\(\s*buildPreviewPublicConfig\(stablePreviewProps\)\s*\)/
	)
	assert.doesNotMatch(previewSetup, /JSON\.stringify\(stableConfig\)/)
	assert.match(
		previewSetup,
		/JSON\.parse\(debouncedSerializedConfig\) as object/
	)
})

test('responsive viewport height is independent from scaled iframe content', () => {
	const responsiveViewport = stylesSource.match(
		/@media \(max-width: 1100px\) \{[\s\S]*?\.previewViewport \{([\s\S]*?)\n\t\}/
	)?.[1]

	assert.ok(responsiveViewport)
	assert.match(responsiveViewport, /h-\[calc\(100dvh-15rem\)\]/)
	assert.match(responsiveViewport, /min-h-\[24rem\]/)
	assert.match(responsiveViewport, /max-h-\[32rem\]/)
	assert.match(responsiveViewport, /flex-none/)
	assert.doesNotMatch(responsiveViewport, /h-auto|flex-1/)
})

test('preview error copy uses an explicit compact line height', () => {
	const statusTextStyles = stylesSource.match(
		/\.previewStatusText \{([\s\S]*?)\n\}/
	)?.[1]

	assert.ok(statusTextStyles)
	assert.match(statusTextStyles, /leading-\[1\.25rem\]/)
	assert.doesNotMatch(statusTextStyles, /\bleading-5\b/)
})

test('widget settings loading state uses shared structural skeletons', () => {
	const loadingBranch = widgetSettingsSource.slice(
		widgetSettingsSource.indexOf('if (isLoading) {'),
		widgetSettingsSource.indexOf('if (isError) {')
	)

	assert.ok(loadingBranch)
	assert.doesNotMatch(loadingBranch, /h-full w-full/)
	for (const className of [
		'skeletonPreviewHeader',
		'skeletonPreviewCanvas',
		'skeletonPreviewDevice',
		'skeletonEditorHeader',
		'skeletonTabs',
		'skeletonFieldGroup',
		'skeletonFieldGrid',
		'skeletonActions'
	]) {
		assert.ok(loadingBranch.includes(`styles.${className}`))
		assert.match(
			widgetSettingsStylesSource,
			new RegExp(`\\.${className}\\b`)
		)
	}

	for (const type of [
		'wheel',
		'quiz',
		'callback',
		'timer',
		'stop-offer',
		'ai-consultant',
		'calculator'
	]) {
		assert.ok(widgetSettingsSource.includes(`'${type}'`))
	}
})
