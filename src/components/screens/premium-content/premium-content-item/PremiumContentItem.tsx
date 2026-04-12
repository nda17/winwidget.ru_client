'use client'
import styles from '@/components/screens/premium-content/premium-content-item/PremiumContentItem.module.scss'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import Heading from '@/components/ui/heading/Heading'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import usePremium from '@/hooks/usePremium'
import useUser from '@/hooks/useUser'
import { NextPage } from 'next'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const PremiumContentItem: NextPage = () => {
	const searchParams = useSearchParams()
	const id = searchParams.get('id') || undefined
	const { user, isLoading: isLoadingProfile } = useUser()
	const { data, isLoading: isLoadingPremium } = usePremium()

	return (
		<div className={styles.wrapper}>
			<Heading text={`Премиум-материал № ${id}`} />
			{isLoadingProfile || isLoadingPremium ? (
				<CirclesLoader />
			) : (
				user?.isLoggedIn &&
				(data ? (
					<SubHeading
						text={`Это премиум-материал № ${id}, у вас есть доступ к этому контенту.`}
					/>
				) : (
					<SubHeading
						text={
							'Для доступа к премиум-контенту необходимо оформить подписку.'
						}
					/>
				))
			)}

			{!user?.isLoggedIn && (
				<Link href={PUBLIC_PAGES.LOGIN} className={styles.link}>
					Войдите в аккаунт
				</Link>
			)}
		</div>
	)
}

export default PremiumContentItem
