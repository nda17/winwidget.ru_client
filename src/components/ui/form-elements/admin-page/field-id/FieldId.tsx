import styles from '@/components/ui/form-elements/admin-page/field-id/FieldId.module.scss'
import { IField } from '@/components/ui/form-elements/form.interface'
import clsx from 'clsx'
import { forwardRef } from 'react'

const FieldId = forwardRef<HTMLInputElement, IField>(
	({ error, placeholder, type = 'text', style, ...rest }, ref) => {
		return (
			<div className={clsx(styles['wrapper-input'])} style={style}>
				<label className={clsx(styles['label-input'])}>
					<input
						placeholder={placeholder}
						className={clsx(styles['input-field'])}
						ref={ref}
						type={type}
						readOnly
						{...rest}
						autoComplete="on"
					/>
				</label>
				{error?.message && (
					<p className={clsx(styles['error-message'])}>
						{String(error.message)}
					</p>
				)}
			</div>
		)
	}
)

FieldId.displayName = 'FieldId'

export default FieldId
