import { AppointmentEntity, AppointmentStatus } from '@/models/appointment.dto';
import { CategoryEntity } from '@/models/category.dto';
import { ProjectEntity } from '@/models/project.dto';
import { UserEntity } from '@/models/user.dto';
import {
  apiFactory,
  puppeteerErrorHandler,
  statusAdapter,
} from '@/scrapper/seed';
import { SaveAppointments, Scrapper } from '@/types/scrapper';
import { puppeteerOptions } from '@/utils';
import { errorLog, log } from '@/utils/logs';
import { scrapper } from '@/utils/scrapper';

import { AxiosInstance } from 'axios';
import { Request as Req, Response as Res } from 'express';
import puppeteer, { Page, Protocol } from 'puppeteer';

const validateFields = (
  req: Req<
    SaveAppointments.Params,
    SaveAppointments.Response,
    SaveAppointments.Request
  >,
  res: Res<SaveAppointments.Response>
) => {
  if (!req.body.login) {
    res
      .status(400)
      .json([{ saved: false, message: 'login should not be empty' }]);

    return false;
  }
  if (!req.body.password) {
    res
      .status(400)
      .json([{ saved: false, message: 'password should not be empty' }]);

    return false;
  }
  if (!req.body.appointments || !Array.isArray(req.body.appointments)) {
    res
      .status(400)
      .json([{ saved: false, message: 'appointments must be an array' }]);

    return false;
  }

  return true;
};

const validateAppointment = (a: SaveAppointments.Appointment): string[] => {
  const e = [];

  if (!a.client) e.push('client should not be empty');
  if (!a.project) e.push('project should not be empty');
  if (!a.category) e.push('category should not be empty');
  if (!a.description) e.push('description should not be empty');
  if (!a.date) e.push('date should not be empty');
  if (typeof a.notMonetize !== 'boolean')
    e.push('notMonetize must be a boolean');
  if (!a.startTime) e.push('startTime should not be empty');
  if (!a.endTime) e.push('endTime should not be empty');

  return e;
};

const checkValue = async (
  page: Page,
  selector: string,
  value: string | boolean
) => {
  log(`Check value of ${selector}...`);

  const response = await page.evaluate(
    (aSelector, aValue) => {
      const value = (<HTMLInputElement>document.querySelector(aSelector)).value;

      if (value !== aValue) {
        (<HTMLInputElement>document.querySelector(aSelector)).value = <string>(
          aValue
        );

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

const signInScrapper = async (
  page: Page,
  req: Req<
    SaveAppointments.Params,
    SaveAppointments.Response,
    SaveAppointments.Request
  >,
  res: Res<SaveAppointments.Response>
): Promise<Protocol.Network.Cookie[]> => {
  // Sign In
  log('Starting "Sign In" process!');

  try {
    await page.goto(scrapper.accountLogin);

    await page.waitForSelector('form');

    await page.type('#Login', req.body.login);
    log(`${req.body.login} typed on #Login`);

    await page.type('#Password', req.body.password);
    log(`${req.body.password} typed on #Password`);

    await page.click('[type="submit"]');
    log('Form submitted');

    await page.waitForSelector('.sidebar-menu', { timeout: 3000 });
    log('.sidebar-menu waited with success');

    if (page.url() !== scrapper.homeIndex) {
      errorLog(`[${406}]: Invalid login`);
      res.status(406).json([{ saved: false, message: 'Invalid login' }]);

      return [];
    }
    log('login valid');

    log('Sign In Success!');

    const cookies = await page.cookies();

    if (!cookies) {
      errorLog(`[${500}]: Cookies not loaded`);
      res.status(500).json([{ saved: false, message: 'Cookies not loaded' }]);

      return [];
    }

    return cookies;
  } catch (e) {
    errorLog('Sign In failure: ', { e });

    const { error, code } = puppeteerErrorHandler(e as Error);

    errorLog(`[${code}]: ${error}`);
    res.status(code).json([{ saved: false, message: error }]);

    return [];
  }
};

const getFirstAppointment = async (
  page: Page,
  api: AxiosInstance,
  res: Res<SaveAppointments.Response>
): Promise<Scrapper.Appointment | undefined> => {
  let appointment;

  log('\nStarting "Get Appointments" process!');

  try {
    await page.goto(scrapper.worksheetRead);

    await page.waitForSelector('#tbWorksheet', { timeout: 3000 });

    const localAppointment = await page.evaluate(() => {
      const getInnerText = (field: unknown) =>
        (field as HTMLTableColElement)?.innerText;

      const getChecked = (field: unknown) =>
        ((field as HTMLTableColElement)?.children[0] as HTMLInputElement)
          .checked;

      const getId = (field: unknown) =>
        (field as HTMLTableColElement)?.children[0].id;

      const item = document.querySelector(
        '#tbWorksheet > tbody > tr:first-child'
      );

      if (!item) return;

      return {
        id: getId(item.children[9]),
        cliente: getInnerText(item.children[0]),
        projeto: getInnerText(item.children[1]),
        categoria: getInnerText(item.children[2]),
        data: getInnerText(item.children[3]),
        horaInicial: getInnerText(item.children[4]),
        horaFinal: getInnerText(item.children[5]),
        naoContabilizado: getChecked(item.children[7]),
        avaliacao: getInnerText(item.children[8]),
      };
    });

    if (!localAppointment) return;

    log(`Getting appointment infos`);

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
      `/Worksheet/Update?id=${localAppointment.id}`
    );

    appointment = {
      id: localAppointment.id,
      cliente: String(IdCustomer),
      projeto: String(IdProject),
      categoria: String(IdCategory),
      data: InformedDate,
      horaInicial: StartTime,
      horaFinal: EndTime,
      descricao: Description,
      naoContabilizado: NotMonetize,
      avaliacao: localAppointment.avaliacao,
      commit: CommitRepository || '',
    };
  } catch (e) {
    errorLog('Error on "Get Appointment" process!', e);

    const { error, code } = puppeteerErrorHandler(e as Error);

    errorLog(`[${code}]: ${error}`);
  }

  if (!appointment) {
    errorLog('Appointment not loaded');
    res
      .status(500)
      .json([{ saved: false, message: 'Appointments not loaded' }]);
  }

  log('End of "Get Appointment" process!');

  return appointment;
};

const createAppointment = async (
  page: Page,
  appointment: SaveAppointments.Appointment
): Promise<{ saved: boolean; message: string }> => {
  let saved: boolean;
  let message: string;

  log('\nStarting "Create Appointment" process!');

  try {
    await page.goto(scrapper.worksheetRead);

    await page.waitForSelector('#tbWorksheet', {
      visible: true,
      timeout: 3000,
    });
    log(`Now in ${scrapper.worksheetRead}!`);

    await page.select('#IdCustomer', appointment.client);
    await page.waitForResponse((response) =>
      response.url().includes('/Worksheet/ReadProject')
    );
    log(`${appointment.client} typed on #IdCustomer`);

    await page.select('#IdProject', appointment.project);
    await page.waitForResponse((response) =>
      response.url().includes('/Worksheet/ReadCategory')
    );
    await page.waitForResponse((response) =>
      response.url().includes('/Worksheet/ReadProjectProgress')
    );
    log(`${appointment.project} typed on #IdProject`);

    await page.select('#IdCategory', appointment.category);
    log(`${appointment.category} typed on #IdCategory`);

    await page.waitForSelector('#Description', {
      visible: true,
      timeout: 3000,
    });
    await page.click('#Description');
    await page.keyboard.type(appointment.description);
    await checkValue(page, '#Description', appointment.description);
    log(`${appointment.description} typed on #Description`);

    await page.waitForSelector('#InformedDate', {
      visible: true,
      timeout: 3000,
    });
    await page.click('#InformedDate');
    await page.keyboard.type(appointment.date);
    await checkValue(page, '#InformedDate', appointment.date);
    log(`${appointment.date} typed on #InformedDate`);

    if (appointment.commit) {
      await page.waitForSelector('#CommitRepository', {
        visible: true,
        timeout: 3000,
      });
      await page.click('#CommitRepository');
      await page.keyboard.type(appointment.commit);
      await checkValue(page, '#CommitRepository', appointment.commit);
      log(`${appointment.commit} typed on #CommitRepository`);
    }

    if (appointment.notMonetize) {
      await page.click('#NotMonetize');
      await checkValue(page, '#NotMonetize', appointment.notMonetize);
      log(`${appointment.notMonetize} typed on #NotMonetize`);
    }

    await page.waitForSelector('#StartTime', {
      visible: true,
      timeout: 3000,
    });
    await page.click('#StartTime');
    await page.keyboard.type(appointment.startTime);
    await checkValue(page, '#StartTime', appointment.startTime);
    log(`${appointment.startTime} typed on #StartTime`);

    await page.waitForSelector('#EndTime', { visible: true, timeout: 3000 });
    await page.click('#EndTime');
    await page.keyboard.type(appointment.endTime);
    await checkValue(page, '#EndTime', appointment.endTime);
    log(`${appointment.endTime} typed on #EndTime`);

    await page.click('[type="submit"]');
    log('Form submitted!');
    await page.waitForSelector('.alert.alert-warning', { timeout: 3000 });

    log('Success!');
    message = 'Success';
    saved = true;
  } catch (e) {
    saved = false;

    errorLog('Error on "Create Appointment" process:', e);
    errorLog('Message:', (<Error>e).message);

    let err = `There was a create appointments failure: ${(<Error>e).message}`;

    if (
      (<Error>e).message ===
      'waiting for selector `.alert.alert-warning` failed: timeout 3000ms exceeded'
    ) {
      errorLog('case waiting for selector `.alert.alert-warning`');
      try {
        await page.waitForSelector('.alert.alert-danger', {
          visible: true,
          timeout: 3000,
        });

        const response = await page.evaluate(
          () => document.querySelector('.alert.alert-danger')?.textContent
        );

        if (response) err = response.replace(/\n\s+/gm, '');
      } catch (e2) {}
    }

    message = err;
  }

  log('End of "Create Appointment" process!');

  return { saved, message };
};

const appointmentAdapter = (
  previous: Scrapper.Appointment
): SaveAppointments.Appointment => ({
  id: previous.id,
  client: previous.cliente,
  project: previous.projeto,
  category: previous.categoria,
  description: previous.descricao,
  date: previous.data.replace(/\//g, ''),
  commit: previous.commit === 'Não aplicado' ? undefined : previous.commit,
  notMonetize: previous.naoContabilizado,
  startTime: previous.horaInicial.replace(/:/g, ''),
  endTime: previous.horaFinal.replace(/:/g, ''),
});

const appointmentEntityAdapter = (
  local: SaveAppointments.Appointment,
  azure?: Scrapper.Appointment
): AppointmentEntity => ({
  id: local.id,
  code: azure ? azure.id : '',
  date: azure ? azure.data : local.date,
  startTime: azure ? azure.horaInicial : local.startTime,
  endTime: azure ? azure.horaFinal : local.endTime,
  notMonetize: local.notMonetize,
  description: local.description,
  commit: azure ? azure.commit : local.commit,
  status: azure ? statusAdapter(azure.avaliacao) : AppointmentStatus.Draft,
  user: {} as UserEntity,
  project: { code: local.project } as ProjectEntity,
  category: { code: local.category } as CategoryEntity,
});

const appointmentCompare = (
  scrapperAppointment: Scrapper.Appointment,
  appointmentEntity: SaveAppointments.Appointment
): boolean =>
  JSON.stringify({ ...appointmentEntity, id: '' }) ===
  JSON.stringify(appointmentAdapter({ ...scrapperAppointment, id: '' }));

const createAppointments = async (
  page: Page,
  api: AxiosInstance,
  res: Res<SaveAppointments.Response>,
  appointments: SaveAppointments.Appointment[]
): Promise<SaveAppointments.CreatedAppointment[]> => {
  const result: SaveAppointments.CreatedAppointment[] = [];

  const create = async (index: number) => {
    const appointment = appointments[index];

    const { saved, message } = await createAppointment(page, appointment);

    if (!saved) {
      if (
        message ===
        'O registro não pode ser realizado pois já existe um Apontamento dentro do intervalo de data e hora indicados'
      ) {
        const azureAppointment = await getFirstAppointment(page, api, res);

        if (!azureAppointment)
          return result.push({
            message,
            saved,
            appointment: appointmentEntityAdapter(appointment),
          });
        if (appointmentCompare(azureAppointment, appointment)) {
          result.push({
            message,
            saved: true,
            appointment: appointmentEntityAdapter(
              appointment,
              azureAppointment
            ),
          });
        }
      } else {
        result.push({
          message,
          saved,
          appointment: appointmentEntityAdapter(appointment),
        });
      }
    } else {
      const azureAppointment = await getFirstAppointment(page, api, res);

      if (!azureAppointment)
        return result.push({
          message,
          saved,
          appointment: appointmentEntityAdapter(appointment),
        });

      result.push({
        message,
        saved,
        appointment: appointmentCompare(azureAppointment, appointment)
          ? appointmentEntityAdapter(appointment, azureAppointment)
          : appointmentEntityAdapter(appointment),
      });
    }

    if (saved && index < appointments.length - 1) await create(index + 1);
  };

  await create(0);

  return result;
};

export const saveAppointments: SaveAppointments.Handler = async (req, res) => {
  if (!validateFields(req, res)) return;

  if (req.body.appointments.length <= 0) {
    return res
      .status(200)
      .json([{ saved: true, message: 'There are no appointments to save.' }]);
  }

  let allValid = true;

  req.body.appointments.forEach((appointment, index) => {
    const errors = validateAppointment(appointment);

    if (errors.length > 0) {
      const msg = errors.reduce((error, concat) => error + ' \n ' + concat);

      res.status(400).json([
        {
          saved: false,
          message: `In appointment on index ${index}:\n${msg}`,
        },
      ]);

      allValid = false;
    }
  });

  if (!allValid) return;

  log('Start Auth Verify!\n');

  log('Starting the browser...');

  const browser = await puppeteer.launch(puppeteerOptions);
  const page = await browser.newPage();

  log('Browser active!\n');

  const cookies = await signInScrapper(page, req, res);

  if (cookies.length <= 0) return await page.close();

  const api = apiFactory(cookies);

  const createdAppointments = await createAppointments(
    page,
    api,
    res,
    req.body.appointments
  );

  if (page) await page.close();

  log(`[${200}]: All done!`);

  return res.status(200).json(createdAppointments);
};
