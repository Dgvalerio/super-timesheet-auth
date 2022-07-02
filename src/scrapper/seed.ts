import { UserEntity } from '@/models/user.dto';
import { apiFactory } from '@/scrapper/api';
import { statusAdapter } from '@/types/adapters';
import { Scrapper } from '@/types/scrapper';
import { brDateToISO, puppeteerOptions } from '@/utils';
import { ApolloClientHelper } from '@/utils/apolloClient';
import { errorLog, log } from '@/utils/logs';
import { scrapper } from '@/utils/scrapper';

import { ApolloError } from 'apollo-boost';
import { AxiosInstance } from 'axios';
import { endOfMonth, format } from 'date-fns';
import { Request as Req, Response as Res } from 'express';
import jwt from 'jsonwebtoken';
import puppeteer, { Browser, Page, Protocol } from 'puppeteer';

const close = async (browser: Browser, page: Page) => {
  if (page) await page.close();
  if (browser) await browser.close();
};

const validateFields = (
  req: Req<Scrapper.Params, Scrapper.Response, Scrapper.Request>,
  res: Res<Scrapper.Response>
) => {
  if (!req.body.login) {
    res.status(400).json({ error: 'login should not be empty' });

    return false;
  }
  if (!req.body.password) {
    res.status(400).json({ error: 'password should not be empty' });

    return false;
  }
  if (!req.body.token) {
    res.status(400).json({ error: 'token should not be empty' });

    return false;
  }

  return true;
};

const apolloErrorHandler = (
  e: ApolloError
): { code: number; error: string } => {
  if (e.networkError) {
    errorLog(e.networkError);

    return {
      code: Number((e.networkError as unknown as { code: string }).code),
      error: 'Network Error',
    };
  } else if (e.graphQLErrors) {
    const { message, extensions } = e.graphQLErrors[0];

    errorLog('extensions:', extensions);

    const { response } = <
      { response: { statusCode: number; message: string[] } }
    >extensions;

    const code = response.statusCode;

    if (response.message) errorLog(response.message);

    return { code, error: message };
  } else {
    return { code: 500, error: 'Nothing ok...' };
  }
};

export const puppeteerErrorHandler = (
  e: Error
): { code: number; error: string } => ({
  code: 500,
  error: `There was a failure: ${e.message}`,
});

const getUserInfos = async (
  apolloClient: ApolloClientHelper,
  req: Req<Scrapper.Params, Scrapper.Response, Scrapper.Request>,
  res: Res<Scrapper.Response>
): Promise<UserEntity | undefined> => {
  let getUser: UserEntity;

  try {
    log('Getting user infos...!');

    const data = await apolloClient.getUserEmail({
      id: `${jwt.decode(req.body.token)?.sub}`,
    });

    getUser = data.getUser;
  } catch (e) {
    const { code, error } = apolloErrorHandler(<ApolloError>e);

    errorLog(`[${code}]: ${error}`);
    res.status(code).json({ error });

    return;
  }

  if (!getUser) {
    const message = 'Unauthenticated! User Not Found...';

    errorLog(message);
    res.status(401).json({ message });

    return;
  }

  log('User found!\n');

  return getUser;
};

const signInScrapper = async (
  page: Page,
  req: Req<Scrapper.Params, Scrapper.Response, Scrapper.Request>,
  res: Res<Scrapper.Response>
): Promise<Protocol.Network.Cookie[]> => {
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
      res.status(406).json({ error: 'Invalid login' });

      return [];
    }

    log('Sign In Success!');

    const cookies = await page.cookies();

    if (!cookies) {
      errorLog(`[${500}]: Cookies not loaded`);
      res.status(500).json({ error: 'Cookies not loaded' });

      return [];
    }

    return cookies;
  } catch (e) {
    errorLog('Sign In failure: ', { e });

    const { error, code } = puppeteerErrorHandler(e as Error);

    errorLog(`[${code}]: ${error}`);
    res.status(code).json({ error });

    return [];
  }
};

const getClients = async (
  api: AxiosInstance,
  res: Res<Scrapper.Response>
): Promise<Scrapper.Client[]> => {
  const clients: Scrapper.Client[] = [];

  log('\nStarting "Get Clients" process!');

  try {
    const response = await api.get('/Worksheet/Read');

    const html: string = response.data;

    const regex = /(name="IdCustomer">)([\w\W]+?)(<\/select>)/gm;

    const search: string = (html.match(regex) || [''])[0];

    const cleanedSearch = search.split(/\r\n/gm).join('');

    const values = cleanedSearch.match(/value="([\S\s]+?)??">([\S\s]+?)</g);

    if (!values) {
      if (html.match('<div class="login-content">')) {
        errorLog(`[${401}]: Cookies are invalid!`);
        res.status(401).json({ error: `Cookies are invalid!` });
      } else {
        errorLog(`[${500}]: Options not found!`);
        res.status(500).json({ error: 'Options not found!' });
      }

      return [];
    }

    const clientsPromise: Promise<Scrapper.Client>[] = values.map(
      async (option) => {
        const [id, title] = option
          .replace(/value="([\S\s]+?)??">([\S\s]+?)</g, '$1|$2')
          .split('|');

        if (id) clients.push({ id, title });

        return { id: id || '-1', title };
      }
    );

    await Promise.all(clientsPromise);

    log('End of "Get Clients" process!');
  } catch (e) {
    errorLog('Error on "Get Clients" process!', e);
    res.status(500).json({ error: 'Error on "Get Clients" process!' });
  }

  if (clients.length <= 0) {
    errorLog('Clients not loaded');
    res.status(500).json({ error: 'Clients not loaded' });
  }

  return clients;
};

const saveClients = async (
  clients: Scrapper.Client[],
  apolloClient: ApolloClientHelper
): Promise<void> => {
  const saveClient = async (index: number) => {
    const { id, title } = clients[index];

    try {
      await apolloClient.createClient({ code: id, name: title });
    } catch (e) {
      const { error: err } = apolloErrorHandler(e as ApolloError);

      errorLog(`Erro on save client ${index + 1} of ${clients.length}: ${err}`);
    }

    if (index < clients.length - 1) await saveClient(index + 1);
  };

  await saveClient(0);
};

const getProjects = async (
  clients: Scrapper.Client[],
  api: AxiosInstance,
  res: Res<Scrapper.Response>
): Promise<Scrapper.Project[]> => {
  let projects: Scrapper.Project[] = [];

  log('\nStarting "Get Projects" process!');

  const getClientProjects = async (index: number) => {
    const { id } = clients[index];

    try {
      const { data } = await api.post<Omit<Scrapper.Project, 'progress'>[]>(
        '/Worksheet/ReadProject',
        `idcustomer=${id}`
      );

      projects = projects.concat(data);
    } catch (e) {
      errorLog(`Error on "Get Projects [${id}]" process!`, e);
    }

    if (index < clients.length - 1) await getClientProjects(index + 1);
  };

  await getClientProjects(0);

  if (projects.length <= 0) {
    errorLog('Projects not loaded');
    res.status(500).json({ error: 'Projects not loaded' });
  }

  log('End of "Get Projects" process!');

  return projects;
};

const saveProjects = async (
  userEmail: string,
  projects: Scrapper.Project[],
  apolloClient: ApolloClientHelper
): Promise<void> => {
  const saveProject = async (index: number) => {
    const { Id, Name, EndDate, StartDate, IdCustomer } = projects[index];

    try {
      await apolloClient.createProject({
        code: String(Id),
        name: Name,
        startDate: brDateToISO(StartDate),
        endDate: brDateToISO(EndDate),
        clientCode: String(IdCustomer),
      });
    } catch (e) {
      const { error } = apolloErrorHandler(e as ApolloError);

      errorLog(
        `Error on save project ${index + 1} of ${projects.length}: ${error}`
      );
    }

    try {
      await apolloClient.addProjectToUser({
        userEmail,
        projectCode: String(Id),
      });
    } catch (e) {
      const { error } = apolloErrorHandler(e as ApolloError);

      errorLog(
        `Error on add project ${index + 1} of ${
          projects.length
        } to user: ${error}`
      );
    }

    if (index < projects.length - 1) await saveProject(index + 1);
  };

  await saveProject(0);
};

const getCategories = async (
  projects: Scrapper.Project[],
  api: AxiosInstance,
  res: Res<Scrapper.Response>
): Promise<Scrapper.Category[]> => {
  const categories: Scrapper.Category[] = [];

  log('\nStarting "Get Categories" process!');

  const getProjectCategories = async (index: number) => {
    try {
      const { data } = await api.post<Scrapper.Category[]>(
        '/Worksheet/ReadCategory',
        `idproject=${projects[index].Id}`
      );

      data.map((category) => {
        if (!categories.find(({ Id }) => Id === category.Id)) {
          categories.push(category);
        }
      });
    } catch (e) {
      errorLog(`Error on "Get Categories [${index}]" process!`, e);
    }

    if (index < projects.length - 1) await getProjectCategories(index + 1);
  };

  await getProjectCategories(0);

  if (categories.length <= 0) {
    errorLog('Categories not loaded');
    res.status(500).json({ error: 'Categories not loaded' });
  }

  log('End of "Get Categories" process!');

  return categories;
};

const saveCategories = async (
  categories: Scrapper.Category[],
  apolloClient: ApolloClientHelper
): Promise<void> => {
  const saveCategory = async (index: number) => {
    const { Id, Name, IdProject } = categories[index];

    try {
      await apolloClient.createCategory({
        code: String(Id),
        name: Name,
      });
    } catch (e) {
      const { error } = apolloErrorHandler(e as ApolloError);

      errorLog(
        `Error on save category ${index + 1} of ${categories.length}: ${error}`
      );
    }

    try {
      await apolloClient.addCategoryToProject({
        categoryCode: String(Id),
        projectCode: String(IdProject),
      });
    } catch (e) {
      const { error } = apolloErrorHandler(e as ApolloError);

      errorLog(
        `Error on add category ${index + 1} of ${
          categories.length
        } to project: ${error}`
      );
    }

    if (index < categories.length - 1) await saveCategory(index + 1);
  };

  await saveCategory(0);
};

const getAppointments = async (
  page: Page,
  api: AxiosInstance,
  res: Res<Scrapper.Response>
): Promise<Scrapper.Appointment[]> => {
  let appointments: Scrapper.Appointment[] = [];

  log('\nStarting "Get Appointments" process!');

  try {
    await page.goto(scrapper.worksheetRead);

    await page.waitForSelector('#tbWorksheet', { timeout: 3000 });

    const localAppointments = await page.evaluate(() => {
      const items: Omit<Scrapper.Appointment, 'descricao' | 'commit'>[] = [];

      const getInnerText = (field: unknown) =>
        (field as HTMLTableColElement)?.innerText;

      const getChecked = (field: unknown) =>
        ((field as HTMLTableColElement)?.children[0] as HTMLInputElement)
          .checked;

      const getId = (field: unknown) =>
        (field as HTMLTableColElement)?.children[0].id;

      const pushItems = () =>
        document
          .querySelectorAll('#tbWorksheet > tbody > tr')
          .forEach(({ children }) =>
            items.push({
              id: getId(children[9]),
              cliente: getInnerText(children[0]),
              projeto: getInnerText(children[1]),
              categoria: getInnerText(children[2]),
              data: getInnerText(children[3]),
              horaInicial: getInnerText(children[4]),
              horaFinal: getInnerText(children[5]),
              naoContabilizado: getChecked(children[7]),
              avaliacao: getInnerText(children[8]),
            })
          );

      pushItems();

      return items;
    });

    const appointmentsWithDescriptionPromise = localAppointments.map(
      async (appointment, appointmentPos) => {
        log(
          `Getting appointment ${appointmentPos + 1} of ${
            localAppointments.length
          } infos`
        );

        const {
          data: {
            IdCustomer,
            IdProject,
            IdCategory,
            InformedDate,
            StartTime,
            EndTime,
            NotMonetize,
            Description,
            CommitRepository,
          },
        } = await api.get<Scrapper.FullAppointment>(
          `/Worksheet/Update?id=${appointment.id}`
        );

        log(
          `Infos from appointment ${appointmentPos + 1} of ${
            localAppointments.length
          } received!`
        );

        return {
          id: appointment.id,
          cliente: String(IdCustomer),
          projeto: String(IdProject),
          categoria: String(IdCategory),
          data: InformedDate,
          horaInicial: StartTime,
          horaFinal: EndTime,
          descricao: Description,
          naoContabilizado: NotMonetize,
          avaliacao: appointment.avaliacao,
          commit: CommitRepository || '',
        };
      }
    );

    const appointmentsWithDescription: Scrapper.Appointment[] =
      await Promise.all(appointmentsWithDescriptionPromise);

    appointments = appointments.concat(appointmentsWithDescription);
  } catch (e) {
    errorLog('Error on "Get Appointments" process!', e);

    const { error, code } = puppeteerErrorHandler(e as Error);

    errorLog(`[${code}]: ${error}`);
  }

  if (appointments.length <= 0) {
    errorLog('Appointments not loaded');
    res.status(500).json({ error: 'Appointments not loaded' });
  }

  log('End of "Get Appointments" process!');

  return appointments;
};

const saveAppointments = async (
  appointments: Scrapper.Appointment[],
  userEmail: string,
  apolloClient: ApolloClientHelper
): Promise<void> => {
  const saveAppointment = async (index: number) => {
    const {
      id,
      data,
      horaInicial,
      horaFinal,
      naoContabilizado,
      descricao,
      commit,
      avaliacao,
      projeto,
      categoria,
    } = appointments[index];

    try {
      await apolloClient.createAppointment({
        code: id,
        date: brDateToISO(data),
        startTime: horaInicial,
        endTime: horaFinal,
        notMonetize: naoContabilizado,
        description: descricao,
        commit: commit,
        status: statusAdapter(avaliacao),
        userEmail,
        projectCode: projeto,
        categoryCode: categoria,
      });
    } catch (e) {
      const { error } = apolloErrorHandler(e as ApolloError);

      errorLog(
        `Error on create appointment ${index + 1} of ${
          appointments.length
        }: ${error}`
      );
    }

    if (index < appointments.length - 1) await saveAppointment(index + 1);
  };

  await saveAppointment(0);
};

const getTimeInterval = async (
  page: Page,
  res: Res<Scrapper.Response>
): Promise<string> => {
  const checkValue = async (
    page: Page,
    selector: string,
    value: string | boolean
  ) => {
    log(`Check value of ${selector}...`);

    const response = await page.evaluate(
      (aSelector, aValue) => {
        const value = (<HTMLInputElement>document.querySelector(aSelector))
          .value;

        if (value !== aValue) {
          (<HTMLInputElement>document.querySelector(aSelector)).value = <
            string
          >aValue;

          return false;
        }

        return true;
      },
      selector,
      value
    );

    if (response) log(`${selector} typed!`);
    else await checkValue(page, selector, value);
  };

  let timeInterval = '00:00';

  const now = new Date();

  now.setMonth(now.getMonth() - 1);
  now.setDate(1);

  const startDate = format(now, 'dd/MM/yyyy');

  now.setDate(endOfMonth(now).getDate());

  const endDate = format(now, 'dd/MM/yyyy');

  log('\nStarting "Get Time Interval" process!');

  try {
    await page.goto(scrapper.controlPanelManagerDeveloper);
    await page.waitForSelector('form', {
      visible: true,
      timeout: 3000,
    });

    await page.waitForSelector('#StartDate', {
      visible: true,
      timeout: 3000,
    });
    await page.click('#StartDate');
    await page.keyboard.type(startDate);
    await checkValue(page, '#StartDate', startDate);

    await page.waitForSelector('#EndDate', { visible: true, timeout: 3000 });
    await page.click('#EndDate');
    await page.keyboard.type(endDate);
    await checkValue(page, '#EndDate', endDate);

    await page.click('[type="submit"]');
    log('Form submitted!');

    await page.waitForSelector('#tbReport', { timeout: 3000 });

    const returnedInterval = await page.evaluate(
      () =>
        document.querySelector(
          '#tbReport > tbody:nth-child(3) > tr > td:nth-child(8)'
        )?.textContent
    );

    if (returnedInterval)
      timeInterval = returnedInterval.replace(
        /\((\d+)h(\d+)min\)/gm,
        (match, p1, p2) => `${p1}:${p2}`
      );
  } catch (e) {
    errorLog('Error on "Get Time Interval" process!', e);

    const { error, code } = puppeteerErrorHandler(e as Error);

    res.status(code).json({ error });

    timeInterval = '';
  }

  log('End of "Get Time Interval" process!');

  return timeInterval;
};

const saveTimeInterval = async (
  timeInterval: string,
  apolloClient: ApolloClientHelper,
  req: Req<Scrapper.Params, Scrapper.Response, Scrapper.Request>,
  res: Res<Scrapper.Response>
): Promise<boolean> => {
  let saved = false;

  log('\nStarting "Save Time Interval" process!');

  try {
    await apolloClient.updateAzureInfosCurrentMonthWorkedTime({
      login: req.body.login,
      currentMonthWorkedTime: timeInterval,
    });

    saved = true;
  } catch (e) {
    errorLog('Error on "Save Time Interval" process!', e);

    const { code, error } = apolloErrorHandler(e as ApolloError);

    res.status(code).json({ error });
  }

  log('End of "Save Time Interval" process!');

  return saved;
};

export const seed: Scrapper.Handler = async (req, res) => {
  if (!validateFields(req, res)) return;

  log('Start Seed!\n');

  const apolloClient = new ApolloClientHelper(req.body.token);

  const user = await getUserInfos(apolloClient, req, res);

  if (!user) return;

  log('Starting the browser...');

  const browser = await puppeteer.launch(puppeteerOptions);
  const page = await browser.newPage();

  await page.setRequestInterception(true);

  page.on('request', (request) => {
    if (
      request.url() ===
        'https://luby-timesheet.azurewebsites.net/Content/neon/assets/js/datatables/datatables.js' ||
      ['image', 'stylesheet', 'font', 'other'].includes(request.resourceType())
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });

  log('Browser active!\n');

  const cookies = await signInScrapper(page, req, res);

  if (cookies.length <= 0) return await close(browser, page);

  const api = apiFactory(cookies);

  const clients = await getClients(api, res);

  if (clients.length <= 0) return await close(browser, page);

  await saveClients(clients, apolloClient);

  const projects = await getProjects(clients, api, res);

  if (projects.length <= 0) return await close(browser, page);

  await saveProjects(user.email, projects, apolloClient);

  const categories = await getCategories(projects, api, res);

  if (categories.length <= 0) return await close(browser, page);

  await saveCategories(categories, apolloClient);

  const appointments = await getAppointments(page, api, res);

  if (appointments.length <= 0) return await close(browser, page);

  await saveAppointments(appointments, user.email, apolloClient);

  const timeInterval = await getTimeInterval(page, res);

  if (timeInterval === '') return await close(browser, page);

  const timeIntervalSaved = await saveTimeInterval(
    timeInterval,
    apolloClient,
    req,
    res
  );

  if (!timeIntervalSaved) return await close(browser, page);

  await close(browser, page);

  log(`[${200}]: All done!`);

  return res.status(200).json({ message: 'All done!' });
};
