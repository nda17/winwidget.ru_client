import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = relativePath =>
	readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

const [
	apiSource,
	modelSource,
	settingsSource,
	previewSource,
	directPreviewSource,
	statisticsSource,
	adminUserSource,
	leadsChartSource,
	middlewareSource,
	nextConfigSource,
	layoutSource,
	homeDefaultsSource,
	directPageSource,
	demoSource,
	cabinetWidgetsSource
] = await Promise.all([
	readSource('src/entities/site-widget/api/ai-consultant.api.ts'),
	readSource('src/entities/site-widget/model/ai-consultant.types.ts'),
	readSource(
		'src/features/edit-widget-settings/ui/ai-consultant/AiConsultantSettingsModal.tsx'
	),
	readSource(
		'src/features/edit-widget-settings/ui/shared/WidgetLivePreview.tsx'
	),
	readSource('src/screens/widget-preview/ui/AiConsultantPreview.tsx'),
	readSource('src/features/admin-monitoring/api/statistics.api.ts'),
	readSource('src/entities/user/api/user.api.ts'),
	readSource(
		'src/screens/admin/ui/statistics/charts/LeadsByDayChart/LeadsByDayChart.tsx'
	),
	readSource('src/middleware.ts'),
	readSource('next.config.mjs'),
	readSource('src/app/_ui/layout/Layout.tsx'),
	readSource(
		'src/entities/home-page-content/model/home-page-content.defaults.ts'
	),
	readSource('src/app/page-ai-consultant/[key]/page.tsx'),
	readSource(
		'src/screens/home/ui/demo-ai-consultant/DemoAiConsultant.tsx'
	),
	readSource('src/screens/cabinet/ui/CabinetWidgets.tsx')
])

test('AI consultant owner API uses the clean CRUD and saved-draft test contract', () => {
	assert.match(apiSource, /['`]\/ai-consultants['`]/)
	assert.match(apiSource, /`\/ai-consultants\/\$\{id\}\/test-message`/)
	assert.match(modelSource, /aiConsultants: AiConsultant\[\]/)
	assert.match(modelSource, /requestId: string/)
	assert.match(modelSource, /sessionId: string/)
	assert.match(modelSource, /outcome: AiConsultantOutcome/)
	assert.doesNotMatch(apiSource, /\/online-consultants|\/lead/)
	assert.doesNotMatch(
		modelSource,
		/\b(leads?|quickActions|contact|integrations)\b/i
	)
})

test('AI consultant settings keep the agreed defaults and save before testing', () => {
	assert.match(settingsSource, /operatorName: 'Alex'/)
	assert.match(settingsSource, /AI-оператор/)
	assert.match(settingsSource, /inactivityTimeoutMinutes: 10/)
	assert.match(settingsSource, /instructionsPrompt: ''/)
	assert.match(settingsSource, /privacyUrl: DEFAULT_PRIVACY_URL/)
	assert.match(settingsSource, /Ссылка на политику конфиденциальности/)
	assert.match(settingsSource, /Укажите точный hostname сайта/)
	assert.match(settingsSource, /challenges\.cloudflare\.com/)
	assert.match(
		settingsSource,
		/Добавляйте только публичную информацию о компании/
	)
	assert.match(
		settingsSource,
		/Не[\s\S]*?указывайте пароли, API-токены, персональные или\s+внутренние[\s\S]*?данные/
	)
	assert.match(settingsSource, /Сначала сохраните инструкции в черновик/)
	assert.match(
		settingsSource,
		/createUuidV4 = \(\) => window\.crypto\.randomUUID\(\)/
	)
	assert.match(
		settingsSource,
		/testSessionIdRef\.current = createUuidV4\(\)/
	)
	assert.match(settingsSource, /requestId: createUuidV4\(\)/)
	assert.match(settingsSource, /aiConsultantService\.testMessage/)
	assert.match(settingsSource, /history: AiConsultantMessage\[\]/)
	assert.doesNotMatch(
		settingsSource,
		/\b(leads?|quickActions|contact|integrations)\b/i
	)
})

test('public preview omits the owner prompt and does not assume streaming', () => {
	const publicConfigBranch = previewSource.slice(
		previewSource.indexOf("if (props.type === 'aiConsultant')"),
		previewSource.indexOf(
			"const dataType = getDataType(props.config.dataType, 'NONE')"
		)
	)

	assert.match(publicConfigBranch, /operatorName:/)
	assert.match(publicConfigBranch, /greeting:/)
	assert.match(publicConfigBranch, /privacyUrl:/)
	assert.doesNotMatch(publicConfigBranch, /instructionsPrompt/)
	assert.doesNotMatch(
		publicConfigBranch,
		/quickActions|contact|lead|integrations|yandexMetrika|vkPixel|roistat/
	)
	assert.match(previewSource, /outcome: 'ANSWER'/)
	assert.doesNotMatch(
		previewSource,
		/ReadableStream|EventSource|text\/event-stream/
	)
	assert.match(directPreviewSource, /winAiConsultantAutoOpen/)
	assert.match(directPreviewSource, /winAiConsultant = widgetKey/)
	assert.match(directPreviewSource, /winAiConsultantWidget/)
	assert.match(directPreviewSource, /widget\.destroy\(\)/)
	assert.match(directPreviewSource, /__winAiConsultantScriptRunning/)
	assert.doesNotMatch(directPreviewSource, /winwidgetAiConsultant/)
})

test('AI consultant remains widget statistics only and never becomes a lead type', () => {
	const leadDayContract = statisticsSource.slice(
		statisticsSource.indexOf('export interface IStatisticsLeadDayPoint'),
		statisticsSource.indexOf('export interface IStatisticsCountPoint')
	)

	assert.match(statisticsSource, /\| 'aiConsultant'/)
	assert.match(
		statisticsSource,
		/type StatisticsLeadType = Exclude<[\s\S]*?'aiConsultant'/
	)
	assert.match(adminUserSource, /\| 'AI_CONSULTANT'/)
	assert.match(adminUserSource, /\| 'CALCULATOR'/)
	assert.match(
		adminUserSource,
		/type AdminUserOverviewLeadType = Exclude<[\s\S]*?'AI_CONSULTANT'/
	)
	assert.doesNotMatch(leadDayContract, /aiConsultant/)
	assert.doesNotMatch(leadsChartSource, /aiConsultant|AI-консультант/)
})

test('AI consultant direct page keeps the shared preview and noindex contract', () => {
	assert.match(middlewareSource, /stop-offer\|ai-consultant\|calculator/)
	assert.doesNotMatch(middlewareSource, /online-consultant/)

	for (const source of [nextConfigSource, layoutSource]) {
		assert.match(source, /page-ai-consultant/)
		assert.doesNotMatch(source, /page-online-consultant/)
	}

	assert.match(homeDefaultsSource, /'\/page-ai-consultant\/'/)
	assert.doesNotMatch(homeDefaultsSource, /'\/page-online-consultant\/'/)
	assert.match(directPageSource, /index: false/)
	assert.match(directPageSource, /follow: false/)
	assert.match(nextConfigSource, /X-Robots-Tag/)
	assert.match(nextConfigSource, /noindex, nofollow, noarchive/)
})

test('AI consultant is explicit AI and is independent from lead quota', () => {
	assert.match(demoSource, /AI-оператор/)
	assert.match(demoSource, /Отвечает по инструкциям компании/)
	assert.doesNotMatch(demoSource, /'В чате'|'Готов помочь'/)
	assert.match(
		cabinetWidgetsSource,
		/kind !== 'ai-consultant' && isLeadLimitReached/
	)
})

test('legacy owner modules and dedicated lead screen are deleted', async () => {
	const deletedPaths = [
		'src/entities/site-widget/api/online-consultant.api.ts',
		'src/entities/site-widget/model/online-consultant.types.ts',
		'src/features/edit-widget-settings/ui/online-consultant/OnlineConsultantSettingsModal.tsx',
		'src/screens/widget-leads/ui/OnlineConsultantLeads.tsx',
		'src/app/online-consultants/[id]/leads/page.tsx',
		'src/app/page-online-consultant/[key]/page.tsx'
	]

	for (const deletedPath of deletedPaths) {
		await assert.rejects(
			access(new URL(`../${deletedPath}`, import.meta.url))
		)
	}
})
