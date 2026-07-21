// Consulta y modifica solicitudes de licencia.

export class RepositorioSolicitudes {
  constructor(BaseDatos) {
    this.BaseDatos = BaseDatos;
  }
  async Crear(D, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      `INSERT INTO solicitudes(negocio_id,tipo,opcion_renovacion,origen,estado,codigo_pago,codigo_inspeccion,monto_oficial) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        D.NegocioId,
        D.Tipo,
        D.OpcionRenovacion || null,
        D.Origen,
        D.Estado,
        D.CodigoPago,
        D.CodigoInspeccion,
        D.MontoOficial,
      ],
    );
    return R.rows[0];
  }
  async BuscarPorId(Id, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      `SELECT s.*,n.ruc,n.razon_social,n.domicilio_fiscal,n.ubigeo,n.correo FROM solicitudes s JOIN negocios n ON n.id=s.negocio_id WHERE s.id=$1 LIMIT 1`,
      [Id],
    );
    return R.rows[0] || null;
  }
  async BuscarPorCodigo(Codigo, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      `SELECT s.*,n.ruc,n.razon_social,n.domicilio_fiscal,n.ubigeo,n.correo,b.numero_boleta,b.ruta_archivo boleta_ruta,l.numero_licencia,l.ruta_archivo licencia_ruta,l.fecha_generacion,l.fecha_vencimiento,p.respuesta_proveedor->>'UrlPago' AS url_pago FROM solicitudes s JOIN negocios n ON n.id=s.negocio_id LEFT JOIN boletas b ON b.solicitud_id=s.id LEFT JOIN licencias l ON l.solicitud_id=s.id LEFT JOIN pagos p ON p.solicitud_id=s.id AND p.estado='PENDIENTE' WHERE UPPER(s.codigo_pago)=UPPER($1) OR UPPER(s.codigo_inspeccion)=UPPER($1) LIMIT 1`,
      [Codigo],
    );
    return R.rows[0] || null;
  }
  async BuscarPendientePorNegocio(NegocioId, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      "SELECT * FROM solicitudes WHERE negocio_id=$1 AND estado IN ('PAGADO_PENDIENTE','EN_PROCESO','INSPECCIONADO_OBSERVACIONES') ORDER BY fecha_creacion DESC LIMIT 1",
      [NegocioId],
    );
    return R.rows[0] || null;
  }
  async ActualizarPlano(Id, Ruta, Tipo, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      "UPDATE solicitudes SET plano_ruta=$2,plano_tipo=$3,fecha_actualizacion=NOW() WHERE id=$1 RETURNING *",
      [Id, Ruta, Tipo],
    );
    return R.rows[0] || null;
  }
  async ActualizarEstado(Id, Estado, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      "UPDATE solicitudes SET estado=$2,fecha_actualizacion=NOW() WHERE id=$1 RETURNING *",
      [Id, Estado],
    );
    return R.rows[0] || null;
  }
  async ContarCodigoInspeccion(Codigo, Cliente = this.BaseDatos) {
    const R = await Cliente.query(
      "SELECT COUNT(*)::int cantidad FROM solicitudes WHERE codigo_inspeccion=$1",
      [Codigo],
    );
    return R.rows[0].cantidad;
  }
}