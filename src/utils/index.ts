import { PuppeteerLaunchOptions } from '@/utils/scrapper';

export const brDateToISO = (date: string) => {
  const [day, month, year] = date.split('/');

  return `${year}-${month}-${day}T00:00:00.000Z`;
};

export const puppeteerOptions: PuppeteerLaunchOptions = {
  args: ['--no-sandbox', '--window-size=1280,768'],
  defaultViewport: {
    width: 1280,
    height: 768,
  },
  headless: false,
};
