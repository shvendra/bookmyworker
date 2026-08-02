// Intl formatter construction is one of the most expensive operations under
// Hermes, so build each formatter ONCE at module scope and reuse .format().
// (Previously these were re-constructed on every call — jank in list rows.)
const currencyINR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateINR = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatCurrencyINR = (value: number): string => currencyINR.format(value);

export const formatDate = (dateLike: string | number | Date): string =>
  dateINR.format(new Date(dateLike));

export const maskPhoneNumber = (phone: string): string => {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 4) {
    return phone;
  }
  const suffix = normalized.slice(-4);
  return `******${suffix}`;
};
