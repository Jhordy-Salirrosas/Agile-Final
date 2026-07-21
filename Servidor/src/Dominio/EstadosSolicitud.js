// Define los estados y transiciones válidas de una solicitud.

import { ErrorAplicacion } from "./Errores.js";
export const EstadosSolicitud = Object.freeze({
  PagadoPendiente: "PAGADO_PENDIENTE",
  EnProceso: "EN_PROCESO",
  InspeccionadoObservaciones: "INSPECCIONADO_OBSERVACIONES",
  Rechazado: "RECHAZADO",
  Aprobado: "APROBADO",
});
// Enumera los únicos cambios de estado permitidos.
const Transiciones = {
  PAGADO_PENDIENTE: ["EN_PROCESO", "APROBADO", "RECHAZADO"],
  EN_PROCESO: ["INSPECCIONADO_OBSERVACIONES", "APROBADO"],
  INSPECCIONADO_OBSERVACIONES: ["APROBADO", "RECHAZADO"],
  RECHAZADO: [],
  APROBADO: [],
};
// Rechaza cualquier transición fuera del flujo definido.
export function ValidarTransicionSolicitud(Actual, Nuevo) {
  if (!Transiciones[Actual]?.includes(Nuevo))
    throw new ErrorAplicacion(
      `No se puede cambiar una solicitud de ${Actual} a ${Nuevo}.`,
      "TRANSICION_SOLICITUD_INVALIDA",
      409,
    );
}