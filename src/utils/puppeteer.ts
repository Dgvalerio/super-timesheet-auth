import { log } from '@/utils/logs';

import { Page } from 'puppeteer';

export const checkValue = async (
  page: Page,
  selector: string,
  value: string | boolean
) => {
  log(`Check value of ${selector}...`);

  const response = await page.evaluate(
    (aSelector, aValue) => {
      const value = (<HTMLInputElement>document.querySelector(aSelector))[
        typeof aValue === 'boolean' ? 'checked' : 'value'
      ];

      if (value !== aValue) {
        if (typeof aValue === 'boolean')
          (<HTMLInputElement>document.querySelector(aSelector)).checked =
            aValue;
        else
          (<HTMLInputElement>document.querySelector(aSelector)).value = aValue;

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
