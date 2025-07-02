import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { orderTemplates } from '../templates/order-templates';
import { paymentTemplates } from '../templates/payment-templates';

import * as templateHelpers from '../helpers/template-helpers';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly configService: ConfigService) {
    // Register helpers
    Object.entries(templateHelpers).forEach(([name, helper]) => {
      Handlebars.registerHelper(name, helper as Handlebars.HelperDelegate);
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
    } catch (error: any) {
      this.logger.error(`Failed to render template: ${error.message}`);
      throw error;
    }
  }

  private getTemplate(
    name: string,
    locale: string,
  ): HandlebarsTemplateDelegate<any> {
    const templates: {
      [key: string]: { [locale: string]: HandlebarsTemplateDelegate<any> };
    } = {
      ...Object.keys(orderTemplates)
        .filter((key) => key !== 'compile')
        .reduce(
          (acc, key) => {
            acc[key] = orderTemplates[key as keyof typeof orderTemplates];
            return acc;
          },
          {} as {
            [key: string]: {
              [locale: string]: HandlebarsTemplateDelegate<any>;
            };
          },
        ),
      ...Object.keys(paymentTemplates)
        .filter((key) => key !== 'compile')
        .reduce(
          (acc, key) => {
            acc[key] = paymentTemplates[key as keyof typeof paymentTemplates];
            return acc;
          },
          {} as {
            [key: string]: {
              [locale: string]: HandlebarsTemplateDelegate<any>;
            };
          },
        ),
    };

    const template = templates[name]?.[locale] || templates[name]?.['en']; // Fallback to 'en' if locale-specific template is not found

    if (!template) {
      throw new Error(`Template ${name} not found for locale ${locale}`);
    }

    return template;
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
