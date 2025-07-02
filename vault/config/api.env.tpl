API_KEY={{ with secret "sewsuite/backend/api" }}{{ .Data.data.API_KEY }}{{ end }}
FRONTEND_URL={{ with secret "sewsuite/backend/api" }}{{ .Data.data.FRONTEND_URL }}{{ end }}
EMAIL_SERVICE_API_KEY={{ with secret "sewsuite/backend/api" }}{{ .Data.data.EMAIL_SERVICE_API_KEY }}{{ end }}