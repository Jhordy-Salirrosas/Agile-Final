// Muestra el estado actualizado de un expediente.

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Boton from "../Componentes/Boton.jsx";
import CampoFormulario from "../Componentes/CampoFormulario.jsx";
import Estado from "../Componentes/Estado.jsx";
import Mensaje from "../Componentes/Mensaje.jsx";
import Panel from "../Componentes/Panel.jsx";
import Tabla from "../Componentes/Tabla.jsx";
import TituloPagina from "../Componentes/TituloPagina.jsx";
import {
  ConsultarSeguimiento,
  DescargarConstancia,
  DescargarLicencia,
} from "../Servicios/ServicioSolicitudes.js";

function AbrirDocumento(Datos) {
  const Url = Datos?.Url || Datos?.url;
  if (Url) window.open(Url, "_blank", "noopener,noreferrer");
}

export default function PaginaSeguimiento() {
  const [Parametros] = useSearchParams();
  const [Codigo, setCodigo] = useState(Parametros.get("Codigo") || "");
  const [Expediente, setExpediente] = useState(null);
  const [MensajeError, setMensajeError] = useState("");
  const [Ocupado, setOcupado] = useState(false);

  // Busca el expediente mediante cualquiera de sus códigos.
  async function BuscarExpediente(Evento) {
    Evento?.preventDefault();
    setMensajeError("");

    if (!/^[A-Za-z0-9]{8,40}$/.test(Codigo.trim())) {
      setMensajeError(
        "Ingrese un código válido de entre 8 y 40 caracteres alfanuméricos.",
      );
      return;
    }

    try {
      setOcupado(true);
      setExpediente(await ConsultarSeguimiento(Codigo.trim().toUpperCase()));
    } catch (Error) {
      setExpediente(null);
      setMensajeError(Error.message);
    } finally {
      setOcupado(false);
    }
  }

  useEffect(() => {
    if (Parametros.get("Codigo")) BuscarExpediente();
    // La consulta inicial solo depende del código recibido en la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ObtenerConstancia() {
    try {
      setOcupado(true);
      AbrirDocumento(
        await DescargarConstancia(Expediente.Solicitud.id, Codigo),
      );
    } catch (Error) {
      setMensajeError(Error.message);
    } finally {
      setOcupado(false);
    }
  }

  // Solicita un enlace temporal antes de abrir el PDF.
  async function ObtenerLicencia() {
    try {
      setOcupado(true);
      const Datos = await DescargarLicencia(Expediente.Solicitud.id, Codigo);
      if (Datos?.Buffer) return;
      AbrirDocumento(Datos);
    } catch (Error) {
      setMensajeError(Error.message);
    } finally {
      setOcupado(false);
    }
  }

  const Solicitud = Expediente?.Solicitud;

  // Muestra fechas, observaciones y documentos disponibles.
  return (
    <>
      <TituloPagina
        Titulo="Revisión de proceso"
        Descripcion="Consulte el estado del expediente con el código de pago o el código de inspección."
      />

      <Panel Titulo="Buscar expediente">
        <form
          onSubmit={BuscarExpediente}
          className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <CampoFormulario
              Etiqueta="Código del expediente"
              value={Codigo}
              onChange={(Evento) =>
                setCodigo(
                  Evento.target.value
                    .replace(/[^A-Za-z0-9]/g, "")
                    .toUpperCase()
                    .slice(0, 40),
                )
              }
              maxLength={40}
              Obligatorio
            />
          </div>
          <Boton Tipo="submit" Ocupado={Ocupado}>
            Consultar proceso
          </Boton>
        </form>
      </Panel>

      <div className="mt-5">
        <Mensaje Tipo="error">{MensajeError}</Mensaje>
      </div>

      {Solicitud && (
        <div className="mt-5 space-y-5">
          <Panel Titulo="Estado del expediente">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-[#536174]">Razón social</p>
                <p className="font-semibold">{Solicitud.razon_social}</p>
              </div>
              <div>
                <p className="text-sm text-[#536174]">RUC</p>
                <p className="font-semibold">{Solicitud.ruc}</p>
              </div>
              <div>
                <p className="text-sm text-[#536174]">Código de inspección</p>
                <p className="font-mono font-semibold">
                  {Solicitud.codigo_inspeccion}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#536174]">Código de pago</p>
                <p className="font-mono font-semibold">
                  {Solicitud.codigo_pago}
                </p>
              </div>
              <div>
                <p className="mb-1 text-sm text-[#536174]">Estado</p>
                <Estado Valor={Solicitud.estado} />
              </div>
              {Expediente.DiasRestantes !== null && (
                <div>
                  <p className="text-sm text-[#536174]">
                    Días restantes de vigencia
                  </p>
                  <p className="text-2xl font-bold text-[#17365d]">
                    {Math.max(0, Expediente.DiasRestantes)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Boton
                Variante="secundario"
                onClick={ObtenerConstancia}
                Ocupado={Ocupado}
              >
                Descargar constancia de pago
              </Boton>
              {Solicitud.estado === "APROBADO" ? (
                <Boton onClick={ObtenerLicencia} Ocupado={Ocupado}>
                  Descargar licencia
                </Boton>
              ) : null}
              {Solicitud.estado === "PAGADO_PENDIENTE" && Solicitud.url_pago ? (
                <a
                  href={Solicitud.url_pago}
                  className="inline-flex items-center justify-center rounded bg-[#17365d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#122a4a] focus:outline-none focus:ring-2 focus:ring-[#17365d] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pagar ahora
                </a>
              ) : null}
            </div>
          </Panel>

          <Panel Titulo="Inspecciones programadas">
            <Tabla
              Filas={Expediente.Inspecciones}
              MensajeVacio="Todavía no existe una inspección programada."
              Columnas={[
                { Clave: "numero_visita", Titulo: "Visita" },
                {
                  Clave: "fecha_programada",
                  Titulo: "Fecha",
                  Renderizar: (Fila) =>
                    Fila.fecha_programada
                      ? String(Fila.fecha_programada).slice(0, 10)
                      : "En espera",
                },
                {
                  Clave: "hora_programada",
                  Titulo: "Hora",
                  Renderizar: (Fila) => Fila.hora_programada || "Por asignar",
                },
                {
                  Clave: "estado",
                  Titulo: "Estado",
                  Renderizar: (Fila) => <Estado Valor={Fila.estado} />,
                },
                {
                  Clave: "observaciones",
                  Titulo: "Observaciones",
                  Renderizar: (Fila) =>
                    Fila.observaciones || "Sin observaciones",
                },
              ]}
            />
          </Panel>
        </div>
      )}
    </>
  );
}