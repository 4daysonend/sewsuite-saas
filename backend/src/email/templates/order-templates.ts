import { compile } from 'handlebars';
import { baseTemplate } from './base.templates';

const orderCreationTemplateEn = `
  ${baseTemplate}
  {{#with data}}
  <h2>Order Confirmation</h2>
  <p>Dear {{clientName}},</p>
  <p>Your order has been successfully created. Here are the details:</p>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Order ID:</strong> {{orderId}}</p>
    <p><strong>Tailor:</strong> {{tailorName}}</p>
    <p><strong>Total Amount:</strong> $\{{formatPrice totalAmount}}</p>
    <p><strong>Status:</strong> {{status}}</p>
  </div>
  <p>Your tailor will review your order and begin work soon.</p>
  <a href="{{orderUrl}}" class="button">View Order Details</a>
  {{/with}}
`;

const orderStatusTemplateEn = `
  ${baseTemplate}
  {{#with data}}
  <h2>Order Status Update</h2>
  <p>Dear {{clientName}},</p>
  <p>Your order status has been updated:</p>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Order ID:</strong> {{orderId}}</p>
    <p><strong>New Status:</strong> {{newStatus}}</p>
    <p><strong>Previous Status:</strong> {{oldStatus}}</p>
    {{#if notes}}
    <p><strong>Notes:</strong> {{notes}}</p>
    {{/if}}
  </div>
  <a href="{{orderUrl}}" class="button">View Order Details</a>
  {{/with}}
`;

const orderConfirmationTemplate = `
  ${baseTemplate}
  {{#with data}}
  <h2>Order Confirmation</h2>
  <p>Dear {{clientName}},</p>
  <p>Your order has been confirmed:</p>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Order ID:</strong> {{orderId}}</p>
    <p><strong>Total Amount:</strong> $\{{formatPrice totalAmount}}</p>
  </div>
  {{/with}}
`;

export const orderTemplates = {
  orderCreation: {
    en: compile(orderCreationTemplateEn),
    // Add other locales as needed
  },
  orderStatusUpdate: {
    en: compile(orderStatusTemplateEn),
    // Add other locales as needed
  },
  orderConfirmation: {
    en: compile(orderConfirmationTemplate),
    // Add other locales as needed
  },
};