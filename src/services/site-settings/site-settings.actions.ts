'use server'

import { revalidateTag } from 'next/cache'
import { SITE_SETTINGS_TAG } from '@/services/site-settings/site-settings.server'

export const revalidateSiteSettings = async () => {
	revalidateTag(SITE_SETTINGS_TAG)
}
