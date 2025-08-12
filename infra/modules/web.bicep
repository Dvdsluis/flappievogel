@description('Location')
param location string
@description('Environment name (azd)')
// environmentName not used in module but required by parent for naming consistency
param environmentName string
@description('Resource token')
param resourceToken string
@description('Short resource prefix (<=3)')
param resourcePrefix string = 'fv'

var swaName = 'az-${resourcePrefix}-${resourceToken}'
var wpsName = 'az-${resourcePrefix}-wps-${resourceToken}'
var uamiName = 'az-${resourcePrefix}-uami-${resourceToken}'

// Web PubSub
resource wps 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: wpsName
  location: location
  sku: {
  name: 'Free_F1'
  capacity: 1
  }
  tags: {
    'azd-env-name': environmentName
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    networkACLs: {
      defaultAction: 'Allow'
    }
  }
}

// User Assigned Managed Identity
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: uamiName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
}

// Static Web App
resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: swaName
  location: location // SWA is global; region is for metadata
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: ''
    branch: ''
    buildProperties: {
      appLocation: 'flappy-vs'
      apiLocation: 'flappy-vs/api'
      outputLocation: 'dist'
    }
  }
  tags: {
    'azd-service-name': 'web'
  'azd-env-name': environmentName
  }
}

// Note: Set WEB_PUBSUB_CLIENT_URL app setting post-deploy (azd env set or portal)
