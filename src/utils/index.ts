export const brDateToISO = (date: string) => {
  const [day, month, year] = date.split('/');

  return `${year}-${month}-${day}T00:00:00.000Z`;
};
