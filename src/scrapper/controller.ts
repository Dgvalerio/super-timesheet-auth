import { Scrapper } from '@/types/scrapper';
import { PuppeteerLaunchOptions, scrapper } from '@/utils/scrapper';

import axios from 'axios';
import puppeteer, { Protocol, PuppeteerErrors } from 'puppeteer';
import Client = Scrapper.Client;

const options: PuppeteerLaunchOptions = {
  args: ['--no-sandbox', '--window-size=1280,768'],
  defaultViewport: {
    width: 1280,
    height: 768,
  },
};

export const seed: Scrapper.Handler = async (req, res) => {
  if (!req.body.login) {
    return res.status(400).json({ error: 'login should not be empty' });
  }
  if (!req.body.password) {
    return res.status(400).json({ error: 'password should not be empty' });
  }

  console.log('Starting the browser...');

  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();

  console.log('Browser ON!');

  let cookies: Protocol.Network.Cookie[] = [];

  // Sign In
  await (async () => {
    console.log('Initiate Sign In process!');

    try {
      await page.goto(scrapper.accountLogin);

      await page.waitForSelector('form');

      await page.type('#Login', req.body.login);

      await page.type('#Password', req.body.password);

      await page.click('[type="submit"]');

      await page.waitForSelector('.sidebar-menu', { timeout: 3000 });

      if (page.url() !== scrapper.homeIndex) {
        return res.status(406).json({ error: 'Invalid login' });
      }

      cookies = await page.cookies();

      console.log('Sign In Success!');
    } catch (e) {
      console.error({ e });
      if (
        (<Error>e).message ===
        'waiting for selector `.sidebar-menu` failed: timeout 3000ms exceeded'
      ) {
        try {
          await page.waitForSelector('.login-container');
          res.status(401).json({ error: `Login is invalid!` });
        } catch (e2) {
          res.status(500).json({
            error: `There was a login failure: ${
              (<PuppeteerErrors>e2).message
            }`,
          });
        }
      } else {
        res.status(500).json({
          error: `There was a login failure: ${(<PuppeteerErrors>e).message}`,
        });
      }
    }
  })();

  if (!cookies || cookies.length === 0) {
    return res.status(401).json({ error: `Cookies not informed` });
  }

  const cookie: string = cookies.reduce(
    (previous, { name, value }) => `${previous} ${name}=${value};`,
    ''
  );

  // Read Clients
  await (async () => {
    console.log('Initiate Read Clients process!');

    const api = axios.create({
      baseURL: 'https://luby-timesheet.azurewebsites.net',
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-gpc': '1',
        'x-requested-with': 'XMLHttpRequest',
        cookie,
        Referer: 'https://luby-timesheet.azurewebsites.net/Worksheet/Read',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });

    /**
     * Read
     * */
    const listClients = async () => {
      try {
        const response = await api.get('/Worksheet/Read');

        const html: string = response.data;

        const regex = /(name="IdCustomer">)([\w\W]+?)(<\/select>)/gm;

        const search: string = (html.match(regex) || [''])[0];

        const cleanedSearch = search.split(/\r\n/gm).join('');

        const values = cleanedSearch.match(/value="([\S\s]+?)??">([\S\s]+?)</g);

        if (!values) {
          if (html.match('<div class="login-content">')) {
            res.status(401).json({ error: `Cookies are invalid!` });
          } else {
            res.status(500).json({ error: 'Options not found!' });
          }

          return;
        }

        const clientsPromise: Promise<Client>[] = values.map(async (option) => {
          const [id, title] = option
            .replace(/value="([\S\s]+?)??">([\S\s]+?)</g, '$1|$2')
            .split('|');

          console.log('Client: ', { id, title });

          // await listProjects(+id);

          return { id: id || '-1', title };
        });

        await Promise.all(clientsPromise);
      } catch (e) {
        console.error('Error on list clients: ', e);
      }
    };

    await listClients();
    console.log('Finalize Read Clients process!');
    res.status(200).json({ message: 'All done!' });
  })();

  // await (async () => {})();

  // await (async () => {})();

  // await (async () => {})();
};
