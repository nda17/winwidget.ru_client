'use client'
import styles from '@/components/screens/premium-content/premium-content-item/PremiumContentItem.module.scss'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import Heading from '@/components/ui/heading/Heading'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import usePremium from '@/hooks/usePremium'
import useUser from '@/hooks/useUser'
import { errorCatch } from '@/api/api.helper'
import paymentService from '@/services/payment/payment.service'
import { NextPage } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import toast from 'react-hot-toast'

const PremiumContentItem: NextPage = () => {
	const { user, isLoading: isLoadingProfile } = useUser()
	const { data, isLoading: isLoadingPremium } = usePremium()
	const [isBuying, setIsBuying] = useState(false)

	const handleBuyPremium = async () => {
		setIsBuying(true)
		try {
			const response = await paymentService.createPremiumPayment()
			window.location.href = response.data.confirmationUrl
		} catch (error) {
			toast.error(errorCatch(error))
			setIsBuying(false)
		}
	}

	return (
		<div className={styles.wrapper}>
			<Heading text="Премиум-контент" />
			{isLoadingProfile || isLoadingPremium ? (
				<CirclesLoader />
			) : (
				user?.isLoggedIn &&
				(data ? (
					<>
						<SubHeading text="Это премиум-контент, у вас есть доступ к этому контенту:" />
						Lorem ipsum dolor, sit amet consectetur adipisicing elit. Est
						facilis nulla, modi accusantium, atque eius quasi consequuntur
						aut id eaque nisi. Fugit inventore odio mollitia facere aliquam
						neque maiores ipsum. Repudiandae aliquam illo fugiat eligendi
						tempore rem. Laboriosam magnam et aut facere dolore illo
						ratione recusandae quo! Dolorum rem ut, incidunt beatae ab
						quaerat exercitationem libero, voluptatum, dolore quis
						nesciunt! Officia laudantium optio nesciunt ab hic, cupiditate
						similique quaerat accusantium perspiciatis sit odio sint
						suscipit eligendi consequatur odit aspernatur saepe quod eaque?
						Ab soluta doloremque quisquam veritatis molestiae numquam
						officiis. Sed beatae vel fugit debitis obcaecati, qui libero
						tempore. Dolorum error consequatur aliquid. Ipsa exercitationem
						magni quidem in autem tenetur corporis sint suscipit obcaecati!
						Temporibus quam aliquid quas consequuntur doloremque. Enim sint
						molestias aliquid eum ipsam eligendi hic doloremque ad eveniet
						sit, iste quod incidunt, placeat qui molestiae. Veritatis
						aliquam tenetur velit provident quisquam fuga vel non magnam
						quae aliquid. Praesentium cum a reiciendis est repellendus quae
						quas eligendi itaque accusamus dolore harum, doloribus
						voluptatem eum error enim saepe consequuntur beatae quia
						deserunt laboriosam possimus quaerat esse. Aut, cumque nulla!
						Porro blanditiis perferendis placeat assumenda atque dolor qui
						maxime? Nesciunt autem magni nam ex esse eveniet aspernatur
						sint pariatur, eos nihil voluptate! Ducimus commodi explicabo
						repellat! Architecto voluptatum sit accusamus. Pariatur laborum
						doloribus temporibus culpa consequatur aperiam similique esse
						qui praesentium dolor, corporis nisi maxime rem, hic libero
						unde molestias nam quia tenetur fugiat eum ea! Voluptatibus
						pariatur officiis sint! Dolor dolores eos perferendis modi
						laborum, iusto facere optio excepturi perspiciatis quas ullam
						ducimus ab dicta reprehenderit blanditiis id, magnam incidunt
						necessitatibus asperiores quam sequi quasi! Dignissimos
						reiciendis harum at. Architecto nulla deserunt nostrum maiores
						ut impedit libero, quo dolor quas temporibus reiciendis,
						possimus doloribus molestias, vero ea! Maiores similique non
						optio tenetur quasi qui itaque laudantium sit, aperiam sed.
						Architecto ipsa molestiae ab illo est veniam praesentium quasi
						similique distinctio facilis. Ea maxime velit quod ipsum
						necessitatibus perferendis ut delectus! Doloribus tempore nisi
						magni porro, veritatis necessitatibus vero quasi? Harum
						dignissimos unde quibusdam quas mollitia consequatur id totam
						sequi, velit delectus est, similique cum ex commodi nulla
						recusandae, porro autem! Impedit, dicta incidunt et doloribus
						illo culpa aliquid pariatur.
					</>
				) : (
					<div className={styles['paywall']}>
						<SubHeading text="Для доступа к материалам оформите подписку PREMIUM" />
						<button
							className={styles['buy-button']}
							onClick={handleBuyPremium}
							disabled={isBuying}
						>
							{isBuying
								? 'Перенаправление...'
								: 'Оформить PREMIUM — 100 ₽'}
						</button>
					</div>
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
