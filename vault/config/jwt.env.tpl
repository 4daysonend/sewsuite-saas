JWT_SECRET={{ with secret "sewsuite/backend/jwt" }}{{ .Data.data.JWT_SECRET }}{{ end }}
JWT_REFRESH_SECRET={{ with secret "sewsuite/backend/jwt" }}{{ .Data.data.JWT_REFRESH_SECRET }}{{ end }}
JWT_EXPIRATION={{ with secret "sewsuite/backend/jwt" }}{{ .Data.data.JWT_EXPIRATION }}{{ end }}
JWT_REFRESH_EXPIRATION={{ with secret "sewsuite/backend/jwt" }}{{ .Data.data.JWT_REFRESH_EXPIRATION }}{{ end }}