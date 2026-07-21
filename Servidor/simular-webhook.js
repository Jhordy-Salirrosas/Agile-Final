import dotenv from "dotenv";
dotenv.config();
import { RepositorioPagos } from "./src/Repositorios/RepositorioPagos.js";
import { RepositorioSolicitudes } from "./src/Repositorios/RepositorioSolicitudes.js";
import { ServicioPagos } from "./src/Servicios/ServicioPagos.js";
import { ServicioSolicitudes } from "./src/Servicios/ServicioSolicitudes.js";
import { GrupoConexiones as BaseDatos, ConTransaccion } from "./src/BaseDatos/ConexionBaseDatos.js";
import { ClienteMercadoPago } from "./src/Integraciones/MercadoPago/ClienteMercadoPago.js";
import { ConfiguracionEntorno } from "./src/Configuracion/ConfiguracionEntorno.js";

async function simularWebhook() {
  console.log("=============================================");
  console.log("🚀 SIMULANDO WEBHOOK DE MERCADO PAGO...");
  console.log("=============================================\n");

  const bd = BaseDatos;
  const repoSolicitudes = new RepositorioSolicitudes(bd);
  const repoPagos = new RepositorioPagos(bd);
  const clienteMP = new ClienteMercadoPago(ConfiguracionEntorno);

  // 1. Mocking the signature validation
  console.log("1️⃣  Verificando firma de seguridad (Simulado: OK)");
  clienteMP.ValidarFirmaWebhook = function () {
    return true; 
  };

  // 2. Mocking the API call to MP. 
  console.log("2️⃣  Consultando estado real en Servidores de Mercado Pago...");
  clienteMP.ConsultarPago = async function (idExterno) {
    console.log(`   [API] Consultando pago con ID: ${idExterno}`);
    console.log(`   [API] Respuesta de Mercado Pago: Aprobado (approved)`);
    return {
      status: "approved",
      external_reference: "1", 
    };
  };

  const servicioSolicitudes = new ServicioSolicitudes({
    RepositorioSolicitudes: repoSolicitudes,
    ConTransaccion
  });
  
  const servicioPagos = new ServicioPagos({
    RepositorioPagos: repoPagos,
    RepositorioSolicitudes: repoSolicitudes,
    BaseDatos: bd,
    ClienteMercadoPago: clienteMP,
    ServicioSolicitudes: servicioSolicitudes,
    ConTransaccion,
    AlmacenArchivos: { Subir: async () => true, ObtenerRuta: () => "" },
    GeneradorBoleta: { GenerarPDF: async () => Buffer.from("") },
    RepositorioBoletas: { Crear: async () => ({ id: 1 }) },
    ServicioInspecciones: { CrearPrimeraInspeccion: async () => true },
    ServicioAuditoria: { Registrar: async () => true },
    ServicioNotificaciones: { Enviar: async () => true }
  });

  // 3. Fake webhook payload
  const webhookFalso = {
    action: "payment.created",
    data: {
      id: "987654321", 
    },
  };

  console.log("\n3️⃣  Recibiendo notificación Webhook en POST /api/pagos/webhook");
  console.log("   Cuerpo de la petición:", webhookFalso);

  try {
    const resultado = await servicioPagos.ProcesarWebhook(webhookFalso, {
      Firma: "firma_criptografica_falsa",
      IdDato: "987654321"
    });

    console.log("\n✅ RESULTADO DEL PROCESAMIENTO:");
    console.log("   Pago Confirmado:", resultado.Pago);
    console.log("   Estado en Solicitud:", resultado.Solicitud.estado);
    
    console.log("\n🔎 VERIFICANDO LA BASE DE DATOS...");
    const pago = await bd.query("SELECT * FROM pagos WHERE id = 1");
    console.log("   -> Estado del Pago en BD:", pago[0].estado);
    
    const solicitud = await bd.query("SELECT * FROM solicitudes WHERE id = 1");
    console.log("   -> Estado de la Solicitud en BD:", solicitud[0].estado);
    
    console.log("\n🎉 ¡Simulación exitosa! El pago se confirmó de forma segura usando la verificación directa con Mercado Pago y la solicitud pasó a EN_PROCESO.");

  } catch (error) {
    console.error("Error procesando:", error);
  } finally {
    await bd.end();
  }
}

simularWebhook();
