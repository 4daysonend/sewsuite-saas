import * as Handlebars from 'handlebars';

export const registerTemplateHelpers = (): void => {
  // Price formatting helper
  Handlebars.registerHelper('formatPrice', (value: number) => {
    if (typeof value !== 'number') return '0.00';
    return value.toFixed(2);
  });

  // Date formatting helper
  Handlebars.registerHelper('formatDate', (date: Date | string) => {
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  });

  // Time formatting helper
  Handlebars.registerHelper('formatTime', (date: Date | string) => {
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleTimeString();
    } catch {
      return 'Invalid Time';
    }
  });

  // Format datetime helper
  Handlebars.registerHelper('formatDateTime', (date: Date | string) => {
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleString();
    } catch {
      return 'Invalid DateTime';
    }
  });
};
