// Integra las preferencias, consultas y webhooks de Mercado Pago.

import {
  MercadoPagoConfig,
  Preference,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from "mercadopago";
import { ConfiguracionEntorno } from "../../Configuracion/ConfiguracionEntorno.js";
import { ErrorAplicacion } from "../../Dominio/Errores.js";
export class ClienteMercadoPago {
  constructor(C = ConfiguracionEntorno) {
    this.Configuracion = C;
    this.Cliente = C.MercadoPagoAccessToken
      ? new MercadoPagoConfig({
          accessToken: C.MercadoPagoAccessToken,
          options: { timeout: 8000 },
        })
      : null;
  }
  EstaConfigurado() {
    return Boolean(this.Cliente);
  }
  // Crea una preferencia real o una respuesta de demostración.
  async CrearPreferencia(D) {
    if (!this.Cliente)
      return {
        Modo: "DEMOSTRACION",
        ReferenciaExterna: `DEMO-${D.PagoId}`,
        UrlPago: null,
      };
    const UrlRetorno = this.Configuracion.MercadoPagoUrlRetorno;
    const EsUrlPublica = UrlRetorno && !UrlRetorno.includes("localhost");
    const P = new Preference(this.Cliente),
      R = await P.create({
        body: {
          items: [
            {
              id: String(D.SolicitudId),
              title: "Tasa de licencia de funcionamiento",
              quantity: 1,
              currency_id: "PEN",
              unit_price: Number(D.MontoCobrado),
            },
          ],
          external_reference: String(D.PagoId),
          ...(EsUrlPublica ? { notification_url: `${this.Configuracion.UrlPublicaServidor}/api/pagos/webhook` } : {}),
          back_urls: {
            success: UrlRetorno,
            pending: UrlRetorno,
            failure: UrlRetorno,
          },
          ...(EsUrlPublica ? { auto_return: "approved" } : {}),
        },
      });
    return {
      Modo: "MERCADOPAGO",
      ReferenciaExterna: String(R.id),
      UrlPago: R.init_point,
    };
  }
  // Comprueba la clave antes de aceptar la notificación.
  ValidarFirmaWebhook(D) {
    if (!this.Configuracion.MercadoPagoClaveWebhook) {
      if (this.Configuracion.ModoDemostracion) return true;
      throw new ErrorAplicacion(
        "La clave del webhook no está configurada.",
        "WEBHOOK_SIN_CLAVE",
        503,
      );
    }
    try {
      WebhookSignatureValidator.validate({
        xSignature: D.Firma,
        xRequestId: D.IdSolicitud,
        dataId: String(D.IdDato || ""),
        secret: this.Configuracion.MercadoPagoClaveWebhook,
      });
      return true;
    } catch (E) {
      if (E instanceof InvalidWebhookSignatureError)
        throw new ErrorAplicacion(
          "La firma del webhook no es válida.",
          "FIRMA_WEBHOOK_INVALIDA",
          401,
        );
      throw E;
    }
  }
  // Consulta el estado definitivo informado por Mercado Pago.
  async ConsultarPago(Id) {
    if (!this.Cliente)
      throw new ErrorAplicacion(
        "Mercado Pago no está configurado.",
        "MERCADOPAGO_NO_CONFIGURADO",
        503,
      );
    return new Payment(this.Cliente).get({ id: Id });
  }
}