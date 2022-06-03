import { seed } from '@/scrapper/controller';

import { Router } from 'express';

const scrapperRouter = Router();

scrapperRouter.post('/', seed);

export default scrapperRouter;
