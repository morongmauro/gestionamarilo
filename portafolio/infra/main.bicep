// ============================================================
// PORTAFOLIO · infraestructura en Azure (Bicep)
// Crea, en el grupo de recursos donde se despliegue:
//   - App Service (Linux, Node 20) con identidad administrada
//   - Azure SQL Database serverless, con acceso solo por Entra ID
//   - (opcional) una cuenta de Data Lake Storage Gen2 con el contenedor
//     «portafolio» y el permiso para que la app escriba en ella
// La app no guarda contraseñas de base de datos ni de almacenamiento:
// entra a SQL y al lago con su identidad administrada.
//
// Despliegue:
//   az deployment group create -g <grupo> -f portafolio/infra/main.bicep \
//     -p sqlAdminLogin=<grupo-entra> sqlAdminObjectId=<object-id> \
//        adminEmail=<correo> adminPassword=<clave-temporal> sessionSecret=<cadena-larga>
// ============================================================

@description('Prefijo de los recursos: minúsculas, sin espacios.')
@minLength(3)
@maxLength(14)
param nombre string = 'portafolio'

param location string = resourceGroup().location

@description('Nombre del usuario o grupo de Entra ID que administra la base SQL (recomendado: un grupo de TI).')
param sqlAdminLogin string

@description('Object ID en Entra ID de ese usuario o grupo.')
param sqlAdminObjectId string

@allowed(['Group', 'User'])
param sqlAdminTipo string = 'Group'

@description('Correo del primer administrador de la aplicación.')
param adminEmail string

@description('Contraseña temporal del primer administrador (la app pide cambiarla al entrar).')
@secure()
param adminPassword string

@description('Clave para firmar las sesiones: una cadena larga y aleatoria. Si cambia, todos deben volver a entrar.')
@secure()
param sessionSecret string

param orgName string = 'Oficina de Generación de Valor'

@description('Plan del App Service. B1 alcanza para un equipo; P0v3 si se requiere red privada.')
param appServiceSku string = 'B1'

@description('true: crea una cuenta de Data Lake nueva. false: usa una que ya existe (LAKE_ACCOUNT).')
param crearLago bool = true

@description('Si crearLago=false: nombre de la cuenta de almacenamiento del lago corporativo.')
param lagoCuentaExistente string = ''

param lagoContenedor string = 'portafolio'

@description('Hora local del envío diario al lago (0-23), o "off".')
param lagoHora string = '2'

var sufijo = uniqueString(resourceGroup().id)
var appName = '${nombre}-${sufijo}'
var sqlServerName = '${nombre}-sql-${sufijo}'
var dbName = 'portafolio'
var lagoNombre = crearLago ? take(toLower('${replace(nombre, '-', '')}lago${sufijo}'), 24) : lagoCuentaExistente
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

// ---------- Base de datos ----------
resource sqlServer 'Microsoft.Sql/servers@2021-11-01' = {
  name: sqlServerName
  location: location
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      login: sqlAdminLogin
      sid: sqlAdminObjectId
      principalType: sqlAdminTipo
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
  }
}

// Permite conexiones desde servicios de Azure (el App Service)
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2021-11-01' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2021-11-01' = {
  parent: sqlServer
  name: dbName
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    maxSizeBytes: 34359738368
  }
}

// ---------- Aplicación ----------
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${nombre}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: appServiceSku
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'node server.js'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ORG_NAME', value: orgName }
        { name: 'SESSION_SECRET', value: sessionSecret }
        { name: 'ADMIN_EMAIL', value: adminEmail }
        { name: 'ADMIN_PASSWORD', value: adminPassword }
        { name: 'DB', value: 'sql' }
        { name: 'SQL_SERVER', value: sqlServer.properties.fullyQualifiedDomainName }
        { name: 'SQL_DATABASE', value: dbName }
        { name: 'SQL_AUTH', value: 'managed-identity' }
        { name: 'LAKE_ACCOUNT', value: lagoNombre }
        { name: 'LAKE_CONTAINER', value: lagoContenedor }
        { name: 'LAKE_HOUR', value: lagoHora }
        { name: 'TZ_OFFSET', value: '-05:00' }
      ]
    }
  }
}

// ---------- Data lake (opcional) ----------
resource lago 'Microsoft.Storage/storageAccounts@2023-01-01' = if (crearLago) {
  name: lagoNombre
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    isHnsEnabled: true // Data Lake Storage Gen2
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false // solo identidades de Entra ID, sin claves
  }
}

resource lagoBlob 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = if (crearLago) {
  parent: lago
  name: 'default'
}

resource lagoContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = if (crearLago) {
  parent: lagoBlob
  name: lagoContenedor
  properties: {
    publicAccess: 'None'
  }
}

// La identidad de la app puede escribir en el contenedor del lago
resource lagoPermiso 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (crearLago) {
  name: guid(lagoNombre, lagoContenedor, appName, storageBlobDataContributor)
  scope: lagoContainer
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------- Salidas ----------
output url string = 'https://${app.properties.defaultHostName}'
output appServiceName string = app.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output lagoCuenta string = lagoNombre
output siguientePaso string = 'Conéctate a la base «${dbName}» como administrador de Entra y corre portafolio/sql/permisos-app.sql reemplazando <nombre-app> por ${app.name}.'
output permisoLagoExistente string = crearLago ? '' : 'Pide a TI asignar a la identidad de ${app.name} el rol «Storage Blob Data Contributor» sobre el contenedor ${lagoContenedor} de ${lagoCuentaExistente}.'
