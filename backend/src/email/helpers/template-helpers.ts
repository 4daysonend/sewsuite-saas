import { format } from 'date-fns';

export const templateHelpers = {
  formatPrice: (price: number) => price.toFixed(2),
  formatDate: (date: Date) => format(date, 'MMMM do, yyyy'),
  formatTime: (date: Date) => format(date, 'h:mm a'),
  year: () => new Date().getFullYear()
};
