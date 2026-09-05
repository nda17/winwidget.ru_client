'use client'

import { useId, useState } from 'react'
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
}: WidgetPresetButtonsProps) => {
	const [isHelpOpen, setIsHelpOpen] = useState(false)
	const helpId = useId()

	return (
		<section className={styles.presetBlock} aria-label="Готовые сценарии">
			<div className={styles.presetHeading}>
				<p className={styles.presetTitle}>Быстрый старт</p>
				<button
					type="button"
					className={styles.presetHelpButton}
					aria-label="Как работает быстрый старт"
					aria-expanded={isHelpOpen}
					aria-controls={helpId}
					onClick={() => setIsHelpOpen(current => !current)}
				>
					?
				</button>
			</div>
			<p className={styles.presetDescription}>
				Выберите близкий сценарий, затем скорректируйте тексты и
				оформление.
			</p>
			{isHelpOpen && (
				<div id={helpId} className={styles.presetHelp} role="note">
					<p>
						Пресет меняет только заранее заданные тексты, поля формы и
						поведение выбранного сценария.
					</p>
					<ul className={styles.presetHelpList}>
						<li>Домен, интеграции и остальные настройки не изменяются.</li>
						<li>Результат сразу виден в предпросмотре.</li>
						<li>
							На сайт изменения попадут только после действий «Сохранить
							черновик» и «Опубликовать».
						</li>
						<li>
							До сохранения закройте редактор без сохранения, чтобы
							отменить пресет. Если виджет уже публиковался, после
							сохранения используйте «Отменить изменения черновика». У
							нового виджета выберите другой сценарий или скорректируйте
							настройки вручную.
						</li>
					</ul>
				</div>
			)}
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
}

export default WidgetPresetButtons
