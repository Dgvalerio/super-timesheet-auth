import { Router } from 'express';

const indexRouter = Router();

/* GET home page. */
indexRouter.get('/', (req, res) => {
  res.send('Hello World!');
});

export default indexRouter;
