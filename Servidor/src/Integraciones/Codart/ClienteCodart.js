// Consulta RUC y DNI mediante CODART o datos de demostración.

import { ConfiguracionEntorno } from "../../Configuracion/ConfiguracionEntorno.js";
import { ErrorAplicacion } from "../../Dominio/Errores.js";
import { RucsDemostracion, DnisDemostracion } from "./DatosDemostracion.js";
export class ClienteCodart {
  constructor(C = ConfiguracionEntorno) {
    this.Configuracion = C;
    this.Cache = new Map();
  }
  // Reutiliza consultas recientes para no gastar la cuota.
  ObtenerCache(Clave) {
    const D = this.Cache.get(Clave);
    if (!D || D.Expira < Date.now()) {
      this.Cache.delete(Clave);
      return null;
    }
    return D.Valor;
  }
  GuardarCache(Clave, Valor) {
    this.Cache.set(Clave, { Valor, Expira: Date.now() + 30 * 60 * 1000 });
    return Valor;
  }
  // Normaliza la respuesta tributaria al formato interno.
  async ConsultarRuc(Ruc) {
    const Clave = `RUC:${Ruc}`;
    const Cache = this.ObtenerCache(Clave);
    if (Cache) return Cache;
    if (RucsDemostracion[Ruc]) return this.GuardarCache(Clave, RucsDemostracion[Ruc]);
    if (!this.Configuracion.CodartToken) {
      if (RucsDemostracion[Ruc] && this.Configuracion.ModoDemostracion)
        return this.GuardarCache(Clave, RucsDemostracion[Ruc]);
      throw new ErrorAplicacion(
        "CODART no está configurado. Use un RUC de demostración o configure CODART_TOKEN.",
        "CODART_NO_CONFIGURADO",
        503,
      );
    }
    const R = await this.Consultar(
        `${this.Configuracion.CodartUrl}/sunat/ruc/${Ruc}`,
      ),
      D = R.result;
    return this.GuardarCache(Clave, {
      Ruc: D.numero_documento,
      RazonSocial: D.razon_social,
      Estado: D.estado,
      Condicion: D.condicion,
      DomicilioFiscal: D.direccion,
      Ubigeo: D.ubigeo,
      Distrito: D.distrito,
      Provincia: D.provincia,
      Departamento: D.departamento,
    });
  }
  // Normaliza la respuesta de identidad al formato interno.
  async ConsultarDni(Dni) {
    const Clave = `DNI:${Dni}`;
    const Cache = this.ObtenerCache(Clave);
    if (Cache) return Cache;
    if (!this.Configuracion.CodartToken) {
      if (DnisDemostracion[Dni] && this.Configuracion.ModoDemostracion)
        return this.GuardarCache(Clave, DnisDemostracion[Dni]);
      throw new ErrorAplicacion(
        "CODART no está configurado. Use un DNI de demostración o configure CODART_TOKEN.",
        "CODART_NO_CONFIGURADO",
        503,
      );
    }
    const R = await this.Consultar(
        `${this.Configuracion.CodartUrl}/reniec/dni/${Dni}`,
      ),
      D = R.result;
    const Fecha =
      D.birth_date && !String(D.birth_date).toLowerCase().includes("credit")
        ? D.birth_date
        : null;
    return this.GuardarCache(Clave, {
      Dni: D.document_number,
      Nombres: D.first_name,
      ApellidoPaterno: D.first_last_name,
      ApellidoMaterno: D.second_last_name,
      NombreCompleto: D.full_name,
      FechaNacimiento: Fecha,
      Edad: null,
    });
  }
  // Usa datos controlados cuando no existe un token real.
  async Consultar(Url) {
    const C = new AbortController(),
      T = setTimeout(() => C.abort(), 8000);
    try {
      const R = await fetch(Url, {
        headers: {
          Authorization: `Bearer ${this.Configuracion.CodartToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: C.signal,
      });
      const B = await R.json().catch(() => null);
      if (!R.ok || !B?.success)
        throw new ErrorAplicacion(
          B?.message || "CODART no pudo completar la consulta.",
          "ERROR_CODART",
          502,
        );
      return B;
    } catch (E) {
      if (E.name === "AbortError")
        throw new ErrorAplicacion(
          "La consulta de CODART tardó demasiado. Intente nuevamente.",
          "TIEMPO_CODART",
          504,
        );
      if (E instanceof ErrorAplicacion) throw E;
      throw new ErrorAplicacion(
        "No fue posible comunicarse con CODART.",
        "ERROR_CODART",
        502,
      );
    } finally {
      clearTimeout(T);
    }
  }
}