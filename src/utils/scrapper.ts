import {
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
  LaunchOptions,
  Product,
} from 'puppeteer';

export const baseURL = `https://luby-timesheet.azurewebsites.net`;
export const accountLogin = `${baseURL}/Account/Login`;
export const homeIndex = `${baseURL}/Home/Index`;
export const worksheetRead = `${baseURL}/Worksheet/Read`;
export const controlPanelManagerDeveloper = `${baseURL}/ControlPanel/ManagerDeveloper`;

export const scrapper = {
  baseURL,
  homeIndex,
  worksheetRead,
  accountLogin,
  controlPanelManagerDeveloper,
};

export type PuppeteerLaunchOptions = LaunchOptions &
  BrowserLaunchArgumentOptions &
  BrowserConnectOptions & {
    product?: Product;
    extraPrefsFirefox?: Record<string, unknown>;
  };
