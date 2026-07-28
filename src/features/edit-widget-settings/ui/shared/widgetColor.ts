const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export const isWidgetHexColor = (value: unknown): value is string =>
	typeof value === 'string' && HEX_COLOR_PATTERN.test(value)

export const getWidgetColorPreview = (value: unknown, fallback: string) =>
	isWidgetHexColor(value) ? value : fallback

export const findInvalidWidgetColor = (
	value: unknown,
	path = ''
): string | null => {
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			const issue = findInvalidWidgetColor(
				value[index],
				`${path}[${index}]`
			)
			if (issue) return issue
		}
		return null
	}

	if (!value || typeof value !== 'object') return null

	for (const [key, nestedValue] of Object.entries(value)) {
		const nestedPath = path ? `${path}.${key}` : key
		const isColorField = key.toLowerCase().includes('color')

		if (
			isColorField &&
			typeof nestedValue === 'string' &&
			nestedValue !== '' &&
			!isWidgetHexColor(nestedValue)
		) {
			return nestedPath
		}

		const issue = findInvalidWidgetColor(nestedValue, nestedPath)
		if (issue) return issue
	}

	return null
}

export const stabilizeWidgetPreviewColors = <T>(
	current: T,
	previous: T | undefined
): T => {
	if (Array.isArray(current)) {
		const previousItems = Array.isArray(previous) ? previous : []
		return current.map((item, index) =>
			stabilizeWidgetPreviewColors(item, previousItems[index])
		) as T
	}

	if (!current || typeof current !== 'object') return current

	const previousRecord =
		previous && typeof previous === 'object' && !Array.isArray(previous)
			? (previous as Record<string, unknown>)
			: {}
	const result: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(
		current as Record<string, unknown>
	)) {
		if (
			key.toLowerCase().includes('color') &&
			typeof value === 'string' &&
			value !== '' &&
			!isWidgetHexColor(value)
		) {
			const previousValue = previousRecord[key]
			result[key] = isWidgetHexColor(previousValue)
				? previousValue
				: '#4705fb'
			continue
		}

		result[key] = stabilizeWidgetPreviewColors(value, previousRecord[key])
	}

	return result as T
}
