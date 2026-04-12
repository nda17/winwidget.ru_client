import styles from '@/components/ui/form-elements/admin-page/field-phone/FieldPhone.module.scss'
import { IField } from '@/components/ui/form-elements/form.interface'
import clsx from 'clsx'
import { forwardRef } from 'react'

const FieldPhone = forwardRef<HTMLInputElement, IField>(
	({ error, type = 'tel', style, ...rest }, ref) => {
		return (
			<div className={clsx(styles['wrapper-input'])} style={style}>
				<label className={clsx(styles['label-input'])}>
					<input
						className={clsx(styles['input-field'])}
						ref={ref}
						type={type}
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

FieldPhone.displayName = 'FieldPhone'

export default FieldPhone
