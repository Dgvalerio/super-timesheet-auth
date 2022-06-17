import { puppeteerErrorHandler } from '@/scrapper/seed';
import { AuthVerify } from '@/types/scrapper';
import { puppeteerOptions } from '@/utils';
import { errorLog, log } from '@/utils/logs';
import { scrapper } from '@/utils/scrapper';

import { Request as Req, Response as Res } from 'express';
import puppeteer, { Page, Protocol } from 'puppeteer';

const done = async (res: Res<AuthVerify.Response>, page?: Page) => {
  if (page) await page.close();

  log(`[${200}]: All done!`);

  return res.status(200).json({ authenticationIsValid: true });
};

const validateFields = (
  req: Req<AuthVerify.Params, AuthVerify.Response, AuthVerify.Request>,
  res: Res<AuthVerify.Response>
) => {
  if (!req.body.login) {
    res.status(400).json({
      authenticationIsValid: false,
      error: 'login should not be empty',
    });

    return false;
  }
  if (!req.body.password) {
    res.status(400).json({
      authenticationIsValid: false,
      error: 'password should not be empty',
    });

    return false;
  }

  return true;
};

const signInScrapper = async (
  page: Page,
  req: Req<AuthVerify.Params, AuthVerify.Response, AuthVerify.Request>,
  res: Res<AuthVerify.Response>
): Promise<Protocol.Network.Cookie[]> => {
  // Sign In
  log('Starting "Sign In" process!');

  try {
    await page.goto(scrapper.accountLogin);

    await page.waitForSelector('form');

    await page.type('#Login', req.body.login);

    await page.type('#Password', req.body.password);

    await page.click('[type="submit"]');

    await page.waitForSelector('.sidebar-menu', { timeout: 3000 });

    if (page.url() !== scrapper.homeIndex) {
      errorLog(`[${406}]: Invalid login`);
      res
        .status(406)
        .json({ authenticationIsValid: false, error: 'Invalid login' });

      return [];
    }

    log('Sign In Success!');

    const cookies = await page.cookies();

    if (!cookies) {
      errorLog(`[${500}]: Cookies not loaded`);
      res
        .status(500)
        .json({ authenticationIsValid: false, error: 'Cookies not loaded' });

      return [];
    }

    return cookies;
  } catch (e) {
    errorLog('Sign In failure: ', { e });

    const { error, code } = puppeteerErrorHandler(e as Error);

    errorLog(`[${code}]: ${error}`);
    res.status(code).json({ authenticationIsValid: false, error });

    return [];
  }
};

export const authVerify: AuthVerify.Handler = async (req, res) => {
  if (!validateFields(req, res)) return;

  log('Start Auth Verify!\n');

  log('Starting the browser...');

  const browser = await puppeteer.launch(puppeteerOptions);
  const page = await browser.newPage();

  log('Browser active!\n');

  const cookies = await signInScrapper(page, req, res);

  if (cookies.length <= 0) return await page.close();

  return done(res, page);
};
