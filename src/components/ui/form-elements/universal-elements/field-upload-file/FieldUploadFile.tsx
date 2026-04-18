'use client'

import { IUploadField } from '@/components/ui/form-elements/form.interface'
import styles from '@/components/ui/form-elements/universal-elements/field-upload-file/FieldUploadFile.module.scss'
import { useUploadFile } from '@/components/ui/form-elements/universal-elements/field-upload-file/useUploadFile'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import clsx from 'clsx'
import { NextPage } from 'next'
import Image from 'next/image'
import { useState } from 'react'

const DEFAULT_AVATAR = '/uploads/user-avatar/avatar-default.png'

const FieldUploadFile: NextPage<IUploadField> = ({
	currentFile,
	placeholder,
	style,
	value,
	folder,
	onChange,
	canDelete,
	disabled,
	onDelete
}) => {
	const [isDeleting, setIsDeleting] = useState(false)
	const { uploadFile, isLoading } = useUploadFile(onChange, folder)
	const currentImageSrc = currentFile ? encodeURI(currentFile) : ''
	const valueImageSrc = value ? encodeURI(value) : ''
	const busy = isLoading || isDeleting
	const hasCustomAvatar =
		value || (currentFile && currentFile !== DEFAULT_AVATAR)

	const handleDelete = async () => {
		if (!onDelete) return
		setIsDeleting(true)
		try {
			await onDelete()
		} finally {
			setIsDeleting(false)
		}
	}

	const avatarPreview = (
		<div className={styles['preview-wrapper']}>
			<div className={clsx(styles['file-preview'])}>
				{busy ? (
					<div className="w-full h-full">
						<SkeletonLoader count={1} className="w-full h-full p-1" />
					</div>
				) : value ? (
					<Image
						src={valueImageSrc}
						alt={placeholder}
						priority
						fill
						unoptimized
					/>
				) : (
					<Image
						src={currentImageSrc}
						alt={placeholder}
						priority
						fill
						unoptimized
					/>
				)}
			</div>
			{canDelete && onDelete && hasCustomAvatar && (
				<button
					type="button"
					className={styles['delete-button']}
					onClick={handleDelete}
					disabled={busy}
					title="Удалить фото"
				>
					<svg
						viewBox="0 0 10 10"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M1 1L9 9M9 1L1 9"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			)}
		</div>
	)

	return (
		<div className={styles.wrapper} style={style}>
			<p className={clsx(styles['field-path'])}>
				{value ? value : currentFile}
			</p>
			{disabled ? (
				avatarPreview
			) : (
				<>
					<label className={clsx(styles['label-input'])}>
						<div className={clsx(styles['custom-input'])}>
							<span className={styles.button}>Загрузить файл</span>
						</div>
						<input
							type="file"
							onChange={uploadFile}
							className={clsx(styles['input-field'])}
						/>
					</label>
					{avatarPreview}
				</>
			)}
		</div>
	)
}

export default FieldUploadFile
