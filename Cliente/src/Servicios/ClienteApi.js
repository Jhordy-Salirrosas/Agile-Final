// Centraliza las peticiones HTTP y el manejo común de respuestas.

import { ConfiguracionAplicacion } from "../Configuracion/ConfiguracionAplicacion.js";

function ObtenerToken() {
  return localStorage.getItem("TokenSgl") || "";
}

function CrearEncabezados(EsFormulario) {
  const Encabezados = {};
  const Token = ObtenerToken();

  if (!EsFormulario) Encabezados["Content-Type"] = "application/json";
  if (Token) Encabezados.Authorization = `Bearer ${Token}`;

  return Encabezados;
}

async function InterpretarRespuesta(Respuesta) {
  const TipoContenido = Respuesta.headers.get("content-type") || "";
  const Cuerpo = TipoContenido.includes("application/json")
    ? await Respuesta.json()
    : await Respuesta.text();

  if (!Respuesta.ok) {
    const Excepcion = new Error(
      Cuerpo?.Mensaje || "No se pudo completar la operación.",
    );
    Excepcion.Codigo = Cuerpo?.Codigo || "ERROR_API";
    Excepcion.Detalles = Cuerpo?.Detalles || null;
    Excepcion.EstadoHttp = Respuesta.status;
    throw Excepcion;
  }

  return Cuerpo?.Datos ?? Cuerpo;
}

// Agrega el token y unifica los errores del servidor.
export async function SolicitarApi(Ruta, Opciones = {}) {
  const EsFormulario = Opciones.body instanceof FormData;
  const Respuesta = await fetch(`${ConfiguracionAplicacion.UrlApi}${Ruta}`, {
    ...Opciones,
    headers: {
      ...CrearEncabezados(EsFormulario),
      ...(Opciones.headers || {}),
    },
  });

  return InterpretarRespuesta(Respuesta);
}

export function ObtenerUrlApi(Ruta) {
  return `${ConfiguracionAplicacion.UrlApi}${Ruta}`;
}