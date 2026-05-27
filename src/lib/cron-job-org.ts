export interface CronJobResponse {
  success: boolean;
  jobId?: number;
  action?: "created" | "updated";
  error?: string;
}

export async function createOrUpdateCronJob(
  apiKey: string,
  appUrl: string,
  cronSecret: string
): Promise<CronJobResponse> {
  const normalizedUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  const cronUrl = `${normalizedUrl}/api/cron/release-tasks`;
  const title = "Pesatrix - Release Locked Tasks";

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Fetch all existing cron jobs
    const listRes = await fetch("https://api.cron-job.org/jobs", {
      method: "GET",
      headers,
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      return {
        success: false,
        error: `Failed to fetch cron jobs from cron-job.org (Status: ${listRes.status}): ${errText}`,
      };
    }

    const listData = await listRes.json();
    const jobs = listData.jobs || [];

    // Find if the job already exists by matching the title
    const existingJob = jobs.find((j: any) => j.title === title);

    const jobPayload = {
      job: {
        url: cronUrl,
        enabled: true,
        saveResponses: true,
        schedule: {
          timezone: "UTC",
          expiresAt: 0,
          hours: [-1], // every hour
          mdays: [-1], // every day
          minutes: [0], // minute 0
          months: [-1], // every month
          wdays: [-1], // every day of week
        },
        requestMethod: 0, // GET request
        extendedData: {
          headers: {
            "x-cron-secret": cronSecret,
          },
        },
      },
    };

    if (existingJob) {
      const jobId = existingJob.jobId;
      // 2a. Update existing job using PATCH
      const patchRes = await fetch(`https://api.cron-job.org/jobs/${jobId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(jobPayload),
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return {
          success: false,
          error: `Failed to update existing cron job (Job ID: ${jobId}, Status: ${patchRes.status}): ${errText}`,
        };
      }

      return {
        success: true,
        jobId,
        action: "updated",
      };
    } else {
      // 2b. Create a new job using PUT (adding the title)
      const createPayload = {
        job: {
          ...jobPayload.job,
          title,
        },
      };

      const putRes = await fetch("https://api.cron-job.org/jobs", {
        method: "PUT",
        headers,
        body: JSON.stringify(createPayload),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        return {
          success: false,
          error: `Failed to create new cron job (Status: ${putRes.status}): ${errText}`,
        };
      }

      const createData = await putRes.json();
      return {
        success: true,
        jobId: createData.jobId,
        action: "created",
      };
    }
  } catch (error: any) {
    console.error("Error communicating with cron-job.org:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during API communication.",
    };
  }
}
