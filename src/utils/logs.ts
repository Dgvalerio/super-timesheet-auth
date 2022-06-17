/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

export const log = (...toLog: any) => {
  console.log(...toLog);
};

export const errorLog = (...toLog: any) => {
  console.error(...toLog);
};
