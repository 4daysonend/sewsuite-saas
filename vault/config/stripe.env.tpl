STRIPE_SECRET_KEY={{ with secret "sewsuite/backend/stripe" }}{{ .Data.data.STRIPE_SECRET_KEY }}{{ end }}
STRIPE_WEBHOOK_SECRET={{ with secret "sewsuite/backend/stripe" }}{{ .Data.data.STRIPE_WEBHOOK_SECRET }}{{ end }}
STRIPE_PUBLISHABLE_KEY={{ with secret "sewsuite/backend/stripe" }}{{ .Data.data.STRIPE_PUBLISHABLE_KEY }}{{ end }}