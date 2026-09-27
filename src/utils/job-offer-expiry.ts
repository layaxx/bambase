import { JobOnlineStatus } from "@/generated/prisma/enums"
import prisma from "./prisma"
import { baseLogger } from "./logger"

/** Sets each published job offer that is past its `offlineAfter` date to `expired`. */
export async function expireJobOffers(): Promise<void> {
  const { count } = await prisma.jobOffer.updateMany({
    where: {
      onlineStatus: JobOnlineStatus.published,
      offlineAfter: { lt: new Date() },
    },
    data: { onlineStatus: JobOnlineStatus.expired },
  })

  baseLogger.info({ job: "job-offer-expiry", count }, "job offers expired")
}
