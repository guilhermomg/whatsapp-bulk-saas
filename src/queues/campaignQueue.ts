import { Queue } from 'bullmq';
import redisConnection from '../config/redis';

export interface CampaignJobData {
  campaignId: string;
  userId: string;
  contactId: string;
  templateId: string;
}

const campaignQueue = new Queue<CampaignJobData>('campaign-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 500,
  },
});

export default campaignQueue;
