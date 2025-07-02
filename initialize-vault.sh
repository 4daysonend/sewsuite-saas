#!/bin/bash
# initialize-vault.sh - Script to initialize and configure Vault

# Wait for Vault to start
echo "Waiting for Vault to start..."
sleep 10

# Initialize Vault if it's not initialized already
INITIALIZED=$(vault status -format=json | jq -r '.initialized')
if [ "$INITIALIZED" == "false" ]; then
  echo "Initializing Vault..."
  vault operator init -key-shares=3 -key-threshold=2 > /vault/data/init.txt
  
  # Display the keys and token (for development - secure these in production!)
  echo "Vault initialized! Root token and unseal keys:"
  cat /vault/data/init.txt
  
  # Extract keys for unsealing
  UNSEAL_KEY1=$(grep 'Unseal Key 1' /vault/data/init.txt | awk '{print $NF}')
  UNSEAL_KEY2=$(grep 'Unseal Key 2' /vault/data/init.txt | awk '{print $NF}')
  
  # Unseal Vault
  echo "Unsealing Vault..."
  vault operator unseal $UNSEAL_KEY1
  vault operator unseal $UNSEAL_KEY2
  
  # Extract root token and log in
  ROOT_TOKEN=$(grep 'Initial Root Token' /vault/data/init.txt | awk '{print $NF}')
  echo "Logging in with root token..."
  vault login $ROOT_TOKEN
  
  # Set up secrets engines
  echo "Enabling secrets engines..."
  vault secrets enable -path=sewsuite kv-v2
  
  # Create policies
  echo "Creating policies..."
  
  # Backend policy
  cat > backend-policy.hcl <<EOF
  path "sewsuite/data/backend/*" {
    capabilities = ["read", "list"]
  }
  EOF
  
  vault policy write backend-policy backend-policy.hcl
  
  # Create AppRole auth method
  echo "Enabling AppRole authentication..."
  vault auth enable approle
  
  # Create backend role
  vault write auth/approle/role/backend-role \
    secret_id_ttl=0 \
    token_num_uses=0 \
    token_ttl=1h \
    token_max_ttl=24h \
    policies=backend-policy
  
  # Get role ID and secret ID
  ROLE_ID=$(vault read -format=json auth/approle/role/backend-role/role-id | jq -r .data.role_id)
  SECRET_ID=$(vault write -format=json -f auth/approle/role/backend-role/secret-id | jq -r .data.secret_id)
  
  # Store credentials for the application
  echo "Storing role ID and secret ID..."
  echo "VAULT_ROLE_ID=$ROLE_ID" > /vault/data/backend-credentials.env
  echo "VAULT_SECRET_ID=$SECRET_ID" >> /vault/data/backend-credentials.env
  
  # Store application secrets
  echo "Storing application secrets..."
  vault kv put sewsuite/backend/database \
    DB_HOST="postgres" \
    DB_PORT="5432" \
    DB_USER="${POSTGRES_USER}" \
    DB_PASSWORD="${POSTGRES_PASSWORD}" \
    DB_NAME="${POSTGRES_DB}"
    
  vault kv put sewsuite/backend/stripe \
    STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
    STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}" \
    STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}"
    
  echo "Vault setup complete!"
else
  echo "Vault is already initialized."
  
  # Vault is initialized but may be sealed
  SEALED=$(vault status -format=json | jq -r '.sealed')
  if [ "$SEALED" == "true" ]; then
    echo "Vault is sealed. Please unseal manually:"
    echo "$ vault operator unseal <unseal-key-1>"
    echo "$ vault operator unseal <unseal-key-2>"
  else
    echo "Vault is already unsealed and ready to use."
  fi
fi