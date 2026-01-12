const Airtable = require('airtable');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// Configuración desde Key Vault (Azure App Settings)
const AIRTABLE_API_KEY = process.env.KEY_VAULT_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.KEY_VAULT_AIRTABLE_BASE_ID;
const SMTP_SERVER = process.env.KEY_VAULT_SMTP_SERVER;
const SMTP_USERNAME = process.env.KEY_VAULT_SMTP_USERNAME;
const SMTP_PASSWORD = process.env.KEY_VAULT_SMTP_PASSWORD;
const GOOGLE_SERVICE_ACCOUNT = process.env.KEY_VAULT_GOOGLE_SERVICE_ACCOUNT_KEY;

// Table IDs from n8n flows
const TABLE_IDS = {
    ventas: 'tblxIiu45LFrqw9Ky'
};

module.exports = async function (context, req) {
    context.log('ProcessPayment: Iniciando procesamiento de pago confirmado');

    try {
        // Webhook - POST :ventaid
        // El ventaId puede venir de la ruta o del body
        const ventaId = req.params?.ventaid || req.body?.ventaid || req.query?.ventaid;

        if (!ventaId) {
            context.res = {
                status: 400,
                body: 'ID de venta no proporcionado'
            };
            return;
        }

        // Conectar a Airtable
        const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

        // 1. getVenta - Obtener información completa de la venta
        let venta;
        try {
            venta = await base(TABLE_IDS.ventas).find(ventaId);
        } catch (error) {
            context.res = {
                status: 404,
                body: 'Venta no encontrada'
            };
            return;
        }

        // 2. RegistrarPago - Actualizar estado a pagado
        await base(TABLE_IDS.ventas).update(venta.id, {
            pagado: true,
            estado: 'pagado'
        });

        // Obtener datos del contenido y contacto desde campos relacionados
        const urlPremium = venta.fields['url_premium (from contenido_id)']?.[0] || '';
        const emailContacto = venta.fields['email (from contacto)']?.[0] || '';

        if (!emailContacto) {
            context.log.error('No se encontró email del contacto en la venta');
            context.res = {
                status: 400,
                body: 'Email del contacto no encontrado'
            };
            return;
        }

        // 3. Send Email Premium - Enviar email con la URL del contenido
        const emailResult = await enviarEmailPremium(emailContacto, urlPremium);

        if (!emailResult.accepted || emailResult.accepted.length === 0) {
            context.log.error('No se pudo enviar email al contacto');
            context.res = {
                status: 500,
                body: 'Error al enviar email'
            };
            return;
        }

        // 4. RegistrarEntrega - Actualizar estado a entregado
        await base(TABLE_IDS.ventas).update(venta.id, {
            estado: 'entregado'
        });

        // 5. Share folder - Compartir carpeta de Drive
        if (urlPremium && urlPremium.includes('drive.google.com')) {
            await compartirDrive(urlPremium, emailResult.accepted[0]);
        }

        context.log(`Pago procesado y contenido entregado exitosamente: ${ventaId}`);
        context.res = {
            status: 200,
            body: {
                success: true,
                venta_id: ventaId,
                entregado: true
            }
        };

    } catch (error) {
        context.log.error('Error en ProcessPayment:', error);
        context.res = {
            status: 500,
            body: {
                success: false,
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        };
    }
};

/**
 * Send Email Premium - Enviar email con URL de contenido
 * El email contiene SOLO la URL del contenido en el cuerpo HTML
 */
async function enviarEmailPremium(email, urlPremium) {
    const transporter = nodemailer.createTransport({
        host: SMTP_SERVER,
        port: 587,
        secure: false,
        auth: {
            user: SMTP_USERNAME,
            pass: SMTP_PASSWORD
        }
    });

    const result = await transporter.sendMail({
        from: SMTP_USERNAME,
        to: email,
        subject: 'Muchas gracias por consumir nuestro servicio',
        html: urlPremium // En n8n el HTML es directamente la URL
    });

    return result;
}

async function compartirDrive(driveUrl, email) {
    try {
        // Parsear Service Account JSON
        const serviceAccountInfo = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
        
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccountInfo,
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = google.drive({ version: 'v3', auth });

        // Extraer folder ID de la URL de Drive
        // Soporta URLs tipo: https://drive.google.com/drive/folders/FOLDER_ID
        let folderId;
        if (driveUrl.includes('/folders/')) {
            folderId = driveUrl.split('/folders/')[1].split('?')[0];
        } else if (driveUrl.includes('/d/')) {
            folderId = driveUrl.split('/d/')[1].split('/')[0];
        } else {
            throw new Error('URL de Drive no reconocida');
        }

        // Compartir con permisos de lectura
        await drive.permissions.create({
            fileId: folderId,
            requestBody: {
                type: 'user',
                role: 'reader',
                emailAddress: email
            },
            sendNotificationEmail: false
        });

        console.log(`Carpeta Drive compartida exitosamente con ${email}`);
    } catch (error) {
        console.error('Error compartiendo Drive:', error.message);
        throw error;
    }
}
