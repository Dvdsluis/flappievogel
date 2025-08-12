targetScope = 'subscription'

@description('Azure location for all resources')
param location string = 'westeurope'
@description('Environment name (azd)')
param environmentName string
@description('Resource group name to create')
param resourceGroupName string

var resourcePrefix = 'fv'
// resource token per rules for subscription scope
var resourceToken = uniqueString(subscription().id, location, environmentName)

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    'azd-env-name': environmentName
  }
}

module webRg 'modules/web.bicep' = {
  name: 'web-rg'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    resourceToken: resourceToken
    resourcePrefix: resourcePrefix
  }
}

output RESOURCE_GROUP_ID string = rg.id
