import styles from './WidgetSettingsModal.module.scss'

export interface WidgetPreset {
	id: string
	label: string
	description: string
}

interface WidgetPresetButtonsProps {
	presets: WidgetPreset[]
	onApply: (id: string) => void
}

const WidgetPresetButtons = ({
	presets,
	onApply
}: WidgetPresetButtonsProps) => (
	<section className={styles.presetBlock} aria-label="Готовые сценарии">
		<div>
			<p className={styles.presetTitle}>Быстрый старт</p>
			<p className={styles.presetDescription}>
				Выберите близкий сценарий, затем скорректируйте тексты и
				оформление. Домен и интеграции не изменятся.
			</p>
		</div>
		<div className={styles.presetGrid}>
			{presets.map(preset => (
				<button
					key={preset.id}
					type="button"
					className={styles.presetCard}
					onClick={() => onApply(preset.id)}
				>
					<strong>{preset.label}</strong>
					<span>{preset.description}</span>
				</button>
			))}
		</div>
	</section>
)

export default WidgetPresetButtons
