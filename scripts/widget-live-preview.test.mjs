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

const [previewSource, stylesSource] = await Promise.all([
	readFile(previewPath, 'utf8'),
	readFile(stylesPath, 'utf8')
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
		/type === 'onlineConsultant'[\s\S]*?\? ''[\s\S]*?winwidget-phone\.js[\s\S]*?libphonenumber-min\.js/
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
			'onlineConsultant',
			'online-consultant.js',
			'online-consultant-widget-host',
			'#woc-overlay.woc-overlay-open'
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
