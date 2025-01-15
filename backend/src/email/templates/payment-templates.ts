export const paymentTemplates = {
    paymentConfirmation: compile(`
      ${baseTemplate}
      {{#with data}}
      <h2>Payment Confirmation</h2>
      <p>Dear {{clientName}},</p>
      <p>Your payment has been successfully processed:</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Order ID:</strong> {{orderId}}</p>
        <p><strong>Amount Paid:</strong> ${{formatPrice amount}}</p>
        <p><strong>Transaction ID:</strong> {{transactionId}}</p>
        <p><strong>Date:</strong> {{formatDate paymentDate}}</p>
      </div>
      <p>Your payment receipt has been attached to this email.</p>
      <a href="{{orderUrl}}" class="button">View Order Details</a>
      {{/with}}
    `),
  
    paymentFailed: compile(`
      ${baseTemplate}
      {{#with data}}
      <h2>Payment Failed</h2>
      <p>Dear {{clientName}},</p>
      <p>We were unable to process your payment for the following order:</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Order ID:</strong> {{orderId}}</p>
        <p><strong>Amount:</strong> ${{formatPrice amount}}</p>
        <p><strong>Reason:</strong> {{failureReason}}</p>
      </div>
      <p>Please update your payment information or try again with a different payment method.</p>
      <a href="{{paymentUrl}}" class="button">Update Payment</a>
      {{/with}}
    `)
  };
  