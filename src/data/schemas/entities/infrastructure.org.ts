// Auto-generated — do not edit manually. Run `pnpm sync-entity-schemas` to regenerate.
// @ts-nocheck
// Synced: 2026-05-27T09:53:36.734Z | entity=infrastructure | scope=org

const schema: Record<string, any> = {
  "type": "object",
  "properties": {
    "infrastructureDefinition": {
      "$ref": "#/definitions/InfrastructureDefinitionConfig"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "AllHostsFilter": {
      "allOf": [
        {
          "$ref": "#/definitions/HostFilterSpec"
        },
        {
          "type": "object"
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactBundleStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "artifactBundleType",
            "deployableUnitPath",
            "manifestPath"
          ],
          "properties": {
            "artifactBundleType": {
              "type": "string",
              "enum": [
                "ZIP",
                "TAR",
                "TAR_GZIP"
              ]
            },
            "deployableUnitPath": {
              "type": "string"
            },
            "manifestPath": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactoryStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "repositoryName"
          ],
          "properties": {
            "artifactPaths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "repositoryName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AsgInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region"
          ],
          "properties": {
            "baseAsgName": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsInstanceFilter": {
      "type": "object",
      "properties": {
        "tags": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              }
            },
            {
              "type": "string"
            }
          ]
        },
        "vpcs": {
          "oneOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            {
              "type": "string",
              "pattern": "(<\\+.+>.*)",
              "minLength": 1
            }
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsLambdaInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSamInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureContainerAppsInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "managedEnvironment",
            "resourceGroup",
            "subscriptionId"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "managedEnvironment": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "resourceGroup": {
              "type": "string",
              "minLength": 1
            },
            "subscriptionId": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureFunctionInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "resourceGroup",
            "subscriptionId"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "resourceGroup": {
              "type": "string",
              "minLength": 1
            },
            "subscriptionId": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureWebAppInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "resourceGroup",
            "subscriptionId"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "resourceGroup": {
              "type": "string",
              "minLength": 1
            },
            "subscriptionId": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentConnectorNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/CustomDeploymentNGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
            },
            "type": {
              "type": "string",
              "enum": [
                "Connector"
              ]
            },
            "value": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "customDeploymentRef"
          ],
          "properties": {
            "customDeploymentRef": {
              "$ref": "#/definitions/StepTemplateRef",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "variables": {
              "type": "array",
              "items": {
                "oneOf": [
                  {
                    "$ref": "#/definitions/CustomDeploymentConnectorNGVariable"
                  },
                  {
                    "$ref": "#/definitions/CustomDeploymentNumberNGVariable"
                  },
                  {
                    "$ref": "#/definitions/CustomDeploymentSecretNGVariable"
                  },
                  {
                    "$ref": "#/definitions/CustomDeploymentStringNGVariable"
                  }
                ]
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentNGVariable": {
      "type": "object",
      "discriminator": "type",
      "properties": {
        "description": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "required": {
          "type": "boolean"
        },
        "type": {
          "type": "string",
          "enum": [
            "String",
            "Number",
            "Secret",
            "Connector"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentNumberNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/CustomDeploymentNGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
            },
            "type": {
              "type": "string",
              "enum": [
                "Number"
              ]
            },
            "value": {
              "oneOf": [
                {
                  "type": "number",
                  "format": "double"
                },
                {
                  "type": "string",
                  "pattern": "(^[+-]?[0-9]+\\.?[0-9]*$|(<\\+.+>.*)|^$)"
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentSecretNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/CustomDeploymentNGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
            },
            "type": {
              "type": "string",
              "enum": [
                "Secret"
              ]
            },
            "value": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomDeploymentStringNGVariable": {
      "allOf": [
        {
          "$ref": "#/definitions/CustomDeploymentNGVariable"
        },
        {
          "type": "object",
          "required": [
            "value"
          ],
          "properties": {
            "name": {
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
            },
            "type": {
              "type": "string",
              "enum": [
                "String"
              ]
            },
            "value": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomRemoteStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "extractionScript",
            "filePath"
          ],
          "properties": {
            "delegateSelectors": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "extractionScript": {
              "type": "string"
            },
            "filePath": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "EcsInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "cluster",
            "connectorRef",
            "region"
          ],
          "properties": {
            "cluster": {
              "type": "string",
              "minLength": 1
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ElastigroupConfiguration": {
      "type": "object",
      "required": [
        "store"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "store": {
          "$ref": "#/definitions/StoreConfigWrapper"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ElastigroupInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "configuration",
            "connectorRef"
          ],
          "properties": {
            "configuration": {
              "$ref": "#/definitions/ElastigroupConfiguration"
            },
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcsStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "bucketName": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "manifestPath": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitLabStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "connectorUrl": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "repoName": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "commitId"
              ]
            },
            {
              "required": [
                "branch"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "folderPath"
              ]
            },
            {
              "required": [
                "paths"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleCloudRunInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "project",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "project": {
              "type": "string",
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleFunctionsInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "project",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "project": {
              "type": "string",
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleMigInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "project",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "project": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string"
            },
            "zone": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessCodeStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "gitFetchType"
          ],
          "properties": {
            "branch": {
              "type": "string"
            },
            "commitId": {
              "type": "string"
            },
            "connectorRef": {
              "$ref": "#/definitions/ParameterFieldString"
            },
            "folderPath": {
              "type": "string"
            },
            "gitFetchType": {
              "type": "string",
              "enum": [
                "Branch",
                "Commit"
              ]
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            },
            "repoName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessStore": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "files": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "secretFiles": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HostAttributesFilter": {
      "allOf": [
        {
          "$ref": "#/definitions/HostFilterSpec"
        },
        {
          "type": "object",
          "properties": {
            "matchCriteria": {
              "type": "string",
              "enum": [
                "ANY",
                "ALL"
              ]
            },
            "value": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HostFilter": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "All",
            "HostNames",
            "HostAttributes"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "All"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AllHostsFilter"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "HostAttributes"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HostAttributesFilter"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "HostNames"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HostNamesFilter"
              }
            }
          }
        }
      ]
    },
    "HostFilterSpec": {
      "type": "object",
      "discriminator": "type",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "All",
            "HostNames",
            "HostAttributes"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HostGroup": {
      "type": "object",
      "required": [
        "credentialsRef"
      ],
      "properties": {
        "connectorRef": {
          "type": "string"
        },
        "credentialsRef": {
          "type": "string"
        },
        "hostFilter": {
          "$ref": "#/definitions/HostFilter"
        },
        "hosts": {
          "oneOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            {
              "type": "string"
            }
          ]
        },
        "identifier": {
          "type": "string"
        },
        "name": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HostNamesFilter": {
      "allOf": [
        {
          "$ref": "#/definitions/HostFilterSpec"
        },
        {
          "type": "object",
          "properties": {
            "value": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HttpStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "Infrastructure": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InfrastructureConfig": {
      "type": "object",
      "properties": {
        "infrastructureDefinition": {
          "$ref": "#/definitions/InfrastructureDefinitionConfig"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InfrastructureDefinitionConfig": {
      "type": "object",
      "required": [
        "deploymentType",
        "spec",
        "type",
        "orgIdentifier"
      ],
      "properties": {
        "allowSimultaneousDeployments": {
          "oneOf": [
            {
              "type": "boolean"
            },
            {
              "type": "string",
              "pattern": "(<\\+.+>.*)",
              "minLength": 1
            }
          ]
        },
        "deploymentType": {
          "type": "string",
          "enum": [
            "Kubernetes",
            "NativeHelm",
            "Ssh",
            "WinRm",
            "ServerlessAwsLambda",
            "AzureWebApp",
            "AzureFunction",
            "CustomDeployment",
            "ECS",
            "Elastigroup",
            "TAS",
            "Asg",
            "GoogleCloudFunctions",
            "AwsLambda",
            "AWS_SAM",
            "SERVICE_YAML_V1_TYPE",
            "GoogleCloudRun",
            "Salesforce",
            "GoogleManagedInstanceGroup",
            "AzureContainerApps"
          ]
        },
        "description": {
          "type": "string"
        },
        "environmentRef": {
          "type": "string"
        },
        "identifier": {
          "type": "string",
          "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
        },
        "metadata": {
          "type": "string"
        },
        "name": {
          "type": "string",
          "pattern": "^[a-zA-Z_0-9-.][-0-9a-zA-Z_\\s.]{0,127}$"
        },
        "orgIdentifier": {
          "type": "string"
        },
        "scopedServices": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "tags": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "type": {
          "type": "string",
          "enum": [
            "KubernetesDirect",
            "KubernetesGcp",
            "KubernetesAzure",
            "Pdc",
            "SshWinRmAzure",
            "ServerlessAwsLambda",
            "AzureWebApp",
            "AzureFunction",
            "SshWinRmAws",
            "CustomDeployment",
            "ECS",
            "Elastigroup",
            "TAS",
            "Asg",
            "GoogleCloudFunctions",
            "AWS_SAM",
            "AwsLambda",
            "KubernetesAws",
            "KubernetesRancher",
            "GoogleCloudRun",
            "Salesforce",
            "GoogleManagedInstanceGroup",
            "AzureContainerApps"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AWS_SAM"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSamInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Asg"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AsgInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsLambda"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsLambdaInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureContainerApps"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureContainerAppsInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureFunction"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureFunctionInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureWebApp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureWebAppInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomDeployment"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CustomDeploymentInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ECS"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/EcsInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Elastigroup"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ElastigroupInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudFunctions"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleFunctionsInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleCloudRun"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleCloudRunInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleManagedInstanceGroup"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleMigInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KubernetesAws"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/K8sAwsInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KubernetesAzure"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/K8sAzureInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KubernetesDirect"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/K8SDirectInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KubernetesGcp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/K8sGcpInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KubernetesRancher"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/K8sRancherInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Pdc"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/PdcInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Salesforce"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ServerlessAwsLambda"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ServerlessAwsLambdaInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SshWinRmAws"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SshWinRmAwsInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SshWinRmAzure"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SshWinRmAzureInfrastructure"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "TAS"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TanzuApplicationServiceInfrastructure"
              }
            }
          }
        }
      ]
    },
    "InheritFromManifestStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InlineStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "content"
          ],
          "properties": {
            "content": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "InputSetValidator": {
      "type": "object",
      "properties": {
        "parameters": {
          "type": "string"
        },
        "validatorType": {
          "type": "string",
          "enum": [
            "ALLOWED_VALUES",
            "REGEX",
            "SELECT_ONE_FROM",
            "SELECT_MANY_FROM"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "K8SDirectInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "namespace",
            "releaseName"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "namespace": {
              "oneOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ],
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "releaseName": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "K8sAwsInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "cluster",
            "connectorRef",
            "namespace",
            "releaseName"
          ],
          "properties": {
            "caCertData": {
              "type": "string"
            },
            "cluster": {
              "type": "string",
              "minLength": 1
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "endpoint": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "namespace": {
              "oneOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ],
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string"
            },
            "releaseName": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "K8sAzureInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "cluster",
            "connectorRef",
            "namespace",
            "releaseName",
            "resourceGroup",
            "subscriptionId"
          ],
          "properties": {
            "cluster": {
              "type": "string",
              "minLength": 1
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "namespace": {
              "oneOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ],
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "releaseName": {
              "type": "string",
              "minLength": 1
            },
            "resourceGroup": {
              "type": "string",
              "minLength": 1
            },
            "subscriptionId": {
              "type": "string",
              "minLength": 1
            },
            "useClusterAdminCredentials": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "K8sGcpInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "cluster",
            "connectorRef",
            "namespace",
            "releaseName"
          ],
          "properties": {
            "cluster": {
              "type": "string",
              "minLength": 1
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "namespace": {
              "oneOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ],
              "minLength": 1
            },
            "project": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "releaseName": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "K8sRancherInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "cluster",
            "connectorRef",
            "namespace",
            "releaseName"
          ],
          "properties": {
            "cluster": {
              "type": "string",
              "minLength": 1
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "namespace": {
              "oneOf": [
                {
                  "type": "string",
                  "pattern": "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ],
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "releaseName": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "basePath": {
              "type": "string"
            },
            "config": {
              "$ref": "#/definitions/OciHelmChartStoreConfigWrapper"
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartStoreConfig": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartStoreConfigWrapper": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "Generic",
            "ECR"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ECR"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmChartStoreEcrConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Generic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmChartStoreGenericConfig"
              }
            }
          }
        }
      ]
    },
    "OciHelmChartStoreEcrConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/OciHelmChartStoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "region": {
              "type": "string"
            },
            "registryId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmChartStoreGenericConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/OciHelmChartStoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "connectorRef": {
              "oneOf": [
                {
                  "$ref": "#/definitions/ParameterFieldString"
                },
                {
                  "type": "string"
                }
              ]
            },
            "metadata": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ParameterField": {
      "type": "object",
      "properties": {
        "defaultValue": {
          "type": "object"
        },
        "executionInput": {
          "type": "boolean"
        },
        "expression": {
          "type": "boolean"
        },
        "expressionValue": {
          "type": "string"
        },
        "inputSetValidator": {
          "$ref": "#/definitions/InputSetValidator"
        },
        "jsonResponseField": {
          "type": "boolean"
        },
        "responseField": {
          "type": "string"
        },
        "typeString": {
          "type": "boolean"
        },
        "value": {
          "type": "object"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ParameterFieldString": {
      "type": "object",
      "properties": {
        "defaultValue": {
          "type": "string"
        },
        "executionInput": {
          "type": "boolean"
        },
        "expression": {
          "type": "boolean"
        },
        "expressionValue": {
          "type": "string"
        },
        "inputSetValidator": {
          "$ref": "#/definitions/InputSetValidator"
        },
        "jsonResponseField": {
          "type": "boolean"
        },
        "responseField": {
          "type": "string"
        },
        "typeString": {
          "type": "boolean"
        },
        "value": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "PdcInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {}
      ],
      "$schema": "http://json-schema.org/draft-07/schema#",
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "credentialsRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "hostArrayPath": {
              "type": "string"
            },
            "hostAttributes": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                {
                  "type": "string"
                }
              ]
            },
            "hostFilter": {
              "$ref": "#/definitions/HostFilter"
            },
            "provisioner": {
              "type": "string"
            }
          },
          "required": [
            "hostArrayPath"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "credentialsRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "hostAttributes": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                {
                  "type": "string"
                }
              ]
            },
            "hostFilter": {
              "$ref": "#/definitions/HostFilter"
            },
            "hostGroups": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/HostGroup"
              }
            },
            "provisioner": {
              "type": "string"
            }
          },
          "required": [
            "hostGroups"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "credentialsRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "hostAttributes": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                {
                  "type": "string"
                }
              ]
            },
            "hostFilter": {
              "$ref": "#/definitions/HostFilter"
            },
            "provisioner": {
              "type": "string"
            }
          },
          "required": [
            "connectorRef"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "credentialsRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "hostAttributes": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                {
                  "type": "string"
                }
              ]
            },
            "hostFilter": {
              "$ref": "#/definitions/HostFilter"
            },
            "hosts": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string"
                }
              ]
            },
            "provisioner": {
              "type": "string"
            }
          },
          "required": [
            "hosts"
          ],
          "additionalProperties": false
        }
      ]
    },
    "S3StoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "properties": {
            "bucketName": {
              "type": "string"
            },
            "connectorRef": {
              "type": "string"
            },
            "folderPath": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "paths": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            },
            "region": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "S3UrlStoreConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/StoreConfig"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region",
            "urls"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "region": {
              "type": "string"
            },
            "urls": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "^<\\+input>((\\.)((executionInput\\(\\))|(allowedValues|default|regex)\\(.+?\\)))*$",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServerlessAwsLambdaInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "region",
            "stage"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "metadata": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            },
            "stage": {
              "type": "string",
              "minLength": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SshWinRmAwsInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "credentialsRef",
            "hostConnectionType",
            "region"
          ],
          "properties": {
            "asgName": {
              "type": "string"
            },
            "awsInstanceFilter": {
              "$ref": "#/definitions/AwsInstanceFilter"
            },
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "credentialsRef": {
              "type": "string",
              "minLength": 1
            },
            "hostConnectionType": {
              "type": "string",
              "enum": [
                "PublicIP",
                "PrivateIP"
              ],
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "region": {
              "type": "string",
              "minLength": 1
            },
            "targetedHosts": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SshWinRmAzureInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "credentialsRef",
            "hostConnectionType",
            "resourceGroup",
            "subscriptionId"
          ],
          "properties": {
            "connectorRef": {
              "type": "string",
              "minLength": 1
            },
            "credentialsRef": {
              "type": "string",
              "minLength": 1
            },
            "hostConnectionType": {
              "type": "string",
              "enum": [
                "Hostname",
                "PrivateIP",
                "PublicIP"
              ],
              "minLength": 1
            },
            "provisioner": {
              "type": "string"
            },
            "resourceGroup": {
              "type": "string",
              "minLength": 1
            },
            "subscriptionId": {
              "type": "string",
              "minLength": 1
            },
            "tags": {
              "oneOf": [
                {
                  "type": "object",
                  "additionalProperties": {
                    "type": "string"
                  }
                },
                {
                  "type": "string"
                }
              ]
            },
            "targetedHosts": {
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(<\\+.+>.*)",
                  "minLength": 1
                }
              ]
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "StepTemplateRef": {
      "type": "object",
      "required": [
        "templateRef"
      ],
      "properties": {
        "templateRef": {
          "type": "string"
        },
        "versionLabel": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "StoreConfig": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "StoreConfigWrapper": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "metadata": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "CustomRemote",
            "Git",
            "Github",
            "Bitbucket",
            "GitLab",
            "Http",
            "S3",
            "Gcs",
            "Inline",
            "Artifactory",
            "S3Url",
            "InheritFromManifest",
            "Harness",
            "OciHelmChart",
            "AzureRepo",
            "ArtifactBundle",
            "HarnessCode"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ArtifactBundle"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ArtifactBundleStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Artifactory"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ArtifactoryStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureRepo"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureRepoStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Bitbucket"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomRemote"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CustomRemoteStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Gcs"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcsStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Git"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GitLab"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitLabStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Github"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Harness"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "HarnessCode"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessCodeStore"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Http"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HttpStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "InheritFromManifest"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/InheritFromManifestStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Inline"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/InlineStoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OciHelmChart"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmChartConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "S3"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/S3StoreConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "S3Url"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/S3UrlStoreConfig"
              }
            }
          }
        }
      ]
    },
    "TanzuApplicationServiceInfrastructure": {
      "allOf": [
        {
          "$ref": "#/definitions/Infrastructure"
        },
        {
          "type": "object",
          "required": [
            "connectorRef",
            "organization",
            "space"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "metadata": {
              "type": "string"
            },
            "organization": {
              "type": "string"
            },
            "provisioner": {
              "type": "string"
            },
            "space": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
};

export default schema;
export const meta = {
  "resourceType": "infrastructure",
  "scope": "org",
  "syncedAt": "2026-05-27T09:53:36.734Z",
  "accountId": "VpehPBwPQ9qKsX-xDP8SFg",
  "orgId": "default",
  "projectId": "aidevops"
};
