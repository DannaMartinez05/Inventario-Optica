--
-- PostgreSQL database dump
--

\restrict p5KmYl36JBJMkFyvcjaWftiJZf0plGU9lJBvrWSzRWe3BA2ecu10NKCTXtOSEB5

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_abono_aplicar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_abono_aplicar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_modalidad VARCHAR(20);
    v_saldo NUMERIC(12,2);
BEGIN
    SELECT modalidad, saldo INTO v_modalidad, v_saldo
    FROM venta
    WHERE id_tenant = NEW.id_tenant AND id_venta = NEW.id_venta
    FOR UPDATE;

    IF v_modalidad <> 'CREDITO' THEN
        RAISE EXCEPTION 'Solo se pueden registrar abonos en ventas a crédito'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.valor > v_saldo THEN
        RAISE EXCEPTION 'El abono (%) supera el saldo pendiente (%)', NEW.valor, v_saldo
            USING ERRCODE = 'check_violation';
    END IF;

    UPDATE venta
    SET valor_pagado = valor_pagado + NEW.valor
    WHERE id_tenant = NEW.id_tenant AND id_venta = NEW.id_venta;

    RETURN NEW;
END;
$$;


--
-- Name: fn_actualizado_en(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_actualizado_en() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;


--
-- Name: fn_actualizar_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_actualizar_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tipo VARCHAR(30);
BEGIN
    SELECT tipo INTO v_tipo
    FROM movimiento
    WHERE id_tenant = NEW.id_tenant AND id_movimiento = NEW.id_movimiento;

    UPDATE producto
    SET stock = stock + CASE WHEN v_tipo IN ('ENTRADA', 'AJUSTE_POSITIVO')
                             THEN NEW.cantidad ELSE -NEW.cantidad END
    WHERE id_tenant = NEW.id_tenant AND id_producto = NEW.id_producto;

    RETURN NEW;
END;
$$;


--
-- Name: fn_bloquear_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_bloquear_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % no admite modificaciones; registre un movimiento o ajuste nuevo.', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;


--
-- Name: fn_venta_crear_movimiento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_venta_crear_movimiento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO movimiento (id_tenant, id_usuario, id_venta, tipo, observacion)
    VALUES (NEW.id_tenant, NEW.id_usuario, NEW.id_venta, 'SALIDA', 'Venta #' || NEW.id_venta);
    RETURN NEW;
END;
$$;


--
-- Name: fn_venta_detalle_aplicar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_venta_detalle_aplicar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE venta
    SET total = total + NEW.subtotal,
        valor_pagado = CASE
            WHEN modalidad = 'CONTADO'
            THEN total + NEW.subtotal
            ELSE valor_pagado
        END
    WHERE id_tenant = NEW.id_tenant
      AND id_venta = NEW.id_venta;

    IF NEW.id_producto IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM producto p
           WHERE p.id_tenant = NEW.id_tenant
             AND p.id_producto = NEW.id_producto
             AND p.tipo_producto <> 'LENTE'
       )
    THEN
        INSERT INTO detalle_movimiento (
            id_tenant,
            id_movimiento,
            id_producto,
            cantidad,
            costo_unitario
        )
        SELECT
            NEW.id_tenant,
            m.id_movimiento,
            NEW.id_producto,
            NEW.cantidad,
            NEW.costo_unitario
        FROM movimiento m
        WHERE m.id_tenant = NEW.id_tenant
          AND m.id_venta = NEW.id_venta;
    END IF;

    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: abono; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abono (
    id_abono integer NOT NULL,
    id_tenant integer NOT NULL,
    id_venta integer NOT NULL,
    id_usuario integer NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    valor numeric(12,2) NOT NULL,
    metodo_pago character varying(30) DEFAULT 'EFECTIVO'::character varying NOT NULL,
    observacion text,
    CONSTRAINT chk_abono_metodo CHECK (((metodo_pago)::text = ANY ((ARRAY['EFECTIVO'::character varying, 'TRANSFERENCIA'::character varying, 'TARJETA'::character varying, 'OTRO'::character varying])::text[]))),
    CONSTRAINT chk_abono_valor CHECK ((valor > (0)::numeric))
);


--
-- Name: abono_id_abono_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.abono_id_abono_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: abono_id_abono_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.abono_id_abono_seq OWNED BY public.abono.id_abono;


--
-- Name: categoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categoria (
    id_cat integer NOT NULL,
    id_tenant integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text
);


--
-- Name: categoria_id_cat_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categoria_id_cat_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categoria_id_cat_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categoria_id_cat_seq OWNED BY public.categoria.id_cat;


--
-- Name: cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente (
    id_cliente integer NOT NULL,
    id_tenant integer NOT NULL,
    nombre character varying(150) NOT NULL,
    documento character varying(30),
    telefono character varying(30),
    correo character varying(150),
    direccion character varying(255),
    fecha_registro timestamp with time zone DEFAULT now() NOT NULL,
    tipo_documento character varying(10) DEFAULT 'CC'::character varying NOT NULL,
    fecha_nacimiento date,
    ocupacion character varying(120)
);


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_id_cliente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_id_cliente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_id_cliente_seq OWNED BY public.cliente.id_cliente;


--
-- Name: cuota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuota (
    id_cuota integer NOT NULL,
    id_tenant integer NOT NULL,
    id_venta integer NOT NULL,
    numero integer NOT NULL,
    fecha_vencimiento date NOT NULL,
    valor numeric(12,2) NOT NULL,
    CONSTRAINT chk_cuota_numero CHECK ((numero > 0)),
    CONSTRAINT chk_cuota_valor CHECK ((valor > (0)::numeric))
);


--
-- Name: cuota_id_cuota_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuota_id_cuota_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuota_id_cuota_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuota_id_cuota_seq OWNED BY public.cuota.id_cuota;


--
-- Name: detalle_movimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_movimiento (
    id_detalle integer NOT NULL,
    id_tenant integer NOT NULL,
    id_movimiento integer NOT NULL,
    id_producto integer NOT NULL,
    cantidad integer NOT NULL,
    costo_unitario numeric(12,2) NOT NULL,
    CONSTRAINT chk_detalle_cantidad CHECK ((cantidad > 0)),
    CONSTRAINT chk_detalle_costo CHECK ((costo_unitario >= (0)::numeric))
);


--
-- Name: detalle_movimiento_id_detalle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_movimiento_id_detalle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_movimiento_id_detalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_movimiento_id_detalle_seq OWNED BY public.detalle_movimiento.id_detalle;


--
-- Name: gasto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gasto (
    id_gasto integer NOT NULL,
    id_tenant integer NOT NULL,
    id_usuario integer NOT NULL,
    id_proveedor integer,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    concepto character varying(150) NOT NULL,
    categoria character varying(50) DEFAULT 'OTRO'::character varying NOT NULL,
    valor numeric(12,2) NOT NULL,
    observacion text,
    CONSTRAINT chk_gasto_valor CHECK ((valor > (0)::numeric))
);


--
-- Name: gasto_id_gasto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gasto_id_gasto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gasto_id_gasto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gasto_id_gasto_seq OWNED BY public.gasto.id_gasto;


--
-- Name: lente_atributos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lente_atributos (
    id_producto integer NOT NULL,
    id_tenant integer NOT NULL,
    tipo_producto character varying(30) DEFAULT 'LENTE'::character varying NOT NULL,
    tipo_lente character varying(80) NOT NULL,
    material character varying(80) NOT NULL,
    gama character varying(50) NOT NULL,
    referencia character varying(100) NOT NULL,
    id_laboratorio integer NOT NULL,
    caracteristicas text,
    CONSTRAINT chk_lente_tipo_producto CHECK (((tipo_producto)::text = 'LENTE'::text))
);


--
-- Name: movimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimiento (
    id_movimiento integer NOT NULL,
    id_tenant integer NOT NULL,
    id_usuario integer NOT NULL,
    id_venta integer,
    tipo character varying(30) NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    observacion text,
    CONSTRAINT chk_movimiento_tipo CHECK (((tipo)::text = ANY ((ARRAY['ENTRADA'::character varying, 'SALIDA'::character varying, 'AJUSTE_POSITIVO'::character varying, 'AJUSTE_NEGATIVO'::character varying])::text[])))
);


--
-- Name: movimiento_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimiento_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimiento_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimiento_id_movimiento_seq OWNED BY public.movimiento.id_movimiento;


--
-- Name: producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto (
    id_producto integer NOT NULL,
    id_tenant integer NOT NULL,
    id_categoria integer,
    id_proveedor integer NOT NULL,
    tipo_producto character varying(30) DEFAULT 'OTRO'::character varying NOT NULL,
    codigo character varying(50) NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    marca character varying(100),
    precio_compra numeric(12,2) NOT NULL,
    precio_venta numeric(12,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    stock_minimo integer DEFAULT 0 NOT NULL,
    estado character varying(30) DEFAULT 'ACTIVO'::character varying NOT NULL,
    referencia character varying(100),
    CONSTRAINT chk_producto_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying])::text[]))),
    CONSTRAINT chk_producto_precio_compra CHECK ((precio_compra >= (0)::numeric)),
    CONSTRAINT chk_producto_precio_venta CHECK ((precio_venta >= (0)::numeric)),
    CONSTRAINT chk_producto_stock CHECK ((stock >= 0)),
    CONSTRAINT chk_producto_stock_minimo CHECK ((stock_minimo >= 0)),
    CONSTRAINT chk_producto_tipo CHECK (((tipo_producto)::text = ANY ((ARRAY['MONTURA'::character varying, 'LENTE'::character varying, 'ACCESORIO'::character varying, 'OTRO'::character varying])::text[])))
);


--
-- Name: producto_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producto_id_producto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producto_id_producto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producto_id_producto_seq OWNED BY public.producto.id_producto;


--
-- Name: proveedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedor (
    id_prov integer NOT NULL,
    id_tenant integer NOT NULL,
    nombre character varying(150) NOT NULL,
    tipo character varying(30) DEFAULT 'OTRO'::character varying NOT NULL,
    telefono character varying(30),
    correo character varying(150),
    direccion character varying(255),
    CONSTRAINT chk_proveedor_tipo CHECK (((tipo)::text = ANY ((ARRAY['LABORATORIO'::character varying, 'DISTRIBUIDOR'::character varying, 'OTRO'::character varying])::text[])))
);


--
-- Name: proveedor_id_prov_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proveedor_id_prov_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedor_id_prov_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proveedor_id_prov_seq OWNED BY public.proveedor.id_prov;


--
-- Name: receta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receta (
    id_receta integer NOT NULL,
    id_tenant integer NOT NULL,
    id_cliente integer NOT NULL,
    id_usuario integer NOT NULL,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    optometrista character varying(120),
    od_esfera numeric(5,2),
    od_cilindro numeric(5,2),
    od_eje smallint,
    od_adicion numeric(4,2),
    oi_esfera numeric(5,2),
    oi_cilindro numeric(5,2),
    oi_eje smallint,
    oi_adicion numeric(4,2),
    observaciones text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_receta_eje CHECK ((((od_eje IS NULL) OR ((od_eje >= 0) AND (od_eje <= 180))) AND ((oi_eje IS NULL) OR ((oi_eje >= 0) AND (oi_eje <= 180)))))
);


--
-- Name: receta_id_receta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receta_id_receta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receta_id_receta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receta_id_receta_seq OWNED BY public.receta.id_receta;


--
-- Name: servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicio (
    id_servicio integer NOT NULL,
    id_tenant integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    costo numeric(12,2) DEFAULT 0 NOT NULL,
    precio numeric(12,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_servicio_costo CHECK ((costo >= (0)::numeric)),
    CONSTRAINT chk_servicio_precio CHECK ((precio >= (0)::numeric))
);


--
-- Name: servicio_id_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicio_id_servicio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicio_id_servicio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicio_id_servicio_seq OWNED BY public.servicio.id_servicio;


--
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    id_tenant integer NOT NULL,
    nombre character varying(150) NOT NULL,
    nit character varying(30),
    correo character varying(150),
    telefono character varying(30),
    direccion character varying(250),
    estado character varying(20) DEFAULT 'activa'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    moneda character varying(10) DEFAULT 'COP'::character varying NOT NULL,
    logo_data text,
    CONSTRAINT chk_tenant_estado CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'suspendida'::character varying])::text[])))
);


--
-- Name: tenant_id_tenant_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_id_tenant_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_id_tenant_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_id_tenant_seq OWNED BY public.tenant.id_tenant;


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id_user integer NOT NULL,
    id_tenant integer NOT NULL,
    nombre character varying(120) NOT NULL,
    correo character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    rol character varying(20) DEFAULT 'empleado'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_usuario_estado CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT chk_usuario_rol CHECK (((rol)::text = ANY ((ARRAY['admin'::character varying, 'optometrista'::character varying, 'empleado'::character varying])::text[])))
);


--
-- Name: usuario_id_user_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_id_user_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_id_user_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_id_user_seq OWNED BY public.usuario.id_user;


--
-- Name: venta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta (
    id_venta integer NOT NULL,
    id_tenant integer NOT NULL,
    id_usuario integer NOT NULL,
    id_cliente integer,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    modalidad character varying(20) DEFAULT 'CONTADO'::character varying NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    valor_pagado numeric(12,2) DEFAULT 0 NOT NULL,
    saldo numeric(12,2) GENERATED ALWAYS AS ((total - valor_pagado)) STORED,
    num_cuotas integer,
    observacion text,
    metodo_pago character varying(20),
    CONSTRAINT chk_venta_credito_cliente CHECK ((((modalidad)::text = 'CONTADO'::text) OR (id_cliente IS NOT NULL))),
    CONSTRAINT chk_venta_cuotas CHECK (((num_cuotas IS NULL) OR (num_cuotas > 0))),
    CONSTRAINT chk_venta_modalidad CHECK (((modalidad)::text = ANY ((ARRAY['CONTADO'::character varying, 'CREDITO'::character varying])::text[]))),
    CONSTRAINT chk_venta_pagado CHECK (((valor_pagado >= (0)::numeric) AND (valor_pagado <= total))),
    CONSTRAINT chk_venta_total CHECK ((total >= (0)::numeric))
);


--
-- Name: venta_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venta_detalle (
    id_detalle integer NOT NULL,
    id_tenant integer NOT NULL,
    id_venta integer NOT NULL,
    id_producto integer,
    id_servicio integer,
    concepto character varying(150) NOT NULL,
    cantidad integer NOT NULL,
    costo_unitario numeric(12,2) NOT NULL,
    precio_unitario numeric(12,2) NOT NULL,
    subtotal numeric(12,2) GENERATED ALWAYS AS (((cantidad)::numeric * precio_unitario)) STORED,
    ganancia numeric(12,2) GENERATED ALWAYS AS (((cantidad)::numeric * (precio_unitario - costo_unitario))) STORED,
    CONSTRAINT chk_vdetalle_cantidad CHECK ((cantidad > 0)),
    CONSTRAINT chk_vdetalle_costo CHECK ((costo_unitario >= (0)::numeric)),
    CONSTRAINT chk_vdetalle_origen CHECK ((num_nonnulls(id_producto, id_servicio) = 1)),
    CONSTRAINT chk_vdetalle_precio CHECK ((precio_unitario >= (0)::numeric))
);


--
-- Name: v_balance_mensual; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_balance_mensual AS
 WITH eventos AS (
         SELECT v.id_tenant,
            (date_trunc('month'::text, v.fecha))::date AS mes,
            v.total AS ventas,
            COALESCE(g.ganancia, (0)::numeric) AS ganancia,
            (0)::numeric AS gastos,
                CASE
                    WHEN ((v.modalidad)::text = 'CONTADO'::text) THEN v.total
                    ELSE (0)::numeric
                END AS recibido,
            v.saldo AS pendiente
           FROM (public.venta v
             LEFT JOIN ( SELECT venta_detalle.id_venta,
                    sum(venta_detalle.ganancia) AS ganancia
                   FROM public.venta_detalle
                  GROUP BY venta_detalle.id_venta) g ON ((g.id_venta = v.id_venta)))
        UNION ALL
         SELECT abono.id_tenant,
            (date_trunc('month'::text, abono.fecha))::date AS date_trunc,
            0,
            0,
            0,
            abono.valor,
            0
           FROM public.abono
        UNION ALL
         SELECT gasto.id_tenant,
            (date_trunc('month'::text, (gasto.fecha)::timestamp with time zone))::date AS date_trunc,
            0,
            0,
            gasto.valor,
            0,
            0
           FROM public.gasto
        )
 SELECT id_tenant,
    mes,
    sum(ventas) AS ventas_total,
    sum(ganancia) AS ganancia_bruta,
    sum(gastos) AS gastos_total,
    sum(recibido) AS dinero_recibido,
    sum(pendiente) AS saldo_pendiente,
    (sum(ganancia) - sum(gastos)) AS ganancia_neta
   FROM eventos
  GROUP BY id_tenant, mes;


--
-- Name: v_cartera; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cartera AS
 SELECT v.id_tenant,
    v.id_venta,
    c.id_cliente,
    c.nombre AS cliente,
    c.telefono,
    v.fecha,
    v.total,
    v.valor_pagado,
    v.saldo,
    ( SELECT max(a.fecha) AS max
           FROM public.abono a
          WHERE ((a.id_tenant = v.id_tenant) AND (a.id_venta = v.id_venta))) AS ultimo_abono
   FROM (public.venta v
     JOIN public.cliente c ON (((c.id_tenant = v.id_tenant) AND (c.id_cliente = v.id_cliente))))
  WHERE (((v.modalidad)::text = 'CREDITO'::text) AND (v.saldo > (0)::numeric));


--
-- Name: v_cuotas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cuotas AS
 SELECT q.id_tenant,
    q.id_venta,
    q.numero,
    q.fecha_vencimiento,
    q.valor,
    (v.valor_pagado >= sum(q.valor) OVER (PARTITION BY q.id_venta ORDER BY q.numero)) AS pagada,
    ((v.valor_pagado < sum(q.valor) OVER (PARTITION BY q.id_venta ORDER BY q.numero)) AND (q.fecha_vencimiento < CURRENT_DATE)) AS vencida
   FROM (public.cuota q
     JOIN public.venta v ON (((v.id_tenant = q.id_tenant) AND (v.id_venta = q.id_venta))));


--
-- Name: v_stock_bajo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_stock_bajo AS
 SELECT id_tenant,
    id_producto,
    codigo,
    nombre,
    stock,
    stock_minimo
   FROM public.producto
  WHERE (((estado)::text = 'ACTIVO'::text) AND (stock <= stock_minimo));


--
-- Name: venta_detalle_id_detalle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_detalle_id_detalle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_detalle_id_detalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_detalle_id_detalle_seq OWNED BY public.venta_detalle.id_detalle;


--
-- Name: venta_id_venta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venta_id_venta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venta_id_venta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venta_id_venta_seq OWNED BY public.venta.id_venta;


--
-- Name: abono id_abono; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono ALTER COLUMN id_abono SET DEFAULT nextval('public.abono_id_abono_seq'::regclass);


--
-- Name: categoria id_cat; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria ALTER COLUMN id_cat SET DEFAULT nextval('public.categoria_id_cat_seq'::regclass);


--
-- Name: cliente id_cliente; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente ALTER COLUMN id_cliente SET DEFAULT nextval('public.cliente_id_cliente_seq'::regclass);


--
-- Name: cuota id_cuota; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota ALTER COLUMN id_cuota SET DEFAULT nextval('public.cuota_id_cuota_seq'::regclass);


--
-- Name: detalle_movimiento id_detalle; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_movimiento ALTER COLUMN id_detalle SET DEFAULT nextval('public.detalle_movimiento_id_detalle_seq'::regclass);


--
-- Name: gasto id_gasto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto ALTER COLUMN id_gasto SET DEFAULT nextval('public.gasto_id_gasto_seq'::regclass);


--
-- Name: movimiento id_movimiento; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimiento_id_movimiento_seq'::regclass);


--
-- Name: producto id_producto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto ALTER COLUMN id_producto SET DEFAULT nextval('public.producto_id_producto_seq'::regclass);


--
-- Name: proveedor id_prov; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor ALTER COLUMN id_prov SET DEFAULT nextval('public.proveedor_id_prov_seq'::regclass);


--
-- Name: receta id_receta; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receta ALTER COLUMN id_receta SET DEFAULT nextval('public.receta_id_receta_seq'::regclass);


--
-- Name: servicio id_servicio; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio ALTER COLUMN id_servicio SET DEFAULT nextval('public.servicio_id_servicio_seq'::regclass);


--
-- Name: tenant id_tenant; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant ALTER COLUMN id_tenant SET DEFAULT nextval('public.tenant_id_tenant_seq'::regclass);


--
-- Name: usuario id_user; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario ALTER COLUMN id_user SET DEFAULT nextval('public.usuario_id_user_seq'::regclass);


--
-- Name: venta id_venta; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta ALTER COLUMN id_venta SET DEFAULT nextval('public.venta_id_venta_seq'::regclass);


--
-- Name: venta_detalle id_detalle; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_detalle ALTER COLUMN id_detalle SET DEFAULT nextval('public.venta_detalle_id_detalle_seq'::regclass);


--
-- Name: abono abono_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT abono_pkey PRIMARY KEY (id_abono);


--
-- Name: categoria categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_pkey PRIMARY KEY (id_cat);


--
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id_cliente);


--
-- Name: cuota cuota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota
    ADD CONSTRAINT cuota_pkey PRIMARY KEY (id_cuota);


--
-- Name: detalle_movimiento detalle_movimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_movimiento
    ADD CONSTRAINT detalle_movimiento_pkey PRIMARY KEY (id_detalle);


--
-- Name: gasto gasto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT gasto_pkey PRIMARY KEY (id_gasto);


--
-- Name: lente_atributos lente_atributos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lente_atributos
    ADD CONSTRAINT lente_atributos_pkey PRIMARY KEY (id_producto);


--
-- Name: movimiento movimiento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento
    ADD CONSTRAINT movimiento_pkey PRIMARY KEY (id_movimiento);


--
-- Name: producto producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT producto_pkey PRIMARY KEY (id_producto);


--
-- Name: proveedor proveedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT proveedor_pkey PRIMARY KEY (id_prov);


--
-- Name: receta receta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_pkey PRIMARY KEY (id_receta);


--
-- Name: servicio servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT servicio_pkey PRIMARY KEY (id_servicio);


--
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (id_tenant);


--
-- Name: categoria uq_categoria_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT uq_categoria_tenant_id UNIQUE (id_tenant, id_cat);


--
-- Name: categoria uq_categoria_tenant_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT uq_categoria_tenant_nombre UNIQUE (id_tenant, nombre);


--
-- Name: cliente uq_cliente_tenant_documento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT uq_cliente_tenant_documento UNIQUE (id_tenant, documento);


--
-- Name: cliente uq_cliente_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT uq_cliente_tenant_id UNIQUE (id_tenant, id_cliente);


--
-- Name: cuota uq_cuota_venta_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota
    ADD CONSTRAINT uq_cuota_venta_numero UNIQUE (id_venta, numero);


--
-- Name: lente_atributos uq_lente_referencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lente_atributos
    ADD CONSTRAINT uq_lente_referencia UNIQUE (id_tenant, id_laboratorio, referencia);


--
-- Name: movimiento uq_movimiento_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento
    ADD CONSTRAINT uq_movimiento_tenant_id UNIQUE (id_tenant, id_movimiento);


--
-- Name: producto uq_producto_id_tipo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT uq_producto_id_tipo UNIQUE (id_producto, tipo_producto);


--
-- Name: producto uq_producto_tenant_codigo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT uq_producto_tenant_codigo UNIQUE (id_tenant, codigo);


--
-- Name: producto uq_producto_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT uq_producto_tenant_id UNIQUE (id_tenant, id_producto);


--
-- Name: proveedor uq_proveedor_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT uq_proveedor_tenant_id UNIQUE (id_tenant, id_prov);


--
-- Name: servicio uq_servicio_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT uq_servicio_tenant_id UNIQUE (id_tenant, id_servicio);


--
-- Name: servicio uq_servicio_tenant_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT uq_servicio_tenant_nombre UNIQUE (id_tenant, nombre);


--
-- Name: usuario uq_usuario_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_tenant_id UNIQUE (id_tenant, id_user);


--
-- Name: venta uq_venta_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta
    ADD CONSTRAINT uq_venta_tenant_id UNIQUE (id_tenant, id_venta);


--
-- Name: usuario usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id_user);


--
-- Name: venta_detalle venta_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT venta_detalle_pkey PRIMARY KEY (id_detalle);


--
-- Name: venta venta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta
    ADD CONSTRAINT venta_pkey PRIMARY KEY (id_venta);


--
-- Name: idx_abono_tenant_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abono_tenant_fecha ON public.abono USING btree (id_tenant, fecha);


--
-- Name: idx_abono_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abono_venta ON public.abono USING btree (id_venta);


--
-- Name: idx_categoria_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categoria_tenant ON public.categoria USING btree (id_tenant);


--
-- Name: idx_cliente_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_nombre ON public.cliente USING btree (id_tenant, lower((nombre)::text));


--
-- Name: idx_cliente_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cliente_tenant ON public.cliente USING btree (id_tenant);


--
-- Name: idx_cuota_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cuota_venta ON public.cuota USING btree (id_venta);


--
-- Name: idx_detalle_movimiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_detalle_movimiento ON public.detalle_movimiento USING btree (id_movimiento);


--
-- Name: idx_detalle_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_detalle_producto ON public.detalle_movimiento USING btree (id_producto);


--
-- Name: idx_gasto_tenant_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gasto_tenant_fecha ON public.gasto USING btree (id_tenant, fecha);


--
-- Name: idx_lente_laboratorio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lente_laboratorio ON public.lente_atributos USING btree (id_laboratorio);


--
-- Name: idx_movimiento_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimiento_tenant ON public.movimiento USING btree (id_tenant, fecha);


--
-- Name: idx_movimiento_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimiento_usuario ON public.movimiento USING btree (id_usuario);


--
-- Name: idx_producto_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_categoria ON public.producto USING btree (id_categoria);


--
-- Name: idx_producto_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_nombre ON public.producto USING btree (id_tenant, lower((nombre)::text));


--
-- Name: idx_producto_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_proveedor ON public.producto USING btree (id_proveedor);


--
-- Name: idx_producto_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_producto_tenant ON public.producto USING btree (id_tenant);


--
-- Name: idx_proveedor_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proveedor_tenant ON public.proveedor USING btree (id_tenant);


--
-- Name: idx_receta_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receta_cliente ON public.receta USING btree (id_tenant, id_cliente, fecha DESC);


--
-- Name: idx_servicio_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_servicio_tenant ON public.servicio USING btree (id_tenant);


--
-- Name: idx_usuario_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_tenant ON public.usuario USING btree (id_tenant);


--
-- Name: idx_vdetalle_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vdetalle_producto ON public.venta_detalle USING btree (id_producto);


--
-- Name: idx_vdetalle_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vdetalle_venta ON public.venta_detalle USING btree (id_venta);


--
-- Name: idx_venta_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_cliente ON public.venta USING btree (id_cliente);


--
-- Name: idx_venta_tenant_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venta_tenant_fecha ON public.venta USING btree (id_tenant, fecha);


--
-- Name: uq_movimiento_venta; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_movimiento_venta ON public.movimiento USING btree (id_venta) WHERE (id_venta IS NOT NULL);


--
-- Name: uq_tenant_nit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_tenant_nit ON public.tenant USING btree (nit) WHERE (nit IS NOT NULL);


--
-- Name: uq_usuario_correo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_usuario_correo ON public.usuario USING btree (lower((correo)::text));


--
-- Name: abono trg_abono_aplicar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_abono_aplicar BEFORE INSERT ON public.abono FOR EACH ROW EXECUTE FUNCTION public.fn_abono_aplicar();


--
-- Name: detalle_movimiento trg_detalle_movimiento_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_detalle_movimiento_no_update BEFORE UPDATE ON public.detalle_movimiento FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_update();


--
-- Name: detalle_movimiento trg_detalle_movimiento_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_detalle_movimiento_stock AFTER INSERT ON public.detalle_movimiento FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_stock();


--
-- Name: tenant trg_tenant_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_actualizado BEFORE UPDATE ON public.tenant FOR EACH ROW EXECUTE FUNCTION public.fn_actualizado_en();


--
-- Name: usuario trg_usuario_actualizado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.fn_actualizado_en();


--
-- Name: venta_detalle trg_venta_detalle_aplicar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_venta_detalle_aplicar AFTER INSERT ON public.venta_detalle FOR EACH ROW EXECUTE FUNCTION public.fn_venta_detalle_aplicar();


--
-- Name: venta_detalle trg_venta_detalle_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_venta_detalle_no_update BEFORE UPDATE ON public.venta_detalle FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_update();


--
-- Name: venta trg_venta_movimiento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_venta_movimiento AFTER INSERT ON public.venta FOR EACH ROW EXECUTE FUNCTION public.fn_venta_crear_movimiento();


--
-- Name: abono fk_abono_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT fk_abono_usuario FOREIGN KEY (id_tenant, id_usuario) REFERENCES public.usuario(id_tenant, id_user) ON DELETE RESTRICT;


--
-- Name: abono fk_abono_venta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abono
    ADD CONSTRAINT fk_abono_venta FOREIGN KEY (id_tenant, id_venta) REFERENCES public.venta(id_tenant, id_venta) ON DELETE CASCADE;


--
-- Name: categoria fk_categoria_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT fk_categoria_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: cliente fk_cliente_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT fk_cliente_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: cuota fk_cuota_venta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuota
    ADD CONSTRAINT fk_cuota_venta FOREIGN KEY (id_tenant, id_venta) REFERENCES public.venta(id_tenant, id_venta) ON DELETE CASCADE;


--
-- Name: detalle_movimiento fk_detalle_movimiento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_movimiento
    ADD CONSTRAINT fk_detalle_movimiento FOREIGN KEY (id_tenant, id_movimiento) REFERENCES public.movimiento(id_tenant, id_movimiento) ON DELETE CASCADE;


--
-- Name: detalle_movimiento fk_detalle_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_movimiento
    ADD CONSTRAINT fk_detalle_producto FOREIGN KEY (id_tenant, id_producto) REFERENCES public.producto(id_tenant, id_producto) ON DELETE RESTRICT;


--
-- Name: gasto fk_gasto_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT fk_gasto_proveedor FOREIGN KEY (id_tenant, id_proveedor) REFERENCES public.proveedor(id_tenant, id_prov) ON DELETE RESTRICT;


--
-- Name: gasto fk_gasto_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT fk_gasto_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: gasto fk_gasto_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gasto
    ADD CONSTRAINT fk_gasto_usuario FOREIGN KEY (id_tenant, id_usuario) REFERENCES public.usuario(id_tenant, id_user) ON DELETE RESTRICT;


--
-- Name: lente_atributos fk_lente_laboratorio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lente_atributos
    ADD CONSTRAINT fk_lente_laboratorio FOREIGN KEY (id_tenant, id_laboratorio) REFERENCES public.proveedor(id_tenant, id_prov) ON DELETE RESTRICT;


--
-- Name: lente_atributos fk_lente_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lente_atributos
    ADD CONSTRAINT fk_lente_producto FOREIGN KEY (id_producto, tipo_producto) REFERENCES public.producto(id_producto, tipo_producto) ON DELETE CASCADE;


--
-- Name: lente_atributos fk_lente_producto_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lente_atributos
    ADD CONSTRAINT fk_lente_producto_tenant FOREIGN KEY (id_tenant, id_producto) REFERENCES public.producto(id_tenant, id_producto) ON DELETE CASCADE;


--
-- Name: movimiento fk_movimiento_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento
    ADD CONSTRAINT fk_movimiento_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: movimiento fk_movimiento_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento
    ADD CONSTRAINT fk_movimiento_usuario FOREIGN KEY (id_tenant, id_usuario) REFERENCES public.usuario(id_tenant, id_user) ON DELETE RESTRICT;


--
-- Name: movimiento fk_movimiento_venta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimiento
    ADD CONSTRAINT fk_movimiento_venta FOREIGN KEY (id_tenant, id_venta) REFERENCES public.venta(id_tenant, id_venta) ON DELETE CASCADE;


--
-- Name: producto fk_producto_categoria; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT fk_producto_categoria FOREIGN KEY (id_tenant, id_categoria) REFERENCES public.categoria(id_tenant, id_cat) ON DELETE RESTRICT;


--
-- Name: producto fk_producto_proveedor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT fk_producto_proveedor FOREIGN KEY (id_tenant, id_proveedor) REFERENCES public.proveedor(id_tenant, id_prov) ON DELETE RESTRICT;


--
-- Name: producto fk_producto_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto
    ADD CONSTRAINT fk_producto_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: proveedor fk_proveedor_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedor
    ADD CONSTRAINT fk_proveedor_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: receta fk_receta_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT fk_receta_cliente FOREIGN KEY (id_tenant, id_cliente) REFERENCES public.cliente(id_tenant, id_cliente) ON DELETE CASCADE;


--
-- Name: receta fk_receta_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT fk_receta_usuario FOREIGN KEY (id_tenant, id_usuario) REFERENCES public.usuario(id_tenant, id_user) ON DELETE RESTRICT;


--
-- Name: servicio fk_servicio_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicio
    ADD CONSTRAINT fk_servicio_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: usuario fk_usuario_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: venta_detalle fk_vdetalle_producto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT fk_vdetalle_producto FOREIGN KEY (id_tenant, id_producto) REFERENCES public.producto(id_tenant, id_producto) ON DELETE RESTRICT;


--
-- Name: venta_detalle fk_vdetalle_servicio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT fk_vdetalle_servicio FOREIGN KEY (id_tenant, id_servicio) REFERENCES public.servicio(id_tenant, id_servicio) ON DELETE RESTRICT;


--
-- Name: venta_detalle fk_vdetalle_venta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta_detalle
    ADD CONSTRAINT fk_vdetalle_venta FOREIGN KEY (id_tenant, id_venta) REFERENCES public.venta(id_tenant, id_venta) ON DELETE CASCADE;


--
-- Name: venta fk_venta_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta
    ADD CONSTRAINT fk_venta_cliente FOREIGN KEY (id_tenant, id_cliente) REFERENCES public.cliente(id_tenant, id_cliente) ON DELETE RESTRICT;


--
-- Name: venta fk_venta_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta
    ADD CONSTRAINT fk_venta_tenant FOREIGN KEY (id_tenant) REFERENCES public.tenant(id_tenant) ON DELETE CASCADE;


--
-- Name: venta fk_venta_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venta
    ADD CONSTRAINT fk_venta_usuario FOREIGN KEY (id_tenant, id_usuario) REFERENCES public.usuario(id_tenant, id_user) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict p5KmYl36JBJMkFyvcjaWftiJZf0plGU9lJBvrWSzRWe3BA2ecu10NKCTXtOSEB5

