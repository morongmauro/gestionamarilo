-- ============================================================
-- PORTAFOLIO · vistas planas para Power BI, Copilot y el data lake
-- Requiere que la app ya haya arrancado una vez con DB=sql (crea las
-- tablas pf_*). Corre este archivo en Azure SQL / SQL database de
-- Fabric (Query editor) o en SQL Server Management Studio.
-- Si cambiaste SQL_SCHEMA o SQL_TABLE_PREFIX, ajusta los nombres.
-- Las columnas de proyectos usan los id de las columnas por defecto
-- (estado, proyecto, trazabilidad…); si creas columnas nuevas en la
-- app, agrégalas aquí con su id ('$.props.<id>').
-- ============================================================

CREATE OR ALTER VIEW dbo.v_pf_proyectos AS
SELECT p.id AS proyecto_id, j.proyecto, j.estado, j.trazabilidad,
       j.habilitadores, j.realizadores, j.income, j.okrs, j.tipo_valor,
       p.created_at, p.updated_at
FROM dbo.pf_projects p
CROSS APPLY OPENJSON(p.data) WITH (
  proyecto      NVARCHAR(500)  '$.props.proyecto',
  estado        NVARCHAR(200)  '$.props.estado',
  trazabilidad  NVARCHAR(MAX)  '$.props.trazabilidad',
  habilitadores NVARCHAR(MAX)  '$.props.habilitadores' AS JSON,
  realizadores  NVARCHAR(MAX)  '$.props.realizadores' AS JSON,
  income        DECIMAL(19,2)  '$.props.income',
  okrs          NVARCHAR(MAX)  '$.props.okrs',
  tipo_valor    NVARCHAR(200)  '$.props.tipo_valor'
) j;
GO

CREATE OR ALTER VIEW dbo.v_pf_actividades AS
SELECT a.id AS actividad_id, j.proyecto_id, j.capitulo_id, s.capitulo, j.actividad, j.responsable, j.area, j.entregable,
       j.inicio, j.fin, j.duracion_habiles, j.avance, j.hito, j.inicio_real, j.fin_real, j.inicio_base, j.fin_base, a.updated_at
FROM dbo.pf_activities a
CROSS APPLY OPENJSON(a.data) WITH (
  proyecto_id      NVARCHAR(64)  '$.project_id',
  capitulo_id      NVARCHAR(64)  '$.section_id',
  actividad        NVARCHAR(500) '$.name',
  responsable      NVARCHAR(500) '$.responsable',
  area             NVARCHAR(500) '$.area',
  entregable       NVARCHAR(500) '$.entregable',
  inicio           DATE          '$.inicio',
  fin              DATE          '$.fin',
  duracion_habiles INT           '$.duracion',
  avance           INT           '$.avance',
  hito             BIT           '$.hito',
  inicio_real      DATE          '$.real_ini',
  fin_real         DATE          '$.real_fin',
  inicio_base      DATE          '$.base_ini',
  fin_base         DATE          '$.base_fin'
) j
OUTER APPLY (SELECT JSON_VALUE(c.data, '$.name') AS capitulo FROM dbo.pf_sections c WHERE c.id = j.capitulo_id) s;
GO

CREATE OR ALTER VIEW dbo.v_pf_casos AS
SELECT c.id AS caso_id, j.proyecto_id, j.estado, j.sponsor, j.moneda, j.tasa, j.anios,
       j.problema, j.objetivo, j.alcance, j.riesgos, j.recomendacion, c.updated_at
FROM dbo.pf_cases c
CROSS APPLY OPENJSON(c.data) WITH (
  proyecto_id   NVARCHAR(64)  '$.project_id',
  estado        NVARCHAR(100) '$.estado',
  sponsor       NVARCHAR(500) '$.sponsor',
  moneda        NVARCHAR(10)  '$.moneda',
  tasa          DECIMAL(9,4)  '$.tasa',
  anios         INT           '$.anios',
  problema      NVARCHAR(MAX) '$.problema',
  objetivo      NVARCHAR(MAX) '$.objetivo',
  alcance       NVARCHAR(MAX) '$.alcance',
  riesgos       NVARCHAR(MAX) '$.riesgos',
  recomendacion NVARCHAR(MAX) '$.recomendacion'
) j;
GO

-- Flujo del caso en formato largo: una fila por concepto y año
CREATE OR ALTER VIEW dbo.v_pf_flujos AS
SELECT j.proyecto_id, f.concepto, f.tipo, CAST(v.[key] AS INT) AS anio, TRY_CONVERT(DECIMAL(19,2), v.[value]) AS valor
FROM dbo.pf_cases c
CROSS APPLY OPENJSON(c.data) WITH (proyecto_id NVARCHAR(64) '$.project_id') j
CROSS APPLY OPENJSON(c.data, '$.flujos') WITH (
  concepto NVARCHAR(500) '$.concepto',
  tipo     NVARCHAR(20)  '$.tipo',
  valores  NVARCHAR(MAX) '$.valores' AS JSON
) f
CROSS APPLY OPENJSON(f.valores) v;
GO

CREATE OR ALTER VIEW dbo.v_pf_sesiones AS
SELECT s.id AS sesion_id, j.comite_id, cm.comite, j.titulo, j.fecha, j.hora_inicio, j.hora_fin,
       j.estado, j.lugar, j.enlace, j.temas, j.decisiones, s.updated_at
FROM dbo.pf_sessions s
CROSS APPLY OPENJSON(s.data) WITH (
  comite_id   NVARCHAR(64)  '$.comite_id',
  titulo      NVARCHAR(500) '$.titulo',
  fecha       DATE          '$.fecha',
  hora_inicio NVARCHAR(5)   '$.hora_ini',
  hora_fin    NVARCHAR(5)   '$.hora_fin',
  estado      NVARCHAR(50)  '$.estado',
  lugar       NVARCHAR(500) '$.lugar',
  enlace      NVARCHAR(1000) '$.enlace',
  temas       NVARCHAR(MAX) '$.temas',
  decisiones  NVARCHAR(MAX) '$.decisiones'
) j
OUTER APPLY (SELECT JSON_VALUE(c.data, '$.name') AS comite FROM dbo.pf_committees c WHERE c.id = j.comite_id) cm;
GO

-- Proyectos que se presentan en cada sesión
CREATE OR ALTER VIEW dbo.v_pf_sesion_proyectos AS
SELECT s.id AS sesion_id, p.[value] AS proyecto_id
FROM dbo.pf_sessions s
CROSS APPLY OPENJSON(s.data, '$.proyectos') p;
GO

CREATE OR ALTER VIEW dbo.v_pf_compromisos AS
SELECT s.id AS sesion_id, k.compromiso, k.responsable, k.fecha, k.cumplido
FROM dbo.pf_sessions s
CROSS APPLY OPENJSON(s.data, '$.compromisos') WITH (
  compromiso  NVARCHAR(1000) '$.texto',
  responsable NVARCHAR(500)  '$.responsable',
  fecha       DATE           '$.fecha',
  cumplido    BIT            '$.hecho'
) k;
GO
