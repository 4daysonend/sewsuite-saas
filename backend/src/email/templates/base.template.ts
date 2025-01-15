export const baseTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --primary-color: #2563eb;
      --text-color: #1f2937;
      --background-color: #ffffff;
      --accent-color: #3b82f6;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      background: var(--background-color);
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      padding: 20px 0;
      background: var(--primary-color);
      color: white;
    }
    
    .content {
      padding: 20px;
      background: white;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 0.875rem;
      color: #6b7280;
    }
    
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: var(--accent-color);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{header}}</h1>
    </div>
    <div class="content">
      {{content}}
    </div>
    <div class="footer">
      {{footer}}
      <p>© {{year}} Tailor Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
