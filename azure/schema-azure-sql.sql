-- ============================================================
-- INICIATIVAS · esquema para Azure SQL Database (o SQL Server)
-- Equivalente a supabase/migracion-2026-10-iniciativas.sql.
-- Ejecutar en: portal de Azure → tu base → Query editor, o desde
-- Azure Data Studio / SSMS. Seguro de correr más de una vez.
-- ============================================================

IF OBJECT_ID('dbo.iniciativas', 'U') IS NULL
CREATE TABLE dbo.iniciativas (
  id         UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  props      NVARCHAR(MAX)    NOT NULL DEFAULT N'{}' CONSTRAINT ck_iniciativas_props_json CHECK (ISJSON(props) = 1),
  position   INT              NOT NULL DEFAULT 0,
  created_at DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_iniciativas_position')
  CREATE INDEX ix_iniciativas_position ON dbo.iniciativas(position);

IF OBJECT_ID('dbo.iniciativas_config', 'U') IS NULL
CREATE TABLE dbo.iniciativas_config (
  id         NVARCHAR(40)  NOT NULL PRIMARY KEY DEFAULT N'default',
  columns    NVARCHAR(MAX) NOT NULL DEFAULT N'[]' CONSTRAINT ck_iniciativas_config_json CHECK (ISJSON(columns) = 1),
  updated_at DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Vista cómoda para Power BI / Copilot: una columna SQL por propiedad fija.
-- Las columnas que agregues desde la app siguen disponibles en `props`.
CREATE OR ALTER VIEW dbo.v_iniciativas AS
SELECT
  id,
  JSON_VALUE(props, '$.estado')        AS estado,
  JSON_VALUE(props, '$.iniciativa')    AS iniciativa,
  JSON_VALUE(props, '$.trazabilidad')  AS trazabilidad,
  JSON_QUERY(props, '$.habilitadores') AS habilitadores,   -- lista JSON
  JSON_QUERY(props, '$.realizadores')  AS realizadores,    -- lista JSON
  TRY_CONVERT(DECIMAL(18,2), JSON_VALUE(props, '$.income')) AS income,
  JSON_VALUE(props, '$.okrs')          AS okrs,
  JSON_VALUE(props, '$.tipo_valor')    AS tipo_valor,
  position, created_at, updated_at
FROM dbo.iniciativas;
