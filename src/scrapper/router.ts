import { authVerify } from '@/scrapper/auth-verify';
import { saveAppointments } from '@/scrapper/save-appointments';
import { seed } from '@/scrapper/seed';

import { Router } from 'express';

const scrapperRouter = Router();

scrapperRouter.post('/auth-verify', authVerify);

scrapperRouter.post('/seed', seed);

scrapperRouter.post('/save-appointments', saveAppointments);

export default scrapperRouter;
