targetScope = 'resourceGroup'

@description('The name of the application')
param appName string = 'pptx-engine'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The container image to deploy')
param containerImage string = ''

@description('CPU cores for the container (e.g., 0.5, 1, 2)')
param cpuCores string = '1'

@description('Memory in Gi for the container (e.g., 1Gi, 2Gi)')
param memory string = '2Gi'

@description('Minimum number of replicas — must be ≥1 to preserve in-memory file store')
param minReplicas int = 1

@description('Maximum number of replicas — keep at 1 while using in-memory file store')
param maxReplicas int = 1

@description('Log Analytics workspace name')
param logAnalyticsName string = '${appName}-logs'

@description('Container Apps Environment name')
param environmentName string = '${appName}-env'

@description('Storage account name for PPTX output')
param storageAccountName string = replace('${appName}store', '-', '')

@description('Application Insights name')
param appInsightsName string = '${appName}-insights'

@description('Container Registry name')
param containerRegistryName string = replace('${appName}registry', '-', '')

@description('Azure OpenAI endpoint URL (e.g., https://myoai.openai.azure.com/)')
param azureOpenAiEndpoint string = ''

@description('Azure OpenAI DALL-E deployment name')
param azureOpenAiDeployment string = 'dall-e-3'

@description('Azure OpenAI API version')
param azureOpenAiApiVersion string = '2024-02-01'

@description('Flux AI image endpoint URL')
param fluxEndpoint string = ''

@secure()
@description('Flux AI image API key')
param fluxApiKey string = ''

// ===================================
// Log Analytics Workspace
// ===================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ===================================
// Application Insights
// ===================================
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ===================================
// Storage Account (for PPTX output)
// ===================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'pptx-output'
  properties: {
    publicAccess: 'None'
  }
}

// ===================================
// Container Apps Environment
// ===================================
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ===================================
// Azure Container Registry
// ===================================
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// ===================================
// User-Assigned Managed Identity
// ===================================
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-identity'
  location: location
}

// Assign Storage Blob Data Contributor to the managed identity
resource storageBlobRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storageAccount
  name: guid(storageAccount.id, managedIdentity.id, 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'ba92f5b4-2d11-453d-a403-e96b0029c9fe' // Storage Blob Data Contributor
    )
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign AcrPull to the managed identity on the container registry
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: containerRegistry
  name: guid(containerRegistry.id, managedIdentity.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull
    )
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// NOTE: Cognitive Services OpenAI User role on the existing Azure OpenAI resource
// must be assigned post-deployment via CLI:
//   az role assignment create --assignee <managedIdentityClientId> \
//     --role "Cognitive Services OpenAI User" \
//     --scope <azureOpenAiResourceId>

// ===================================
// Container App
// ===================================
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: {
    'azd-service-name': 'api'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          maxAge: 3600
        }
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: managedIdentity.id
        }
      ]
      secrets: [
        {
          name: 'flux-api-key'
          value: fluxApiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage != '' ? containerImage : 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json(cpuCores)
            memory: memory
          }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'MODE', value: 'all' }
            { name: 'PORT', value: '3000' }
            { name: 'LOG_LEVEL', value: 'info' }
            { name: 'AZURE_STORAGE_ACCOUNT', value: storageAccount.name }
            { name: 'AZURE_STORAGE_CONTAINER', value: 'pptx-output' }
            { name: 'AZURE_CLIENT_ID', value: managedIdentity.properties.clientId }
            { name: 'AI_IMAGE_PROVIDER', value: fluxEndpoint != '' ? 'flux' : azureOpenAiEndpoint != '' ? 'azure-openai' : '' }
            { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: azureOpenAiDeployment }
            { name: 'AZURE_OPENAI_API_VERSION', value: azureOpenAiApiVersion }
            { name: 'FLUX_ENDPOINT', value: fluxEndpoint }
            { name: 'FLUX_API_KEY', secretRef: 'flux-api-key' }
            { name: 'PUBLIC_URL', value: 'https://${appName}.${containerAppsEnv.properties.defaultDomain}' }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsights.properties.ConnectionString
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/v1/health'
                port: 3000
              }
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/v1/health'
                port: 3000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ===================================
// Outputs
// ===================================
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
output storageAccountName string = storageAccount.name
output managedIdentityClientId string = managedIdentity.properties.clientId
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerRegistry.properties.loginServer
