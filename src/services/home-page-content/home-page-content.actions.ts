'use server'

import { revalidateTag } from 'next/cache'
import { HOME_PAGE_CONTENT_TAG } from '@/services/home-page-content/home-page-content.server'

export const revalidateHomePageContent = async () => {
	revalidateTag(HOME_PAGE_CONTENT_TAG)
}
