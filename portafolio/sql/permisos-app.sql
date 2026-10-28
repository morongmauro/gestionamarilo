-- ============================================================
-- PORTAFOLIO · permisos de la aplicación en Azure SQL
-- Córrelo UNA vez, conectado a la base «portafolio» con una cuenta
-- administradora de Entra ID (Query editor del portal o SSMS).
-- Reemplaza <nombre-app> por el nombre del App Service
-- (sale en la salida «appServiceName» del despliegue).
-- ============================================================

CREATE USER [<nombre-app>] FROM EXTERNAL PROVIDER;

-- Leer y escribir datos
ALTER ROLE db_datareader ADD MEMBER [<nombre-app>];
ALTER ROLE db_datawriter ADD MEMBER [<nombre-app>];

-- Crear sus tablas (pf_*) la primera vez que arranca
ALTER ROLE db_ddladmin ADD MEMBER [<nombre-app>];

-- Después del primer arranque, si TI prefiere, se puede quitar:
-- ALTER ROLE db_ddladmin DROP MEMBER [<nombre-app>];
