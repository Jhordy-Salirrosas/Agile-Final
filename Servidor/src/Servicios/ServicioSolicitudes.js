// Aplica las reglas de solicitud, plano y seguimiento.

import { Constantes } from "../Configuracion/Constantes.js";
import { EstadosSolicitud } from "../Dominio/EstadosSolicitud.js";
import { TiposSolicitud } from "../Dominio/TiposSolicitud.js";
import {
  ErrorAplicacion,
  ErrorConflicto,
  ErrorNoEncontrado,
} from "../Dominio/Errores.js";
import {
  GenerarCodigoAleatorio,
  GenerarCodigoPago,
} from "../Utilidades/Codigos.js";
import { ValidarCorreoNoDesechable } from "../Validadores/ValidarCorreoDesechable.js";
import { DiasRestantes } from "../Utilidades/Fechas.js";
export class ServicioSolicitudes {
  constructor(Dependencias) {
    Object.assign(this, Dependencias);
  }
  // Consulta el negocio y su última licencia conocida.
  async ConsultarRuc(Ruc) {
    const DatosRuc = await this.ClienteCodart.ConsultarRuc(Ruc);
    const Licencia = await this.RepositorioLicencias.BuscarUltimaPorRuc(Ruc);
    return {
      ...DatosRuc,
      EsActivo: String(DatosRuc.Estado).toUpperCase() === "ACTIVO",
      PerteneceATrujillo: DatosRuc.Ubigeo === Constantes.UbigeoPermitido,
      Licencia: Licencia
        ? {
            Id: Licencia.id,
            NumeroLicencia: Licencia.numero_licencia,
            FechaGeneracion: Licencia.fecha_generacion,
            FechaVencimiento: Licencia.fecha_vencimiento,
            DiasRestantes: DiasRestantes(Licencia.fecha_vencimiento),
            Estado:
              new Date(Licencia.fecha_vencimiento) >= new Date()
                ? "ACTIVA"
                : "VENCIDA",
          }
        : null,
    };
  }
  // Valida el RUC y evita trámites duplicados.
  async CrearSolicitud(Datos, Usuario = null) {
    ValidarCorreoNoDesechable(Datos.Correo);
    const DatosRuc = await this.ClienteCodart.ConsultarRuc(Datos.Ruc);
    if (String(DatosRuc.Estado).toUpperCase() !== "ACTIVO")
      throw new ErrorAplicacion(
        "El contribuyente debe encontrarse en estado ACTIVO.",
        "RUC_NO_ACTIVO",
        400,
      );
    if (DatosRuc.Ubigeo !== Constantes.UbigeoPermitido)
      throw new ErrorAplicacion(
        `El domicilio fiscal debe pertenecer al ubigeo ${Constantes.UbigeoPermitido}.`,
        "UBIGEO_NO_PERMITIDO",
        400,
      );
    const LicenciaActual = await this.RepositorioLicencias.BuscarUltimaPorRuc(
      Datos.Ruc,
    );
    if (
      Datos.Tipo === TiposSolicitud.Nueva &&
      LicenciaActual &&
      !Datos.OpcionRenovacion
    )
      throw new ErrorConflicto(
        "El RUC ya posee una licencia aprobada. Debe utilizar el panel de renovación.",
      );
    if (Datos.Tipo === TiposSolicitud.Renovacion && !LicenciaActual)
      throw new ErrorAplicacion(
        "No existe una licencia anterior para renovar.",
        "LICENCIA_NO_EXISTE",
        400,
      );
    const NegocioExistente = await this.RepositorioNegocios.BuscarPorRuc(
      Datos.Ruc,
    );
    if (NegocioExistente) {
      const TramitePendiente = await this.RepositorioSolicitudes.BuscarPendientePorNegocio(
        NegocioExistente.id,
      );
      if (TramitePendiente) {
        if (TramitePendiente.estado === EstadosSolicitud.PagadoPendiente) {
          // El usuario abandonó el trámite anterior antes de pagar. Lo cancelamos (RECHAZADO).
          await this.RepositorioSolicitudes.ActualizarEstado(
            TramitePendiente.id,
            EstadosSolicitud.Rechazado,
          );
        } else {
          // El trámite ya está en proceso en la municipalidad.
          throw new ErrorConflicto("Ya existe un trámite en proceso para este RUC.");
        }
      }
    }
    const Negocio = await this.RepositorioNegocios.CrearOActualizar({
      Ruc: Datos.Ruc,
      RazonSocial: DatosRuc.RazonSocial,
      DomicilioFiscal: DatosRuc.DomicilioFiscal,
      Ubigeo: DatosRuc.Ubigeo,
      Correo: Datos.Correo,
    });
    // Genera un código que no exista en otra solicitud.
    let CodigoInspeccion;
    do {
      CodigoInspeccion = GenerarCodigoAleatorio(
        Constantes.LongitudCodigoInspeccion,
      );
    } while (
      await this.RepositorioSolicitudes.ContarCodigoInspeccion(CodigoInspeccion)
    );
    const Solicitud = await this.RepositorioSolicitudes.Crear({
      NegocioId: Negocio.id,
      Tipo: Datos.Tipo,
      OpcionRenovacion: Datos.OpcionRenovacion,
      Origen: Datos.Origen,
      Estado: EstadosSolicitud.PagadoPendiente,
      CodigoPago: GenerarCodigoPago(),
      CodigoInspeccion,
      MontoOficial: Constantes.MontoOficial,
    });
    await this.ServicioAuditoria.Registrar(
      Usuario,
      "CREACION_SOLICITUD",
      "SOLICITUD",
      Solicitud.id,
      { Ruc: Datos.Ruc, Tipo: Datos.Tipo },
    );
    return { ...Solicitud, negocio: Negocio };
  }
  // Aplica formatos distintos para ciudadano y cajera.
  async GuardarPlano(SolicitudId, Archivo, EsCajera) {
    const Solicitud =
      await this.RepositorioSolicitudes.BuscarPorId(SolicitudId);
    if (!Solicitud) throw new ErrorNoEncontrado("No se encontró la solicitud.");
    if (
      Solicitud.tipo === TiposSolicitud.Renovacion &&
      Solicitud.opcion_renovacion === "PAGO_DIRECTO"
    )
      throw new ErrorAplicacion(
        "La renovación por pago directo no permite subir un plano.",
        "PLANO_NO_PERMITIDO",
        400,
      );
    const Permitidos = EsCajera
      ? ["application/pdf", "image/jpeg", "image/png"]
      : ["application/pdf"];
    if (!Permitidos.includes(Archivo.TipoDetectado))
      throw new ErrorAplicacion(
        EsCajera
          ? "La cajera solo puede subir PDF, JPG o PNG."
          : "El ciudadano solo puede subir el plano en formato PDF.",
        "TIPO_ARCHIVO_INVALIDO",
        400,
      );
    const Maximo = Number(
      await this.RepositorioConfiguracion.ObtenerValor(
        "TamanoMaximoPlanoMb",
        Constantes.TamanoPlanoPredeterminadoMb,
      ),
    );
    if (Archivo.Buffer.length > Maximo * 1024 * 1024)
      throw new ErrorAplicacion(
        `El plano supera el tamaño máximo permitido de ${Maximo} MB.`,
        "ARCHIVO_DEMASIADO_GRANDE",
        400,
      );
    const Extension =
      Archivo.TipoDetectado === "application/pdf"
        ? "pdf"
        : Archivo.TipoDetectado === "image/png"
          ? "png"
          : "jpg";
    const Ruta = await this.AlmacenArchivos.Subir(
      Archivo.Buffer,
      `planos/${Solicitud.codigo_inspeccion}/PlanoLocal.${Extension}`,
      Archivo.TipoDetectado,
    );
    await this.RepositorioSolicitudes.ActualizarPlano(
      SolicitudId,
      Ruta,
      Archivo.TipoDetectado,
    );
    return {
      Mensaje: "El plano se guardó correctamente.",
      Ruta,
      Tipo: Archivo.TipoDetectado,
    };
  }
  // Reúne la solicitud, visitas y vigencia en una sola respuesta.
  async ConsultarSeguimiento(Codigo) {
    const Solicitud = await this.RepositorioSolicitudes.BuscarPorCodigo(Codigo);
    if (!Solicitud)
      throw new ErrorNoEncontrado(
        "No se encontró un expediente con el código ingresado.",
      );
    const Todas = await this.RepositorioInspecciones.Listar({});
    return {
      Solicitud,
      Inspecciones: Todas.filter(
        (I) => Number(I.solicitud_id) === Number(Solicitud.id),
      ),
      DiasRestantes: Solicitud.fecha_vencimiento
        ? DiasRestantes(Solicitud.fecha_vencimiento)
        : null,
    };
  }
}