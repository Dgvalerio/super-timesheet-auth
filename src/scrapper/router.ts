import { authVerify } from '@/scrapper/auth-verify';
import { seed } from '@/scrapper/seed';

import { Router } from 'express';

const scrapperRouter = Router();

scrapperRouter.post('/auth-verify', authVerify);

scrapperRouter.post('/seed', seed);

export default scrapperRouter;
