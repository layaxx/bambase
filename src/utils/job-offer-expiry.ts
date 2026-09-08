import { JobOnlineStatus } from "@/generated/prisma/enums"
import prisma from "./prisma"

/** Sets each published job offer that is past its `offlineAfter` date to `expired`. */
export async function expireJobOffers(): Promise<void> {
  const { count } = await prisma.jobOffer.updateMany({
    where: {
      onlineStatus: JobOnlineStatus.published,
      offlineAfter: { lt: new Date() },
    },
    data: { onlineStatus: JobOnlineStatus.expired },
  })

  console.warn(`[job-offer-expiry] Expired ${count} job offer(s)`)
}
