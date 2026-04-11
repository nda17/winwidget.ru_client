import { IField } from '@/components/ui/form-elements/form.interface'
import { forwardRef } from 'react'

const CheckboxRights = forwardRef<HTMLInputElement, IField>(
	({ defaultChecked, type = 'checkbox', ...rest }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				{...rest}
				defaultChecked={defaultChecked}
			/>
		)
	}
)

CheckboxRights.displayName = 'CheckboxRights'

export default CheckboxRights
