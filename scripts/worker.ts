import "dotenv/config";
import { Worker } from "bullmq";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { getQueueConnection, PROFILE_QUEUE } from "@/lib/jobs/queue";
import { processProfileCalculation } from "@/lib/jobs/profile-calculation";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDatabaseWorker() {
  console.log("GameFive database worker started");
  await recoverInterruptedDatabaseJobs();
  await Promise.all([runProfileDatabaseLoop(1), runProfileDatabaseLoop(2)]);
}

async function runProfileDatabaseLoop(workerId: number) {
  while (true) {
    const profileJob = await prisma.profileJob.findFirst({
      where: {
        status: "queued"
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (profileJob) {
      const claimed = await prisma.profileJob.updateMany({
        where: {
          id: profileJob.id,
          status: "queued"
        },
        data: {
          status: "processing",
          startedAt: new Date(),
          message: "Starting rank calculation"
        }
      });

      if (!claimed.count) {
        continue;
      }

      try {
        console.log(`Profile worker ${workerId} processing ${profileJob.riotIdName}#${profileJob.riotIdTag}`);
        await processProfileCalculation({
          profileJobId: profileJob.id,
          gameName: profileJob.riotIdName,
          tagLine: profileJob.riotIdTag
        });
      } catch (error) {
        console.error(`Profile job ${profileJob.id} failed`, error);
      }
      continue;
    }

    await sleep(2000);
  }
}

async function recoverInterruptedDatabaseJobs() {
  const profileJobs = await prisma.profileJob.updateMany({
    where: {
      status: "processing"
    },
    data: {
      status: "queued",
      message: "Resumed after worker restart"
    }
  });

  if (profileJobs.count) {
    console.log(
      `Recovered ${profileJobs.count} profile job(s) after restart`
    );
  }
}

function runBullWorker() {
  const connection = getQueueConnection();

  const profileWorker = new Worker(PROFILE_QUEUE, (job) => processProfileCalculation(job.data), {
    connection,
    concurrency: 2
  });

  profileWorker.on("failed", (job, error) => {
    console.error(`Profile job ${job?.id ?? "unknown"} failed`, error);
  });

  console.log("GameFive BullMQ worker started");
}

if (appConfig.queueDriver === "database") {
  runDatabaseWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  runBullWorker();
}
