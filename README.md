# Function ProcessPayment

Azure Function para procesar confirmaciones de pago y entregar contenido - Bartolo Profe App

## 📋 Descripción

Function serverless que:
- ✅ Recibe webhooks de Mercado Pago (confirmación pago)
- ✅ Actualiza estado de venta en Airtable
- ✅ Envía email con contenido premium
- ✅ Comparte carpeta Google Drive con el cliente
- ✅ Marca venta como "entregada"

## 🚀 Stack

- **Runtime**: Node.js 20
- **Trigger**: HTTP POST (Webhook)
- **Dependencias**:
  - `airtable` - Cliente Airtable API
  - `nodemailer` - Envío de emails
  - `googleapis` - Google Drive API

## 🔐 Variables de Entorno (Key Vault)

- `KEY_VAULT_AIRTABLE_API_KEY`
- `KEY_VAULT_AIRTABLE_BASE_ID`
- `KEY_VAULT_SMTP_SERVER`
- `KEY_VAULT_SMTP_USERNAME`
- `KEY_VAULT_SMTP_PASSWORD`
- `KEY_VAULT_GOOGLE_SERVICE_ACCOUNT_KEY`

## 📍 Endpoint

```
POST /api/ProcessPayment?ventaid={venta_id}
```

### Request Body (Mercado Pago Webhook)

```json
{
  "external_reference": "recYYYYYYYYYYYYYY"
}
```

### Response

```json
{
  "success": true,
  "venta_id": "recYYYYYYYYYYYYYY"
}
```

## 🧪 Testing Local

```bash
# Instalar dependencias
npm install

# Ejecutar localmente
npm start

# Probar
curl -X POST "http://localhost:7071/api/ProcessPayment?ventaid=recYYY"
```

## 🔗 Configurar Webhook Mercado Pago

1. Ir a [Mercado Pago Webhooks](https://www.mercadopago.com.ar/developers/panel/webhooks)
2. Crear webhook:
   - **URL**: `https://func-bartolo-profe-app-process-payment-dev.azurewebsites.net/api/ProcessPayment?code={function_key}`
   - **Evento**: `payment`

## 🚢 Deploy

### Automático con GitHub Actions

Push a `main` → Deploy automático

### Manual con Azure CLI

```bash
func azure functionapp publish func-bartolo-profe-app-process-payment-dev
```

## 📊 CI/CD

GitHub Actions workflow en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

**Secrets requeridos**:
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`

## 📁 Estructura

```
function-process-payment/
├── index.js              # Lógica principal
├── function.json         # Configuración trigger
├── package.json          # Dependencias
├── host.json            # Config global
├── .gitignore
└── .github/
    └── workflows/
        └── deploy.yml   # CI/CD pipeline
```

## 🔗 Repositorios relacionados

- [terraform](../terraform) - Infraestructura IaC
- [function-process-sale](../function-process-sale) - Procesamiento de ventas
