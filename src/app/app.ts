import indexRouter from '@/app/controller';
import scrapperRouter from '@/scrapper/router';

import cors from 'cors';
import express from 'express';
import createError from 'http-errors';
import logger from 'morgan';

const app = express();

app.use(cors());

app.use(logger('dev'));
app.use(express.json());

app.use('/', indexRouter);
app.use('/scrapper', scrapperRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

export default app;
