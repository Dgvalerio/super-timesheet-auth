import { Scrapper } from '@/types/scrapper';
import { brDateToISO } from '@/utils';
import { ApolloClientHelper } from '@/utils/apolloClient';
import { AppointmentStatus } from '@/utils/appointment.dto';
import { error, log } from '@/utils/logs';
import { PuppeteerLaunchOptions, scrapper } from '@/utils/scrapper';
import { UserEntity } from '@/utils/user.dto';

import { ApolloError } from 'apollo-boost';
import axios from 'axios';
import { GraphQLError } from 'graphql';
import jwt from 'jsonwebtoken';
import puppeteer, { Protocol, PuppeteerErrors } from 'puppeteer';

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
  if (!req.body.token) {
    return res.status(400).json({ error: 'token should not be empty' });
  }

  log('Start Seed!\n');

  const apolloClient = new ApolloClientHelper(req.body.token);

  const decode = jwt.decode(req.body.token);

  let getUser: UserEntity;

  try {
    log('Getting user infos...!');

    const data = await apolloClient.getUserEmail({ id: `${decode?.sub}` });

    getUser = data.getUser;
  } catch (e) {
    if (!(<ApolloError>e).graphQLErrors)
      return res.status(500).json({ error: 'Nothing ok...' });

    const { message, extensions } = (<ApolloError>e).graphQLErrors[0];
    const code = (<{ response: { statusCode: number } }>extensions).response
      .statusCode;

    return res.status(code).json({ error: message });
  }

  if (!getUser) {
    error('Unauthenticated! User Not Found...');

    return res
      .status(401)
      .json({ message: 'Unauthenticated! User Not Found...' });
  }

  log('User found!\n');

  log('Starting the browser...');

  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();

  log('Browser active!\n');

  let cookies: Protocol.Network.Cookie[] = [];

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
      await page.close();

      return res.status(406).json({ error: 'Invalid login' });
    }

    cookies = await page.cookies();

    log('Sign In Success!');
  } catch (e) {
    error('Sign In failure: ', { e });
    if (
      (<Error>e).message ===
      'waiting for selector `.sidebar-menu` failed: timeout 3000ms exceeded'
    ) {
      try {
        await page.waitForSelector('.login-container');
        res.status(401).json({ error: `Login is invalid!` });
      } catch (e2) {
        res.status(500).json({
          error: `There was a login failure: ${(<PuppeteerErrors>e2).message}`,
        });
      }
    } else {
      res.status(500).json({
        error: `There was a login failure: ${(<PuppeteerErrors>e).message}`,
      });
    }
  }

  if (!cookies || cookies.length === 0) {
    await page.close();

    return res.status(401).json({ error: `Cookies not informed` });
  }

  const cookie: string = cookies.reduce(
    (previous, { name, value }) => `${previous} ${name}=${value};`,
    ''
  );

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

  const clients: Scrapper.Client[] = [];
  let projects: Scrapper.Project[] = [];
  const categories: Scrapper.Category[] = [];
  let appointments: Scrapper.Appointment[] = [];

  const getClients = async () => {
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
          res.status(401).json({ error: `Cookies are invalid!` });
        } else {
          res.status(500).json({ error: 'Options not found!' });
        }

        return;
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
      error('Error on "Get Clients" process!', e);
    }
  };

  await getClients();

  const getProjects = async (idCustomer: number): Promise<void> => {
    log('\nStarting "Get Projects" process!');

    try {
      const { data } = await api.post<Omit<Scrapper.Project, 'progress'>[]>(
        '/Worksheet/ReadProject',
        `idcustomer=${idCustomer}`
      );

      projects = projects.concat(data);
    } catch (e) {
      error('Error on "Get Projects" process!', e);
    }

    log('End of "Get Projects" process!');
  };

  if (clients.length <= 0) {
    await page.close();

    return res.status(200).json({ message: 'All done!' });
  }

  const saveClient = async (clientPos: number) => {
    const { id, title } = clients[clientPos];

    try {
      await apolloClient.createClient({ code: id, name: title });
    } catch (e) {
      if ((<ApolloError>e).graphQLErrors.length > 0) {
        const { message } = (<{ graphQLErrors: GraphQLError[] }>e)
          .graphQLErrors[0];

        error(
          `Erro on save client ${clientPos + 1} of ${
            clients.length
          }: ${message}`
        );
      } else {
        throw e;
      }
    }

    await getProjects(+id);

    if (clientPos < clients.length - 1) {
      await saveClient(clientPos + 1);
    }
  };

  try {
    await saveClient(0);
  } catch (e) {
    if ((<ApolloError>e).networkError) {
      error(
        'Error on "Save Client" process!',
        (<{ networkError: { code: string } }>e).networkError.code
      );

      await page.close();

      return res.status(500).json({
        error: (<{ networkError: { code: string } }>e).networkError.code,
      });
    }

    res.status(500).json({ error: JSON.stringify(<ApolloError>e) });
  }

  if (projects.length <= 0) {
    await page.close();

    return res.status(200).json({ message: 'All done!' });
  }

  const getCategories = async (idProject: number): Promise<void> => {
    log('\nStarting "Get Categories" process!');

    try {
      const { data } = await api.post<Scrapper.Category[]>(
        '/Worksheet/ReadCategory',
        `idproject=${idProject}`
      );

      data.map((category) => {
        if (!categories.find(({ Id }) => Id === category.Id)) {
          categories.push(category);
        }
      });
    } catch (e) {
      error('Error on "Get Categories" process!', e);
    }

    log('End of "Get Categories" process!');
  };

  log('\nStarting "Save Projects" process!');

  const saveProject = async (projectPos: number) => {
    const { Id, Name, EndDate, StartDate, IdCustomer } = projects[projectPos];

    try {
      await apolloClient.createProject({
        code: String(Id),
        name: Name,
        startDate: brDateToISO(StartDate),
        endDate: brDateToISO(EndDate),
        clientCode: String(IdCustomer),
      });
    } catch (e) {
      const { message } = (<{ graphQLErrors: GraphQLError[] }>e)
        .graphQLErrors[0];

      error(
        `Error on save project ${projectPos + 1} of ${
          projects.length
        }: ${message}`
      );
    }

    try {
      await apolloClient.addProjectToUser({
        userEmail: getUser.email,
        projectCode: String(Id),
      });
    } catch (e) {
      const { message } = (<{ graphQLErrors: GraphQLError[] }>e)
        .graphQLErrors[0];

      error(
        `Error on add project ${projectPos + 1} of ${
          projects.length
        } to user: ${message}`
      );
    }

    await getCategories(+Id);

    if (projectPos < projects.length - 1) {
      await saveProject(projectPos + 1);
    }
  };

  log('End of "Save Projects" process!');

  await saveProject(0);

  if (categories.length <= 0) {
    await page.close();

    return res.status(200).json({ message: 'All done!' });
  }

  const saveCategory = async (categoryPos: number) => {
    const { Id, Name, IdProject } = categories[categoryPos];

    try {
      await apolloClient.createCategory({
        code: String(Id),
        name: Name,
      });
    } catch (e) {
      const { message } = (<{ graphQLErrors: GraphQLError[] }>e)
        .graphQLErrors[0];

      error(
        `Error on  save category ${categoryPos + 1} of ${
          categories.length
        }: ${message}`
      );
    }

    try {
      await apolloClient.addCategoryToProject({
        categoryCode: String(Id),
        projectCode: String(IdProject),
      });
    } catch (e) {
      const { message } = (<{ graphQLErrors: GraphQLError[] }>e)
        .graphQLErrors[0];

      error(
        `Error on add category ${categoryPos + 1} of ${
          categories.length
        } to project: ${message}`
      );
    }

    await getCategories(+Id);

    if (categoryPos < categories.length - 1) {
      await saveCategory(categoryPos + 1);
    }
  };

  log('\nStarting "Save Categories" process!');

  await saveCategory(0);

  log('End of "Save Categories" process!');

  const getAppointments = async () => {
    log('\nStarting "Get Appointments" process!');

    try {
      await page.goto(scrapper.worksheetRead);

      await page.waitForSelector('#tbWorksheet', { timeout: 3000 });

      const localAppointments = await page.evaluate(() => {
        const items: Omit<Scrapper.Appointment, 'descricao' | 'commit'>[] = [];

        const pushItems = () =>
          document
            .querySelectorAll('#tbWorksheet > tbody > tr')
            .forEach(({ children }) =>
              items.push({
                id: (children[9] as HTMLTableColElement)?.children[0].id,
                cliente: (children[0] as HTMLTableColElement)?.innerText,
                projeto: (children[1] as HTMLTableColElement)?.innerText,
                categoria: (children[2] as HTMLTableColElement)?.innerText,
                data: (children[3] as HTMLTableColElement)?.innerText,
                horaInicial: (children[4] as HTMLTableColElement)?.innerText,
                horaFinal: (children[5] as HTMLTableColElement)?.innerText,
                naoContabilizado: (
                  (children[7] as HTMLTableColElement)
                    ?.children[0] as HTMLInputElement
                ).checked,
                avaliacao: (children[8] as HTMLTableColElement)?.innerText,
              })
            );

        pushItems();

        while (
          !document
            .querySelector('#tbWorksheet_next')
            ?.classList.contains('disabled')
        ) {
          (<HTMLButtonElement>(
            document.querySelector('#tbWorksheet_next')
          ))?.click();

          pushItems();
        }

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

      log('End of "Get Appointments" process!');
    } catch (e) {
      error('Error on "Get Appointments" process!', e);
      if (
        (<Error>e).message ===
        'waiting for selector `#tbWorksheet` failed: timeout 3000ms exceeded'
      ) {
        try {
          await page.waitForSelector('.login-container');

          await page.close();

          return res.status(401).json({ error: `Cookies are invalid!` });
        } catch (e2) {
          await page.close();

          return res.status(500).json({
            error: `There was a list appointments failure: ${
              (<PuppeteerErrors>e2).message
            }`,
          });
        }
      } else {
        await page.close();

        return res.status(500).json({
          error: `There was a list appointments failure: ${
            (<PuppeteerErrors>e).message
          }`,
        });
      }
    }
  };

  await getAppointments();

  if (appointments.length <= 0) {
    await page.close();

    return res.status(200).json({ message: 'All done!' });
  }

  const saveAppointment = async (appointmentPos: number) => {
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
    } = appointments[appointmentPos];

    let status: AppointmentStatus;

    switch (avaliacao) {
      case 'Aprovada':
        status = AppointmentStatus.Approved;
        break;
      default:
        status = AppointmentStatus.Draft;
    }

    try {
      await apolloClient.createAppointment({
        code: id,
        date: brDateToISO(data),
        startTime: horaInicial,
        endTime: horaFinal,
        notMonetize: naoContabilizado,
        description: descricao,
        commit: commit,
        status,
        userEmail: getUser.email,
        projectCode: projeto,
        categoryCode: categoria,
      });
    } catch (e) {
      if ((<ApolloError>e).graphQLErrors.length > 0) {
        const { message } = (<{ graphQLErrors: GraphQLError[] }>e)
          .graphQLErrors[0];

        error(
          `Error on save appointment ${appointmentPos + 1} of ${
            appointments.length
          }: ${message}`
        );
      } else {
        throw e;
      }
    }

    if (appointmentPos < appointments.length - 1) {
      await saveAppointment(appointmentPos + 1);
    }
  };

  try {
    log('\nStarting "Save Appointments" process!');

    await saveAppointment(0);

    log('End of "Save Appointments" process!');
  } catch (e) {
    if ((<ApolloError>e).networkError) {
      error(
        'Error on "Save Appointment" process!',
        (<{ networkError: { code: string } }>e).networkError
      );

      await page.close();

      return res.status(500).json({
        error: (<{ networkError: { code: string } }>e).networkError.code,
      });
    }

    await page.close();

    return res.status(500).json({ error: JSON.stringify(<ApolloError>e) });
  }

  await page.close();

  return res.status(200).json({ message: 'All done!' });
};
