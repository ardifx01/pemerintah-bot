import { CronJob } from "cron";
import { logger } from "../utils/logger.js";

export type SchedulerCallback = () => Promise<void>;

export class SchedulerService {
  private jobs: Map<string, CronJob> = new Map();

  /**
   * Schedule a periodic job
   * @param name - Unique name for the job
   * @param cronTime - Cron expression or interval in minutes
   * @param callback - Function to execute
   * @param startImmediately - Whether to start the job immediately
   */
  scheduleJob(
    name: string,
    cronTime: string | number,
    callback: SchedulerCallback,
    startImmediately: boolean = true
  ): void {
    try {
      // If cronTime is a number, treat it as minutes and convert to cron expression
      const cronExpression =
        typeof cronTime === "number" ? this.minutesToCron(cronTime) : cronTime;

      logger.info(`Scheduling job '${name}'`, {
        cronExpression,
        startImmediately,
      });

      const job = new CronJob(
        cronExpression,
        async () => {
          const startTime = Date.now();
          logger.debug(`Starting scheduled job: ${name}`);

          try {
            await callback();
            const duration = Date.now() - startTime;
            logger.debug(`Completed scheduled job: ${name}`, {
              durationMs: duration,
            });
          } catch (error) {
            logger.error(`Error in scheduled job: ${name}`, {
              error,
              durationMs: Date.now() - startTime,
            });
          }
        },
        null,
        startImmediately,
        "Asia/Jakarta"
      );

      // Stop existing job with same name if it exists
      if (this.jobs.has(name)) {
        logger.warn(`Replacing existing job: ${name}`);
        this.stopJob(name);
      }

      this.jobs.set(name, job);
      logger.info(`Successfully scheduled job: ${name}`);
    } catch (error) {
      logger.error(`Failed to schedule job: ${name}`, { error });
      throw error;
    }
  }

  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      logger.warn(`Job not found: ${name}`);
      return false;
    }

    try {
      job.stop();
      this.jobs.delete(name);
      logger.info(`Stopped job: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Error stopping job: ${name}`, { error });
      return false;
    }
  }

  getJobsStatus(): Array<{
    name: string;
    running: boolean;
    nextRun: Date | null;
  }> {
    const status: Array<{
      name: string;
      running: boolean;
      nextRun: Date | null;
    }> = [];

    for (const [name, job] of this.jobs) {
      status.push({
        name,
        running: job.running,
        nextRun: job.nextDate()?.toJSDate() || null,
      });
    }

    return status;
  }

  stopAllJobs(): void {
    logger.info(`Stopping all ${this.jobs.size} scheduled jobs`);

    for (const [name, job] of this.jobs) {
      try {
        job.stop();
        logger.debug(`Stopped job: ${name}`);
      } catch (error) {
        logger.error(`Error stopping job: ${name}`, { error });
      }
    }

    this.jobs.clear();
    logger.info("All jobs stopped");
  }

  isJobRunning(name: string): boolean {
    const job = this.jobs.get(name);
    return job ? job.running : false;
  }

  getNextRunTime(name: string): Date | null {
    const job = this.jobs.get(name);
    if (!job) return null;

    const nextDate = job.nextDate();
    return nextDate ? nextDate.toJSDate() : null;
  }

  /**
   * Convert minutes to cron expression
   * @param minutes - Interval in minutes
   * @returns Cron expression string
   */
  private minutesToCron(minutes: number): string {
    if (minutes < 1) {
      throw new Error("Interval must be at least 1 minute");
    }

    if (minutes === 1) {
      return "* * * * *"; // Every minute
    } else if (minutes < 60) {
      return `*/${minutes} * * * *`; // Every N minutes
    } else if (minutes === 60) {
      return "0 * * * *"; // Every hour
    } else if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return `0 */${hours} * * *`; // Every N hours
    } else {
      return `*/${minutes} * * * *`;
    }
  }

  /**
   * Schedule a one-time delayed task
   */
  scheduleDelayedTask(
    name: string,
    delayMs: number,
    callback: SchedulerCallback
  ): void {
    logger.info(`Scheduling delayed task '${name}'`, {
      delayMs,
      executeAt: new Date(Date.now() + delayMs).toISOString(),
    });

    setTimeout(async () => {
      const startTime = Date.now();
      logger.debug(`Starting delayed task: ${name}`);

      try {
        await callback();
        const duration = Date.now() - startTime;
        logger.debug(`Completed delayed task: ${name}`, {
          durationMs: duration,
        });
      } catch (error) {
        logger.error(`Error in delayed task: ${name}`, {
          error,
          durationMs: Date.now() - startTime,
        });
      }
    }, delayMs);
  }

  describeCron(cronExpression: string): string {
    try {
      const job = new CronJob(
        cronExpression,
        () => {},
        null,
        false,
        "Asia/Jakarta"
      );
      const nextRun = job.nextDate();
      return nextRun
        ? `Next run: ${nextRun.toJSDate().toLocaleString()}`
        : "Invalid cron expression";
    } catch (error) {
      return "Invalid cron expression";
    }
  }
}
