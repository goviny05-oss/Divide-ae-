export interface CurrencyInfo {
  code: string;
  label: string;
  symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'BRL', label: 'Real (R$)', symbol: 'R$' },
  { code: 'USD', label: 'Dólar (US$)', symbol: 'US$' },
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'GBP', label: 'Libra (£)', symbol: '£' },
  { code: 'MXN', label: 'Peso Mexicano (MX$)', symbol: 'MX$' },
  { code: 'ARS', label: 'Peso Argentino ($)', symbol: '$' },
  { code: 'PEN', label: 'Sol Peruano (S/)', symbol: 'S/' },
  { code: 'COP', label: 'Peso Colombiano ($)', symbol: 'COP$' },
  { code: 'CLP', label: 'Peso Chileno ($)', symbol: 'CLP$' },
];

