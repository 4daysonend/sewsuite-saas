const paymentConfirmationTemplate = `
  ${baseTemplate}
  {{#with data}}
  <h2>Payment Confirmation</h2>
  <p>Dear {{clientName}},</p>
  <p>Your payment has been successfully processed:</p>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Amount Paid:</strong> $\{{formatPrice amount}}</p>
    <p><strong>Transaction ID:</strong> {{transactionId}}</p>
    <p><strong>Date:</strong> {{formatDate paymentDate}}</p>
  </div>
  {{/with}}
`;

const paymentFailedTemplate = `
  ${baseTemplate}
  {{#with data}}
  <h2>Payment Failed</h2>
  <p>Dear {{clientName}},</p>
  <p>We were unable to process your payment:</p>
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Amount:</strong> $\{{formatPrice amount}}</p>
    <p><strong>Reason:</strong> {{failureReason}}</p>
  </div>
  {{/with}}
`;

export const paymentTemplates = {
  paymentConfirmation: compile(paymentConfirmationTemplate),
  paymentFailed: compile(paymentFailedTemplate)
};