DB_HOST={{ with secret "sewsuite/backend/database" }}{{ .Data.data.DB_HOST }}{{ end }}
DB_PORT={{ with secret "sewsuite/backend/database" }}{{ .Data.data.DB_PORT }}{{ end }}
DB_USER={{ with secret "sewsuite/backend/database" }}{{ .Data.data.DB_USER }}{{ end }}
DB_PASSWORD={{ with secret "sewsuite/backend/database" }}{{ .Data.data.DB_PASSWORD }}{{ end }}
DB_NAME={{ with secret "sewsuite/backend/database" }}{{ .Data.data.DB_NAME }}{{ end }}