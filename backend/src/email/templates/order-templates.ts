import { compile } from 'handlebars';
import { baseTemplate } from './base.template';

export const orderTemplates = {
  orderCreation: compile(`
    ${baseTemplate}
    {{#with data}}
    <h2>Order Confirmation</h2>
    <p>Dear {{clientName}},</p>
    <p>Your order has been successfully created. Here are the details:</p>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Order ID:</strong> {{orderId}}</p>
      <p><strong>Tailor:</strong> {{tailorName}}</p>
      <p><strong>Total Amount:</strong> ${{formatPrice totalAmount}}</p>
      <p><strong>Status:</strong> {{status}}</p>
    </div>
    <p>Your tailor will review your order and begin work soon.</p>
    <a href="{{orderUrl}}" class="button">View Order Details</a>
    {{/with}}
  `),

  orderStatusUpdate: compile(`
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
  `),

  fittingReminder: compile(`
    ${baseTemplate}
    {{#with data}}
    <h2>Fitting Appointment Reminder</h2>
    <p>Dear {{clientName}},</p>
    <p>This is a reminder for your upcoming fitting appointment:</p>
    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Order ID:</strong> {{orderId}}</p>
      <p><strong>Date:</strong> {{formatDate fittingDate}}</p>
      <p><strong>Time:</strong> {{formatTime fittingTime}}</p>
      <p><strong>Location:</strong> {{location}}</p>
    </div>
    <div style="margin: 20px 0;">
      <p><strong>Preparation Tips:</strong></p>
      <ul>
        <li>Please arrive 5-10 minutes early</li>
        <li>Wear appropriate undergarments</li>
        <li>Bring the shoes you plan to wear with the garment</li>
      </ul>
    </div>
    <a href="{{calendarUrl}}" class="button">Add to Calendar</a>
    {{/with}}
  `)
};