export const templateHelpers = {
  formatDate: (date: Date) => {
    return date.toISOString().split('T')[0];
  },
  // Add other helpers as needed
};
