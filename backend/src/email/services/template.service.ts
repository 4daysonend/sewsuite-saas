import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { orderTemplates } from '../templates/order-templates';
import { paymentTemplates } from '../templates/payment-templates';
import { templateHelpers } from '../helpers/template-helpers';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly configService: ConfigService) {
    // Register helpers
    Object.entries(templateHelpers).forEach(([name, helper]) => {
      Handlebars.registerHelper(name, helper);
    });
  }

  async renderTemplate(
    templateName: string,
    data: any,
    locale = 'en',
  ): Promise<{ html: string; text: string }> {
    try {
      const template = this.getTemplate(templateName, locale);
      if (!template) {
        throw new Error(`Template ${templateName} not found`);
      }

      const html = template({
        data,
        year: new Date().getFullYear(),
        baseUrl: this.configService.get('FRONTEND_URL'),
      });

      // Generate plain text version
      const text = this.convertToPlainText(html);

      return { html, text };
    } catch (error) {
      this.logger.error(`Failed to render template: ${error.message}`);
      throw error;
    }
  }

  private getTemplate(
    name: string,
    locale: string,
  ): HandlebarsTemplateDelegate {
    const templates = {
      ...orderTemplates,
      ...paymentTemplates,
    };

    return templates[name];
  }

  private convertToPlainText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*<\/style>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
