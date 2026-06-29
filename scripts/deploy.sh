#!/bin/bash
# deploy.sh — build + deploy this app to Azure App Service from Azure Cloud Shell.
#
# HOW TO USE (run from https://shell.azure.com, Bash mode):
#
#   1. Get the code into Cloud Shell first, e.g.:
#        git clone <your-repo-url>
#        cd SCO_Project-Deployment
#      (or upload the zip via the Cloud Shell "Upload/Download" button, then `unzip`)
#
#   2. Set the variables below (or export them before running), then:
#        chmod +x scripts/deploy.sh
#        ./scripts/deploy.sh
#
# Cloud Shell already has `az` logged in to your account and `node`/`npm`
# preinstalled, so no local machine setup is needed.

set -euo pipefail

# ── Fill these in (or export as env vars before calling this script) ──────
RESOURCE_GROUP="${RESOURCE_GROUP:-CHANGE_ME-resource-group}"
APP_NAME="${APP_NAME:-CHANGE_ME-app-service-name}"
DATABASE_URL="${DATABASE_URL:-CHANGE_ME-mysql-connection-string}"
# DATABASE_URL must include the SSL cert this script downloads below, e.g.:
#   mysql://USER:PASS@HOST:3306/DB?sslaccept=strict&sslcert=./MysqlflexGlobalRootCA.crt.pem
# (relative path works because the app's working directory at runtime is
#  the project root — the same place this script downloads the cert into.
#  Set the SAME DATABASE_URL in Azure Portal → App Service → Configuration
#  → Application settings, so the running app finds the cert at runtime too.)

echo "==> Installing dependencies"
npm ci

echo "==> Downloading MySQL Flexible Server SSL CA cert (ships with the deploy package)"
wget --trust-server-names --no-check-certificate -q \
  "https://go.microsoft.com/fwlink/?linkid=2281474" \
  -O MysqlflexGlobalRootCA.crt.pem

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Applying database migrations"
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

echo "==> Building Next.js app"
npm run build

echo "==> Removing AI assistant context files"
rm -f CLAUDE.md AGENTS.md

echo "==> Pruning devDependencies (keep the deploy package small)"
npm prune --omit=dev

echo "==> Zipping deploy package"
rm -f /tmp/deploy.zip
zip -r -q /tmp/deploy.zip . -x "scripts/*" ".git/*"

echo "==> Deploying to Azure App Service: $APP_NAME"
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src-path /tmp/deploy.zip \
  --type zip

echo "==> Done. Check: https://$APP_NAME.azurewebsites.net"
