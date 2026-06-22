const formatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function formatCurrency(value: number): string {
  return formatter.format(value);
}
