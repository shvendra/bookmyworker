export const formatCurrencyINR = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export const formatDate = (dateLike: string | number | Date): string => {
  const date = new Date(dateLike);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const maskPhoneNumber = (phone: string): string => {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 4) {
    return phone;
  }
  const suffix = normalized.slice(-4);
  return `******${suffix}`;
};
