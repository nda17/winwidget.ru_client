import styles from '@/components/ui/form-elements/auth-page/field-sms-code/FieldSmsCode.module.scss'
import { IField } from '@/components/ui/form-elements/form.interface'
import clsx from 'clsx'
import { forwardRef } from 'react'

const FieldSmsCode = forwardRef<HTMLInputElement, IField>(
	({ error, type = 'text', style, ...rest }, ref) => {
		return (
			<div className={clsx(styles['wrapper-input'])} style={style}>
				<label className={clsx(styles['label-input'])}>
					<input
						className={clsx(styles['input-field'])}
						ref={ref}
						type={type}
						inputMode="numeric"
						{...rest}
						autoComplete="one-time-code"
					/>
				</label>
				{error?.message && (
					<p className={styles.error}>{String(error.message)}</p>
				)}
			</div>
		)
	}
)

FieldSmsCode.displayName = 'FieldSmsCode'

export default FieldSmsCode
