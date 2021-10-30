# Note: You may need to run the following command before the script can be run:
#   Set-ExecutionPolicy -Scope CurrentUser Unrestricted 
$ErrorActionPreference = "Stop"

Write-Output "
/***
 *                                                                               
 *     _____                 ____  _____    _____ _ _ _ _            ____          _   _                 _
 *    |     |___ ___ ___ ___|    \| __  |  | __  |_| | |_|___ ___   |    \ ___ ___| |_| |_ ___ ___ ___ _| |___
 *    | | | | . |   | . | . |  |  | __ -|  | __ -| | | | |   | . |  |  |  | .'|_ -|   | . | . | .'|  _| . |_ -|
 *    |_|_|_|___|_|_|_  |___|____/|_____|  |_____|_|_|_|_|_|_|_  |  |____/|__,|___|_|_|___|___|__,|_| |___|___|
 *                  |___|                                    |___|               
 */
"
Write-Output "This script configures a MongoDB Realm app which extracts data from the Atlas Billing API"
Write-Output "and writes it to an Atlas Cluster`n"

Write-Output "Before you run this script, make sure you have:"
Write-Output "1. Created a new MongoDB Atlas project for your billing app"
Write-Output "2. Created a new cluster inside that project for storing billing data"
Write-Output "3. Created an API Key inside that project, and recorded the public and private key details"
Write-Output "4. Created an API Key for your Organization and recorded the public and private key details"
Write-Output "5. Installed dependencies for this script: node, mongodb-realm-cli"
Write-Output "For more details on these steps, see the README.md file.`n"

# Prompt for API Keys
$publicKeyProject = Read-Host "Enter the PUBLIC Key for your PROJECT level API Key"
$privateKeyProject = Read-Host "Enter the PRIVATE Key for your PROJECT level API Key"
$publicKeyOrg = Read-Host "Enter the PUBLIC Key for your ORGANIZATION level API Key"
$privateKeyOrg = Read-Host "Enter the PRIVATE Key for your ORGANIZATION level API Key"
$clusterName= Read-Host "Enter the name of the Atlas Cluster that will store the billing data"
Write-Output "Thanks....."

# Obtain Organization ID and Cluster info from Atlas API
$securePassword = ConvertTo-SecureString -String $privateKeyProject -AsPlainText -Force
$credentials = New-Object System.Management.Automation.PSCredential ($publicKeyProject, $securePassword)
$resp = Invoke-WebRequest -Uri https://cloud.mongodb.com/api/atlas/v1.0/clusters -credential $credentials
$json = (ConvertFrom-Json $resp.Content).results[0]
$groupId = $json.groupId
$orgID = $json.orgId

# Rewrite the Realm Service with the specified cluster name
$config="{
    `"name`": `"mongodb-atlas`",
    `"type`": `"mongodb-atlas`",
    `"config`": {
        `"clusterName`":`"$clusterName`",
        `"readPreference`": `"primary`",
        `"wireProtocolEnabled`": false
    },
    `"version`": 1
}"

Write-Output "$config" > ./data_sources/mongodb-atlas/config.json

# Import the Realm app
realm-cli login --api-key="$publicKeyProject" --private-api-key="$privateKeyProject"
realm-cli import --yes

# Write secrets to Realm app
realm-cli secrets create -n billing-orgSecret -v $orgID
realm-cli secrets create -n billing-usernameSecret -v $publicKeyOrg
realm-cli secrets create -n billing-passwordSecret -v $privateKeyOrg
realm-cli push --remote "billing" -y

# Run functions to retrieve billing data for the first time
Write-Output "Please wait a few seconds before we run the getall function ..."
Start-Sleep 30
realm-cli function run --name "getall"
Write-Output "Please wait a few seconds before we run the processall function ..."
realm-cli function run --name "processall"

# Next Steps
Write-Output "Setup Complete! Please log into Atlas and verify that data has been loaded into the cluster."
Write-Output "To visualize the billing data on a dashboard:"
Write-Output "1. Activate Charts in your Atlas project"
Write-Output "2. Add Data Sources for your billing collections"
Write-Output "3. Import the dashboard from the included file 'charts_billing_template.charts'"