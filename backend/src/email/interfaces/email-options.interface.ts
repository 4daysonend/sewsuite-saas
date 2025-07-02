export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{
    filename: string;
    content: any;
  }>;
  priority?: 'high' | 'normal';
}
