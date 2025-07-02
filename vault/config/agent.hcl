# vault/config/agent.hcl - Vault Agent configuration
pid_file = "/tmp/vault-agent.pid"
exit_after_auth = false

auto_auth {
  method {
    type = "approle"
    config = {
      role_id_env = "VAULT_ROLE_ID"
      secret_id_env = "VAULT_SECRET_ID"
      remove_secret_id_file_after_reading = false
    }
  }

  # Write the token to a file that can be read by the application
  sink {
    type = "file"
    config = {
      path = "/vault/token/token"
      mode = 0644
    }
  }
}

# Cache configurations
cache {
  use_auto_auth_token = true
}

# Template configurations for database secrets
template {
  source = "/vault/config/database.env.tpl"
  destination = "/vault/token/database.env"
  perms = 0644
  create_dest_dirs = true

  # Vault agent will keep checking for changes to the secret
  # and update the file when needed
  wait {
    min = "5s"
    max = "30s"
  }
}

# Template configurations for Stripe secrets
template {
  source = "/vault/config/stripe.env.tpl"
  destination = "/vault/token/stripe.env"
  perms = 0644
  create_dest_dirs = true
  
  wait {
    min = "5s"
    max = "30s"
  }
}

# Template for JWT secrets
template {
  source = "/vault/config/jwt.env.tpl"
  destination = "/vault/token/jwt.env"
  perms = 0644
  create_dest_dirs = true
  
  wait {
    min = "5s"
    max = "30s"
  }
}

# Add any additional template blocks for other secret categories
# For example: email configuration, API keys, etc.
template {
  source = "/vault/config/api.env.tpl"
  destination = "/vault/token/api.env"
  perms = 0644
  create_dest_dirs = true
  
  wait {
    min = "5s"
    max = "30s"
  }
}

# Vault agent telemetry for monitoring
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname = true
}