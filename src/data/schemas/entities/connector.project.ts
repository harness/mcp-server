// Auto-generated — do not edit manually. Run `pnpm sync-entity-schemas` to regenerate.
// @ts-nocheck
// Synced: 2026-05-27T09:53:36.734Z | entity=connector | scope=project

const schema: Record<string, any> = {
  "type": "object",
  "properties": {
    "connector": {
      "$ref": "#/definitions/ConnectorInfoDTO"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "AnthropicAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AnthropicAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Token",
            "BedrockApiKey"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "BedrockApiKey"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AnthropicBedrockApiKeyCredentialsDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AnthropicTokenCredentialsDTO"
              }
            }
          }
        }
      ]
    },
    "AnthropicBedrockApiKeyCredentialsDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/AnthropicAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "apiKeyRef",
            "region"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            },
            "region": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AnthropicConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication"
          ],
          "properties": {
            "authentication": {
              "$ref": "#/definitions/AnthropicAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "model": {
              "type": "string"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AnthropicTokenCredentialsDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/AnthropicAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AppDynamicsConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "accountname",
            "controllerUrl"
          ],
          "properties": {
            "accountname": {
              "type": "string"
            },
            "authType": {
              "type": "string",
              "enum": [
                "UsernamePassword",
                "ApiClientToken"
              ]
            },
            "clientId": {
              "type": "string"
            },
            "clientSecretRef": {
              "type": "string"
            },
            "controllerUrl": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactoryAuthCredentials": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactoryAuthentication": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ArtifactoryOidcAuth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ArtifactoryUsernamePasswordAuth"
              }
            }
          }
        }
      ]
    },
    "ArtifactoryConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "artifactoryServerUrl"
          ],
          "properties": {
            "artifactoryServerUrl": {
              "type": "string"
            },
            "auth": {
              "$ref": "#/definitions/ArtifactoryAuthentication"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactoryOidcAuth": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactoryAuthCredentials"
        },
        {
          "type": "object",
          "properties": {
            "audience": {
              "type": "string"
            },
            "projectKey": {
              "type": "string"
            },
            "providerName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ArtifactoryUsernamePasswordAuth": {
      "allOf": [
        {
          "$ref": "#/definitions/ArtifactoryAuthCredentials"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCodeCommitAuthenticationDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "HTTPS"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "HTTPS"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsCodeCommitHttpsCredentialsDTO"
              }
            }
          }
        }
      ]
    },
    "AwsCodeCommitConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication",
            "type",
            "url"
          ],
          "properties": {
            "authentication": {
              "$ref": "#/definitions/AwsCodeCommitAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Repo",
                "Region"
              ]
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCodeCommitCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCodeCommitHttpsCredentialsDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsCodeCommitCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "spec",
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "AWSCredentials"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AWSCredentials"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsCodeCommitSecretKeyAccessKeyDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCodeCommitHttpsCredentialsSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCodeCommitSecretKeyAccessKeyDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsCodeCommitHttpsCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "secretKeyRef"
          ],
          "properties": {
            "accessKey": {
              "type": "string"
            },
            "accessKeyRef": {
              "type": "string"
            },
            "secretKeyRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "accessKey"
              ]
            },
            {
              "required": [
                "accessKeyRef"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential"
          ],
          "properties": {
            "awsSdkClientBackOffStrategyOverride": {
              "$ref": "#/definitions/AwsSdkClientBackoffStrategy"
            },
            "credential": {
              "$ref": "#/definitions/AwsCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "crossAccountAccess": {
          "$ref": "#/definitions/CrossAccountAccess"
        },
        "region": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "InheritFromDelegate",
            "ManualConfig",
            "Irsa",
            "OidcAuthentication",
            "CredentialBroker"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "CredentialBroker"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsCredentialBrokerSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsManualConfigSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsOidcSpec"
              }
            }
          }
        }
      ]
    },
    "AwsCredentialBrokerSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "mapping",
            "signedSecretRef"
          ],
          "properties": {
            "mapping": {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              }
            },
            "payload": {
              "type": "string"
            },
            "signedSecretRef": {
              "type": "string"
            },
            "skipTls": {
              "type": "boolean"
            },
            "timeoutSeconds": {
              "type": "integer",
              "format": "int32"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsCurAttributes": {
      "type": "object",
      "required": [
        "reportName",
        "s3BucketName"
      ],
      "properties": {
        "region": {
          "type": "string"
        },
        "reportName": {
          "type": "string"
        },
        "reportType": {
          "type": "string",
          "enum": [
            "CUR1.0",
            "CUR2.0",
            "FOCUSv1.3"
          ]
        },
        "s3BucketName": {
          "type": "string"
        },
        "s3Prefix": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsEqualJitterBackoffStrategy": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsSdkClientBackOffStrategySpec"
        },
        {
          "type": "object",
          "properties": {
            "baseDelay": {
              "type": "integer",
              "format": "int64"
            },
            "maxBackoffTime": {
              "type": "integer",
              "format": "int64"
            },
            "retryCount": {
              "type": "integer",
              "format": "int32"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsFixedDelayBackoffStrategy": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsSdkClientBackOffStrategySpec"
        },
        {
          "type": "object",
          "properties": {
            "fixedBackoff": {
              "type": "integer",
              "format": "int64"
            },
            "retryCount": {
              "type": "integer",
              "format": "int32"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsFullJitterBackoffStrategy": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsSdkClientBackOffStrategySpec"
        },
        {
          "type": "object",
          "properties": {
            "baseDelay": {
              "type": "integer",
              "format": "int64"
            },
            "maxBackoffTime": {
              "type": "integer",
              "format": "int64"
            },
            "retryCount": {
              "type": "integer",
              "format": "int32"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsKmsConnectorCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "AssumeIAMRole",
            "AssumeSTSRole",
            "ManualConfig",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AssumeIAMRole"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsKmsCredentialSpecAssumeIAM"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AssumeSTSRole"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsKmsCredentialSpecAssumeSTS"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsKmsCredentialSpecManualConfig"
              }
            }
          }
        }
      ]
    },
    "AwsKmsConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential",
            "region"
          ],
          "properties": {
            "awsOidcTokenExchangeDetailsForDelegate": {
              "$ref": "#/definitions/AwsOidcTokenExchangeDetailsForDelegate"
            },
            "credential": {
              "$ref": "#/definitions/AwsKmsConnectorCredential"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "kmsArn": {
              "type": "string"
            },
            "kmsArnInPlainText": {
              "type": "string"
            },
            "region": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "kmsArnInPlainText"
              ]
            },
            {
              "required": [
                "kmsArn"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsKmsCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsKmsCredentialSpecAssumeIAM": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsKmsCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "delegateSelectors"
          ],
          "properties": {
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              },
              "maxItems": 2147483647,
              "minItems": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsKmsCredentialSpecAssumeSTS": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsKmsCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "delegateSelectors",
            "roleArn"
          ],
          "properties": {
            "assumeStsRoleDuration": {
              "type": "integer",
              "format": "int32"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              },
              "maxItems": 2147483647,
              "minItems": 1
            },
            "externalName": {
              "type": "string"
            },
            "roleArn": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsKmsCredentialSpecManualConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsKmsCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "accessKey",
            "secretKey"
          ],
          "properties": {
            "accessKey": {
              "type": "string"
            },
            "secretKey": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsManualConfigSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "secretKeyRef"
          ],
          "properties": {
            "accessKey": {
              "type": "string"
            },
            "accessKeyRef": {
              "type": "string"
            },
            "secretKeyRef": {
              "type": "string"
            },
            "sessionTokenRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "accessKey"
              ]
            },
            {
              "required": [
                "accessKeyRef"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsOidcSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "iamRoleArn": {
              "type": "string"
            },
            "oidcSessionTagKeys": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsOidcTokenExchangeDetailsForDelegate": {
      "type": "object",
      "properties": {
        "idTokenExpiryTime": {
          "type": "integer",
          "format": "int64"
        },
        "oidcIdToken": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSMCredentialSpecAssumeIAM": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsSecretManagerCredentialSpec"
        },
        {
          "type": "object"
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSMCredentialSpecAssumeSTS": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsSecretManagerCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "roleArn"
          ],
          "properties": {
            "assumeStsRoleDuration": {
              "type": "integer",
              "format": "int32"
            },
            "externalId": {
              "type": "string"
            },
            "roleArn": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSMCredentialSpecManualConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/AwsSecretManagerCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "secretKey"
          ],
          "properties": {
            "accessKey": {
              "type": "string"
            },
            "accessKeyPlainText": {
              "type": "string"
            },
            "secretKey": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSdkClientBackOffStrategySpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSdkClientBackoffStrategy": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "FixedDelayBackoffStrategy",
            "EqualJitterBackoffStrategy",
            "FullJitterBackoffStrategy"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "EqualJitterBackoffStrategy"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsEqualJitterBackoffStrategy"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "FixedDelayBackoffStrategy"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsFixedDelayBackoffStrategy"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "FullJitterBackoffStrategy"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsFullJitterBackoffStrategy"
              }
            }
          }
        }
      ]
    },
    "AwsSecretManagerCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "AssumeIAMRole",
            "AssumeSTSRole",
            "ManualConfig",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AssumeIAMRole"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSMCredentialSpecAssumeIAM"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AssumeSTSRole"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSMCredentialSpecAssumeSTS"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSMCredentialSpecManualConfig"
              }
            }
          }
        }
      ]
    },
    "AwsSecretManagerCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AwsSecretManagerDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential",
            "region"
          ],
          "properties": {
            "awsOidcTokenExchangeDetailsForDelegate": {
              "$ref": "#/definitions/AwsOidcTokenExchangeDetailsForDelegate"
            },
            "credential": {
              "$ref": "#/definitions/AwsSecretManagerCredential"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "forceDeleteWithoutRecovery": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "recoveryWindowInDays": {
              "type": "integer",
              "format": "int64"
            },
            "region": {
              "type": "string"
            },
            "secretNamePrefix": {
              "type": "string"
            },
            "usePutSecret": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureArtifactsAuthentication": {
      "type": "object",
      "required": [
        "spec"
      ],
      "properties": {
        "spec": {
          "$ref": "#/definitions/AzureArtifactsHttpCredentials"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureArtifactsConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "auth",
            "azureArtifactsUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/AzureArtifactsAuthentication"
            },
            "azureArtifactsUrl": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureArtifactsHttpCredentials": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "spec": {
          "$ref": "#/definitions/AzureArtifactsUsernameToken"
        },
        "type": {
          "type": "string",
          "enum": [
            "PersonalAccessToken"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureArtifactsUsernameToken": {
      "type": "object",
      "required": [
        "tokenRef"
      ],
      "properties": {
        "tokenRef": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureAuthCredentialDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureAuthDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Secret",
            "Certificate"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Certificate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureClientKeyCertDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Secret"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureClientSecretKeyDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SystemAssignedManagedIdentity"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureSystemAssignedMSIAuth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UserAssignedManagedIdentity"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureUserAssignedMSIAuth"
              }
            }
          }
        }
      ]
    },
    "AzureClientKeyCertDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "certificateRef"
          ],
          "properties": {
            "certificateRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureClientSecretKeyDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "secretRef"
          ],
          "properties": {
            "secretRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "azureEnvironmentType",
            "credential"
          ],
          "properties": {
            "azureEnvironmentType": {
              "type": "string",
              "enum": [
                "AZURE",
                "AZURE_US_GOVERNMENT"
              ]
            },
            "credential": {
              "$ref": "#/definitions/AzureCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "InheritFromDelegate",
            "ManualConfig",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "InheritFromDelegate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureInheritFromDelegateDetails"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureManualDetails"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureOidcSpec"
              }
            }
          }
        }
      ]
    },
    "AzureCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureInheritFromDelegateDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "auth"
          ],
          "properties": {
            "auth": {
              "readOnly": true,
              "$ref": "#/definitions/AzureMSIAuth"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureKeyVaultConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "subscription",
            "vaultName"
          ],
          "properties": {
            "azureEnvironmentType": {
              "type": "string",
              "enum": [
                "AZURE",
                "AZURE_US_GOVERNMENT"
              ]
            },
            "azureManagedIdentityType": {
              "type": "string",
              "enum": [
                "SystemAssignedManagedIdentity",
                "UserAssignedManagedIdentity"
              ]
            },
            "clientId": {
              "type": "string"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "enablePurge": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "managedClientId": {
              "type": "string"
            },
            "secretKey": {
              "type": "string"
            },
            "subscription": {
              "type": "string"
            },
            "tenantId": {
              "type": "string"
            },
            "useManagedIdentity": {
              "type": "boolean"
            },
            "vaultConfiguredManually": {
              "type": "boolean"
            },
            "vaultName": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureMSIAuth": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureManualDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "applicationId",
            "auth",
            "tenantId"
          ],
          "properties": {
            "applicationId": {
              "type": "string",
              "readOnly": true
            },
            "auth": {
              "readOnly": true,
              "$ref": "#/definitions/AzureAuthDTO"
            },
            "tenantId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureOidcSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "applicationId": {
              "type": "string",
              "readOnly": true
            },
            "audience": {
              "type": "string"
            },
            "tenantId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoApiAccess": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Token"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureRepoTokenSpec"
              }
            }
          }
        }
      ]
    },
    "AzureRepoApiAccessSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoAuthentication": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Http",
            "Ssh"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
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
                "$ref": "#/definitions/AzureRepoHttpCredentials"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Ssh"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureRepoSshCredentials"
              }
            }
          }
        }
      ]
    },
    "AzureRepoConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication",
            "type",
            "url"
          ],
          "properties": {
            "apiAccess": {
              "$ref": "#/definitions/AzureRepoApiAccess"
            },
            "authentication": {
              "$ref": "#/definitions/AzureRepoAuthentication"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Project",
                "Repo"
              ]
            },
            "url": {
              "type": "string"
            },
            "validationRepo": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoHttpCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureRepoCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "spec",
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "UsernameToken"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernameToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureRepoUsernameToken"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoHttpCredentialsSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoSshCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureRepoCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "sshKeyRef"
          ],
          "properties": {
            "sshKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoTokenSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureRepoApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureRepoUsernameToken": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureRepoHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureSystemAssignedMSIAuth": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureAuthCredentialDTO"
        },
        {
          "type": "object"
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "AzureUserAssignedMSIAuth": {
      "allOf": [
        {
          "$ref": "#/definitions/AzureAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "clientId"
          ],
          "properties": {
            "clientId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BambooAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BambooAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous",
            "Bearer Token(HTTP Header)"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BambooUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "BambooConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "bambooUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/BambooAuthenticationDTO"
            },
            "bambooUrl": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BambooUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/BambooAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BillingExportSpec": {
      "type": "object",
      "required": [
        "containerName",
        "directoryName",
        "reportName",
        "storageAccountName",
        "subscriptionId"
      ],
      "properties": {
        "billingType": {
          "type": "string",
          "enum": [
            "ACTUAL",
            "AMORTIZED"
          ]
        },
        "containerName": {
          "type": "string"
        },
        "directoryName": {
          "type": "string"
        },
        "reportName": {
          "type": "string"
        },
        "storageAccountName": {
          "type": "string"
        },
        "subscriptionId": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketAccessTokenApiAccess": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketApiAccess": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernameToken",
            "OAuth",
            "AccessToken",
            "EmailAndApiToken"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AccessToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketAccessTokenApiAccess"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "EmailAndApiToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketEmailApiTokenApiAccess"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OAuth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketOauth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernameToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketUsernameTokenApiAccess"
              }
            }
          }
        }
      ]
    },
    "BitbucketApiAccessSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketAuthentication": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Http",
            "Ssh"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
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
                "$ref": "#/definitions/BitbucketHttpCredentials"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Ssh"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketSshCredentials"
              }
            }
          }
        }
      ]
    },
    "BitbucketConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication",
            "type",
            "url"
          ],
          "properties": {
            "apiAccess": {
              "$ref": "#/definitions/BitbucketApiAccess"
            },
            "authentication": {
              "$ref": "#/definitions/BitbucketAuthentication"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Account",
                "Repo",
                "Project"
              ]
            },
            "url": {
              "type": "string"
            },
            "validationRepo": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketEmailApiTokenApiAccess": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "email": {
              "type": "string"
            },
            "emailRef": {
              "type": "string"
            },
            "tokenRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "emailRef"
              ]
            },
            {
              "required": [
                "email"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketHttpCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "spec",
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "UsernamePassword"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BitbucketUsernamePassword"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketHttpCredentialsSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketOauth": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "refreshTokenRef",
            "tokenRef"
          ],
          "properties": {
            "refreshTokenRef": {
              "type": "string"
            },
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketSshCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "sshKeyRef"
          ],
          "properties": {
            "sshKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketUsernamePassword": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "BitbucketUsernameTokenApiAccess": {
      "allOf": [
        {
          "$ref": "#/definitions/BitbucketApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CEAwsConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "properties": {
            "autostoppingFeatures": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "EC2",
                  "SPOT",
                  "ASG",
                  "ECS",
                  "RDS",
                  "ALB",
                  "PROXY",
                  "AZURE_VM",
                  "AZURE_APP_GATEWAY",
                  "GCP_VM",
                  "GCP_INSTANCE_GROUP"
                ]
              }
            },
            "awsAccountId": {
              "type": "string"
            },
            "commitmentFeatures": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "EC2",
                  "RDS",
                  "ElastiCache"
                ]
              }
            },
            "credential": {
              "$ref": "#/definitions/CeAwsCredential"
            },
            "crossAccountAccess": {
              "$ref": "#/definitions/CrossAccountAccess"
            },
            "curAttributes": {
              "$ref": "#/definitions/AwsCurAttributes"
            },
            "featuresEnabled": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "BILLING",
                  "OPTIMIZATION",
                  "VISIBILITY",
                  "GOVERNANCE",
                  "COMMITMENT_ORCHESTRATOR",
                  "CLUSTER_ORCHESTRATOR"
                ]
              },
              "minLength": 1
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "isAWSGovCloudAccount": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CEAzureConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "subscriptionId",
            "tenantId"
          ],
          "properties": {
            "autostoppingFeatures": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "EC2",
                  "SPOT",
                  "ASG",
                  "ECS",
                  "RDS",
                  "ALB",
                  "PROXY",
                  "AZURE_VM",
                  "AZURE_APP_GATEWAY",
                  "GCP_VM",
                  "GCP_INSTANCE_GROUP"
                ]
              }
            },
            "billingExportSpec": {
              "$ref": "#/definitions/BillingExportSpec"
            },
            "billingExportSpec2": {
              "$ref": "#/definitions/BillingExportSpec"
            },
            "featuresEnabled": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "BILLING",
                  "OPTIMIZATION",
                  "VISIBILITY",
                  "GOVERNANCE",
                  "COMMITMENT_ORCHESTRATOR",
                  "CLUSTER_ORCHESTRATOR"
                ]
              },
              "minLength": 1
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "subscriptionId": {
              "type": "string"
            },
            "tenantId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CEKubernetesClusterConfig": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "connectorRef"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "featuresEnabled": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "BILLING",
                  "OPTIMIZATION",
                  "VISIBILITY",
                  "GOVERNANCE",
                  "COMMITMENT_ORCHESTRATOR",
                  "CLUSTER_ORCHESTRATOR"
                ]
              },
              "minLength": 1
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CeAwsCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "region": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "Default",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CeAwsOidcSpec"
              }
            }
          }
        }
      ]
    },
    "CeAwsCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CeAwsOidcSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/CeAwsCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "iamRoleArn": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConfluenceConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiAccessType"
          ],
          "properties": {
            "accessTokenRef": {
              "type": "string"
            },
            "apiAccessType": {
              "type": "string",
              "enum": [
                "TOKEN",
                "OAUTH"
              ]
            },
            "apiKeyRef": {
              "type": "string"
            },
            "confluenceUrl": {
              "type": "string"
            },
            "emailId": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "refreshTokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "Connector": {
      "type": "object",
      "properties": {
        "connector": {
          "$ref": "#/definitions/ConnectorInfoDTO"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConnectorConfigDTO": {
      "type": "object",
      "discriminator": "connectorType",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ConnectorInfoDTO": {
      "type": "object",
      "required": [
        "identifier",
        "name",
        "spec",
        "type",
        "orgIdentifier",
        "projectIdentifier"
      ],
      "properties": {
        "accountIdentifier": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "identifier": {
          "type": "string",
          "pattern": "^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$",
          "description": "Identifier can be up to 128 characters long."
        },
        "name": {
          "type": "string"
        },
        "orgIdentifier": {
          "type": "string"
        },
        "parentUniqueId": {
          "type": "string"
        },
        "projectIdentifier": {
          "type": "string"
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
            "K8sCluster",
            "Git",
            "Splunk",
            "AppDynamics",
            "Prometheus",
            "Dynatrace",
            "Vault",
            "AzureKeyVault",
            "DockerRegistry",
            "Local",
            "AwsKms",
            "GcpKms",
            "AwsSecretManager",
            "Gcp",
            "Aws",
            "Azure",
            "Artifactory",
            "Jira",
            "Nexus",
            "Github",
            "Gitlab",
            "Bitbucket",
            "Codecommit",
            "CEAws",
            "CEAzure",
            "GcpCloudCost",
            "CEK8sCluster",
            "HttpHelmRepo",
            "NewRelic",
            "Datadog",
            "SumoLogic",
            "PagerDuty",
            "CustomHealth",
            "ServiceNow",
            "ErrorTracking",
            "Pdc",
            "AzureRepo",
            "Jenkins",
            "OciHelmRepo",
            "CustomSecretManager",
            "ElasticSearch",
            "GcpSecretManager",
            "AzureArtifacts",
            "Tas",
            "Spot",
            "Bamboo",
            "TerraformCloud",
            "SignalFX",
            "Harness",
            "Rancher",
            "JDBC",
            "Zoom",
            "MsTeams",
            "Confluence",
            "Slack",
            "Salesforce",
            "LangSmith",
            "MLFlow",
            "OpsGenie",
            "GithubMcp",
            "Mcp",
            "OpenAI",
            "Anthropic",
            "GoogleChat",
            "XMatters"
          ]
        },
        "uniqueId": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Anthropic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AnthropicConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AppDynamics"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AppDynamicsConnectorDTO"
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
                "$ref": "#/definitions/ArtifactoryConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Aws"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsKms"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsKmsConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AwsSecretManager"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsSecretManagerDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Azure"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureArtifacts"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureArtifactsConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "AzureKeyVault"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AzureKeyVaultConnectorDTO"
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
                "$ref": "#/definitions/AzureRepoConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Bamboo"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/BambooConnectorDTO"
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
                "$ref": "#/definitions/BitbucketConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CEAws"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CEAwsConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CEAzure"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CEAzureConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CEK8sCluster"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CEKubernetesClusterConfig"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Codecommit"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsCodeCommitConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Confluence"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ConfluenceConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomHealth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CustomHealthConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomSecretManager"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/CustomSecretManager"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Datadog"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/DatadogConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "DockerRegistry"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/DockerConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Dynatrace"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/DynatraceConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ElasticSearch"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ELKConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ErrorTracking"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ErrorTrackingConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Gcp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GcpCloudCost"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpCloudCostConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GcpKms"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpKmsConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GcpSecretManager"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpSecretManager"
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
                "$ref": "#/definitions/GitConfigDTO"
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
                "$ref": "#/definitions/GithubConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GithubMcp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitHubMcpConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Gitlab"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GoogleChat"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GoogleChatConnector"
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
                "$ref": "#/definitions/HarnessConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "HttpHelmRepo"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HttpHelmConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "JDBC"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Jenkins"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JenkinsConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Jira"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JiraConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "K8sCluster"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesClusterConfigDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "LangSmith"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/LangSmithConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Local"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/LocalConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "MLFlow"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MLFlowConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Mcp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MCPConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "MsTeams"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MsTeamsConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "NewRelic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NewRelicConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Nexus"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OciHelmRepo"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OpenAI"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OpenAIConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OpsGenie"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OpsGenieConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "PagerDuty"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/PagerDutyConnectorDTO"
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
                "$ref": "#/definitions/PhysicalDataCenterConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Prometheus"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/PrometheusConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Rancher"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/RancherConnectorDTO"
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
                "$ref": "#/definitions/SalesforceConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ServiceNow"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ServiceNowConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SignalFX"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SignalFXConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Slack"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SlackConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Splunk"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SplunkConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Spot"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SpotConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SumoLogic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SumoLogicConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Tas"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TasConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "TerraformCloud"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TerraformCloudConnector"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Vault"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/VaultConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "XMatters"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/XMattersConnectorDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Zoom"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ZoomConnector"
              }
            }
          }
        }
      ]
    },
    "CrossAccountAccess": {
      "type": "object",
      "required": [
        "crossAccountRoleArn"
      ],
      "properties": {
        "assumeRoleSessionDuration": {
          "type": "integer",
          "format": "int32"
        },
        "crossAccountRoleArn": {
          "type": "string"
        },
        "externalId": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomHealthConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "baseURL",
            "method"
          ],
          "properties": {
            "baseURL": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "headers": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/CustomHealthKeyAndValue"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "method": {
              "type": "string",
              "enum": [
                "GET",
                "POST"
              ]
            },
            "params": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/CustomHealthKeyAndValue"
              }
            },
            "validationBody": {
              "type": "string"
            },
            "validationPath": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomHealthKeyAndValue": {
      "type": "object",
      "required": [
        "key"
      ],
      "properties": {
        "encryptedValueRef": {
          "type": "string"
        },
        "key": {
          "type": "string"
        },
        "value": {
          "type": "string"
        },
        "valueEncrypted": {
          "type": "boolean"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "CustomSecretManager": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "template"
          ],
          "properties": {
            "connectorRef": {
              "type": "string"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "host": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "onDelegate": {
              "type": "boolean"
            },
            "template": {
              "$ref": "#/definitions/TemplateLinkConfigForCustomSecretManager"
            },
            "timeout": {
              "type": "integer",
              "format": "int64",
              "minimum": 1,
              "maximum": 3600
            },
            "workingDirectory": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "DatadogConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiKeyRef",
            "applicationKeyRef",
            "url"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            },
            "applicationKeyRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "DockerAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "DockerAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/DockerUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "DockerConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "dockerRegistryUrl",
            "providerType"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/DockerAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "dockerRegistryUrl": {
              "type": "string"
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "providerType": {
              "type": "string",
              "enum": [
                "DockerHub",
                "Harbor",
                "Quay",
                "Other"
              ]
            },
            "proxy": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "DockerUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/DockerAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "DynatraceConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "properties": {
            "apiTokenRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "platformTokenRef": {
              "type": "string"
            },
            "platformUrl": {
              "type": "string"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ELKConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "url"
          ],
          "properties": {
            "apiKeyId": {
              "type": "string"
            },
            "apiKeyRef": {
              "type": "string"
            },
            "authType": {
              "type": "string",
              "enum": [
                "UsernamePassword",
                "ApiClientToken",
                "None",
                "Bearer Token(HTTP Header)"
              ]
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "passwordRef": {
              "type": "string"
            },
            "url": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ErrorTrackingConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiKeyRef",
            "url"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpBillingExportSpec": {
      "type": "object",
      "required": [
        "datasetId",
        "tableId"
      ],
      "properties": {
        "datasetId": {
          "type": "string"
        },
        "tableId": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpCcmConnectorCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Default",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpCcmOidcDetails"
              }
            }
          }
        }
      ]
    },
    "GcpCcmCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpCcmOidcDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/GcpCcmCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "gcpProjectId": {
              "type": "string"
            },
            "providerId": {
              "type": "string"
            },
            "serviceAccountEmail": {
              "type": "string"
            },
            "workloadPoolId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpCloudCostConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "projectId",
            "serviceAccountEmail"
          ],
          "properties": {
            "autostoppingFeatures": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "EC2",
                  "SPOT",
                  "ASG",
                  "ECS",
                  "RDS",
                  "ALB",
                  "PROXY",
                  "AZURE_VM",
                  "AZURE_APP_GATEWAY",
                  "GCP_VM",
                  "GCP_INSTANCE_GROUP"
                ]
              }
            },
            "billingExportSpec": {
              "$ref": "#/definitions/GcpBillingExportSpec"
            },
            "credential": {
              "$ref": "#/definitions/GcpCcmConnectorCredential"
            },
            "featuresEnabled": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "BILLING",
                  "OPTIMIZATION",
                  "VISIBILITY",
                  "GOVERNANCE",
                  "COMMITMENT_ORCHESTRATOR",
                  "CLUSTER_ORCHESTRATOR"
                ]
              },
              "minLength": 1
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "projectId": {
              "type": "string"
            },
            "serviceAccountEmail": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential"
          ],
          "properties": {
            "credential": {
              "$ref": "#/definitions/GcpConnectorCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpConnectorCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "InheritFromDelegate",
            "ManualConfig",
            "OidcAuthentication"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "InheritFromDelegate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpDelegateDetails"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpManualDetails"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GcpOidcDetails"
              }
            }
          }
        }
      ]
    },
    "GcpCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpDelegateDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/GcpCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "delegateSelectors"
          ],
          "properties": {
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              },
              "maxItems": 2147483647,
              "minItems": 1
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpKmsConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "keyName",
            "keyRing",
            "projectId",
            "region"
          ],
          "properties": {
            "credentials": {
              "type": "string"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "gcpOidcTokenExchangeDetailsForDelegate": {
              "$ref": "#/definitions/GcpOidcTokenExchangeDetailsForDelegate"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "keyName": {
              "type": "string"
            },
            "keyRing": {
              "type": "string"
            },
            "oidcDetails": {
              "$ref": "#/definitions/GcpOidcDetails"
            },
            "projectId": {
              "type": "string"
            },
            "region": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpManualDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/GcpCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "secretKeyRef"
          ],
          "properties": {
            "secretKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpOidcDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/GcpCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "gcpProjectId": {
              "type": "string"
            },
            "providerId": {
              "type": "string"
            },
            "serviceAccountEmail": {
              "type": "string"
            },
            "workloadPoolId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpOidcTokenExchangeDetailsForDelegate": {
      "type": "object",
      "properties": {
        "gcpServiceAccountEmail": {
          "type": "string"
        },
        "idTokenExpiryTime": {
          "type": "integer",
          "format": "int64"
        },
        "oidcAccessTokenIamSaEndpoint": {
          "type": "string"
        },
        "oidcAccessTokenStsEndpoint": {
          "type": "string"
        },
        "oidcChartmuseumGcpConfigStructure": {
          "$ref": "#/definitions/OidcChartmuseumGcpConfig"
        },
        "oidcIdToken": {
          "type": "string"
        },
        "oidcWorkloadAccessTokenRequestStructure": {
          "$ref": "#/definitions/OidcWorkloadAccessTokenRequest"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GcpSecretManager": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "properties": {
            "assumeCredentialsOnDelegate": {
              "type": "boolean"
            },
            "credential": {
              "$ref": "#/definitions/GcpConnectorCredential"
            },
            "credentialsRef": {
              "type": "string"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "gcpOidcTokenExchangeDetailsForDelegate": {
              "$ref": "#/definitions/GcpOidcTokenExchangeDetailsForDelegate"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitAuthenticationDTO": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitConfigDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "connectionType",
            "spec",
            "type",
            "url"
          ],
          "properties": {
            "branchName": {
              "type": "string"
            },
            "connectionType": {
              "type": "string",
              "enum": [
                "Account",
                "Repo",
                "Project"
              ]
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "isAnonymous": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Http",
                "Ssh"
              ]
            },
            "url": {
              "type": "string"
            },
            "validationRepo": {
              "type": "string"
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
                "$ref": "#/definitions/GitHTTPAuthenticationDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Ssh"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitSSHAuthenticationDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitHTTPAuthenticationDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/GitAuthenticationDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitHubMcpAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitHubMcpAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Token",
            "OAuth"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "OAuth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitHubMcpOAuthDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitHubMcpTokenDTO"
              }
            }
          }
        }
      ]
    },
    "GitHubMcpConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "url"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/GitHubMcpAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitHubMcpOAuthDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/GitHubMcpAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitHubMcpTokenDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/GitHubMcpAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitSSHAuthenticationDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/GitAuthenticationDTO"
        },
        {
          "type": "object",
          "required": [
            "sshKeyRef"
          ],
          "properties": {
            "sshKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubApiAccess": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "GithubApp",
            "Token",
            "OAuth"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "GithubApp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubAppSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OAuth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubOauth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubTokenSpec"
              }
            }
          }
        }
      ]
    },
    "GithubApiAccessSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubApp": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "privateKeyRef"
          ],
          "properties": {
            "applicationId": {
              "type": "string"
            },
            "applicationIdRef": {
              "type": "string"
            },
            "installationId": {
              "type": "string"
            },
            "installationIdRef": {
              "type": "string"
            },
            "privateKeyRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "applicationIdRef"
              ]
            },
            {
              "required": [
                "applicationId"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "installationIdRef"
              ]
            },
            {
              "required": [
                "installationId"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubAppSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "privateKeyRef"
          ],
          "properties": {
            "applicationId": {
              "type": "string"
            },
            "applicationIdRef": {
              "type": "string"
            },
            "installationId": {
              "type": "string"
            },
            "installationIdRef": {
              "type": "string"
            },
            "privateKeyRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "applicationIdRef"
              ]
            },
            {
              "required": [
                "applicationId"
              ]
            }
          ]
        },
        {
          "oneOf": [
            {
              "required": [
                "installationIdRef"
              ]
            },
            {
              "required": [
                "installationId"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubAuthentication": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Http",
            "Ssh"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
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
                "$ref": "#/definitions/GithubHttpCredentials"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Ssh"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubSshCredentials"
              }
            }
          }
        }
      ]
    },
    "GithubConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication",
            "type",
            "url"
          ],
          "properties": {
            "apiAccess": {
              "$ref": "#/definitions/GithubApiAccess"
            },
            "authentication": {
              "$ref": "#/definitions/GithubAuthentication"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Account",
                "Repo",
                "Project"
              ]
            },
            "url": {
              "type": "string"
            },
            "validationRepo": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubHttpCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "UsernamePassword",
                "UsernameToken",
                "OAuth",
                "GithubApp",
                "Anonymous"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "GithubApp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubApp"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OAuth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubOauth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubUsernamePassword"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernameToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GithubUsernameToken"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubHttpCredentialsSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubOauth": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubSshCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "sshKeyRef"
          ],
          "properties": {
            "sshKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubTokenSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubUsernamePassword": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GithubUsernameToken": {
      "allOf": [
        {
          "$ref": "#/definitions/GithubHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabApiAccess": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Token",
            "OAuth"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "OAuth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabOauth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabTokenSpec"
              }
            }
          }
        }
      ]
    },
    "GitlabApiAccessSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabAuthentication": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Http",
            "Ssh"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
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
                "$ref": "#/definitions/GitlabHttpCredentials"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Ssh"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabSshCredentials"
              }
            }
          }
        }
      ]
    },
    "GitlabConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication",
            "type",
            "url"
          ],
          "properties": {
            "apiAccess": {
              "$ref": "#/definitions/GitlabApiAccess"
            },
            "authentication": {
              "$ref": "#/definitions/GitlabAuthentication"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "proxy": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Account",
                "Repo",
                "Project"
              ]
            },
            "url": {
              "type": "string"
            },
            "validationRepo": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabHttpCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "spec",
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "UsernamePassword",
                "UsernameToken",
                "Kerberos",
                "OAuth"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Kerberos"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabKerberos"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OAuth"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabOauth"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabUsernamePassword"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernameToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/GitlabUsernameToken"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabHttpCredentialsSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabKerberos": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "kerberosKeyRef"
          ],
          "properties": {
            "kerberosKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabOauth": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "refreshTokenRef",
            "tokenRef"
          ],
          "properties": {
            "refreshTokenRef": {
              "type": "string"
            },
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabSshCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "sshKeyRef"
          ],
          "properties": {
            "sshKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabTokenSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "apiUrl": {
              "type": "string"
            },
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabUsernamePassword": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GitlabUsernameToken": {
      "allOf": [
        {
          "$ref": "#/definitions/GitlabHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "GoogleChatConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiAccessType"
          ],
          "properties": {
            "accessTokenRef": {
              "type": "string"
            },
            "apiAccessType": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "refreshTokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessApiAccess": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Token",
            "Jwt_Token"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Jwt_Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessJWTTokenSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessTokenSpec"
              }
            }
          }
        }
      ]
    },
    "HarnessApiAccessSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessAuthentication": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "spec": {
          "$ref": "#/definitions/HarnessHttpCredentials"
        },
        "type": {
          "type": "string",
          "enum": [
            "Http",
            "Ssh"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication",
            "type",
            "url"
          ],
          "properties": {
            "apiAccess": {
              "$ref": "#/definitions/HarnessApiAccess"
            },
            "authentication": {
              "$ref": "#/definitions/HarnessAuthentication"
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "type": {
              "type": "string",
              "enum": [
                "Account",
                "Repo",
                "Project"
              ]
            },
            "url": {
              "type": "string"
            },
            "validationRepo": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessHttpCredentials": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernameToken"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernameToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HarnessUsernameToken"
              }
            }
          }
        }
      ]
    },
    "HarnessHttpCredentialsSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessJWTTokenSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessTokenSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessApiAccessSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HarnessUsernameToken": {
      "allOf": [
        {
          "$ref": "#/definitions/HarnessHttpCredentialsSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HostDTO": {
      "type": "object",
      "required": [
        "hostname"
      ],
      "properties": {
        "hostAttributes": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "hostname": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HttpHelmAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HttpHelmAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/HttpHelmUsernamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "HttpHelmConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "helmRepoUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/HttpHelmAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "helmRepoUrl": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "HttpHelmUsernamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/HttpHelmAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "ServiceAccount",
            "Aws",
            "InheritFromDelegate",
            "KeyPair",
            "Kerberos",
            "Oidc"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Aws"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCAwsDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "InheritFromDelegate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCDelegateAccessDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Kerberos"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCKerberosDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "KeyPair"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCKeyPairDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Oidc"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCOidcDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ServiceAccount"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCServiceAccountDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "JDBCAwsDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "InheritFromDelegate",
                "ManualConfig",
                "Irsa",
                "OidcAuthentication",
                "CredentialBroker"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CredentialBroker"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsCredentialBrokerSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsManualConfigSpec"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OidcAuthentication"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/AwsOidcSpec"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "url"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/JDBCAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCDelegateAccessDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "properties": {
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCGcpOidcSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCOidcProviderSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "projectNumber",
            "providerId",
            "serviceAccountEmail",
            "workloadPoolId"
          ],
          "properties": {
            "projectNumber": {
              "type": "string"
            },
            "providerId": {
              "type": "string"
            },
            "serviceAccountEmail": {
              "type": "string"
            },
            "workloadPoolId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCKerberosDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "principal",
            "realm"
          ],
          "properties": {
            "principal": {
              "type": "string"
            },
            "realm": {
              "type": "string"
            },
            "tgtGenerationMethod": {
              "type": "string",
              "enum": [
                "KeyTabFilePath",
                "Password"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "tgtGenerationMethod": {
                "const": "KeyTabFilePath"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TGTKeyTabFilePathSpecDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "tgtGenerationMethod": {
                "const": "Password"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TGTPasswordSpecDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCKeyPairDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "privateKeyFileRef"
          ],
          "properties": {
            "privateKeyFileRef": {
              "type": "string"
            },
            "privateKeyPassphraseRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCOidcDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "type"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "Gcp"
              ]
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Gcp"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JDBCGcpOidcSpecDTO"
              }
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCOidcProviderSpecDTO": {
      "type": "object",
      "discriminator": "type",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCServiceAccountDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "serviceAccountTokenRef"
          ],
          "properties": {
            "serviceAccountTokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JDBCUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JDBCAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JenkinsAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JenkinsAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous",
            "Bearer Token(HTTP Header)"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Bearer Token(HTTP Header)"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JenkinsBearerTokenDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JenkinsUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "JenkinsBearerTokenDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JenkinsAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "tokenRef"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JenkinsConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "jenkinsUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/JenkinsAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "jenkinsUrl": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JenkinsUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JenkinsAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JiraAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JiraAuthenticationDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "PersonalAccessToken"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "PersonalAccessToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JiraPATDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/JiraUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "JiraConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "auth",
            "jiraUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/JiraAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "jiraUrl": {
              "type": "string"
            },
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JiraPATDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JiraAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "patRef"
          ],
          "properties": {
            "patRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "JiraUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/JiraAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesAuthCredentialDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesAuthDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "ClientKeyCert",
            "ServiceAccount",
            "OpenIdConnect"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ClientKeyCert"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesClientKeyCertDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "OpenIdConnect"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesOpenIdConnectDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "ServiceAccount"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesServiceAccountDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "KubernetesClientKeyCertDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/KubernetesAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "clientCertRef",
            "clientKeyRef"
          ],
          "properties": {
            "caCertRef": {
              "type": "string"
            },
            "clientCertRef": {
              "type": "string"
            },
            "clientKeyAlgo": {
              "type": "string"
            },
            "clientKeyPassphraseRef": {
              "type": "string"
            },
            "clientKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesClusterConfigDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential"
          ],
          "properties": {
            "credential": {
              "$ref": "#/definitions/KubernetesCredentialDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesClusterDetailsDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/KubernetesCredentialSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "auth",
            "masterUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/KubernetesAuthDTO"
            },
            "masterUrl": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesCredentialDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "InheritFromDelegate",
            "ManualConfig"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/KubernetesClusterDetailsDTO"
              }
            }
          }
        }
      ]
    },
    "KubernetesCredentialSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesOpenIdConnectDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/KubernetesAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "oidcClientIdRef",
            "oidcPasswordRef"
          ],
          "properties": {
            "oidcClientIdRef": {
              "type": "string"
            },
            "oidcIssuerUrl": {
              "type": "string"
            },
            "oidcPasswordRef": {
              "type": "string"
            },
            "oidcScopes": {
              "type": "string"
            },
            "oidcSecretRef": {
              "type": "string"
            },
            "oidcUsername": {
              "type": "string"
            },
            "oidcUsernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "oidcUsername"
              ]
            },
            {
              "required": [
                "oidcUsernameRef"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesServiceAccountDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/KubernetesAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "serviceAccountTokenRef"
          ],
          "properties": {
            "caCertRef": {
              "type": "string"
            },
            "serviceAccountTokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "KubernetesUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/KubernetesAuthCredentialDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "LangSmithApiKeyDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/LangSmithAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "apiKeyRef"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "LangSmithAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "LangSmithAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "ApiKey"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ApiKey"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/LangSmithApiKeyDTO"
              }
            }
          }
        }
      ]
    },
    "LangSmithConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "baseUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/LangSmithAuthenticationDTO"
            },
            "baseUrl": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "LocalConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "properties": {
            "default": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPAdditionalHeader": {
      "type": "object",
      "required": [
        "name",
        "value"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "value": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPApiKeyAuthDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/MCPAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "apiKeyRef"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "None",
            "ApiKey",
            "Basic",
            "CustomHeader"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ApiKey"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MCPApiKeyAuthDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "Basic"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MCPBasicAuthDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "CustomHeader"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MCPCustomHeaderAuthDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "None"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MCPNoneAuthDTO"
              }
            }
          }
        }
      ]
    },
    "MCPBasicAuthDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/MCPAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef",
            "username"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "serverUrl"
          ],
          "properties": {
            "additionalHeaders": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/MCPAdditionalHeader"
              }
            },
            "auth": {
              "$ref": "#/definitions/MCPAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "serverUrl": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPCustomHeaderAuthDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/MCPAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "headerName",
            "headerValueRef"
          ],
          "properties": {
            "headerName": {
              "type": "string"
            },
            "headerValueRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MCPNoneAuthDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/MCPAuthCredentialsDTO"
        },
        {
          "type": "object"
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MLFlowApiKeyDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/MLFlowAuthCredentialsDTO"
        },
        {
          "type": "object"
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MLFlowAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MLFlowAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Anonymous"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Anonymous"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/MLFlowApiKeyDTO"
              }
            }
          }
        }
      ]
    },
    "MLFlowConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "auth",
            "baseUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/MLFlowAuthenticationDTO"
            },
            "baseUrl": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "MsTeamsConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiAccessType"
          ],
          "properties": {
            "accessTokenRef": {
              "type": "string"
            },
            "apiAccessType": {
              "type": "string",
              "enum": [
                "TOKEN",
                "OAUTH"
              ]
            },
            "clientId": {
              "type": "string"
            },
            "clientSecretRef": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "refreshTokenRef": {
              "type": "string"
            },
            "tenantId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NameValuePairWithDefault": {
      "type": "object",
      "required": [
        "type",
        "value"
      ],
      "properties": {
        "name": {
          "type": "string"
        },
        "type": {
          "type": "string"
        },
        "useAsDefault": {
          "type": "boolean"
        },
        "value": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NewRelicConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiKeyRef",
            "newRelicAccountId",
            "url"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "newRelicAccountId": {
              "type": "string"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusAuthCredentials": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusAuthentication": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/NexusUsernamePasswordAuth"
              }
            }
          }
        }
      ]
    },
    "NexusConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "nexusServerUrl",
            "version"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/NexusAuthentication"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "nexusServerUrl": {
              "type": "string"
            },
            "version": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "NexusUsernamePasswordAuth": {
      "allOf": [
        {
          "$ref": "#/definitions/NexusAuthCredentials"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "Anonymous"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OciHelmUsernamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "OciHelmConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "helmRepoUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/OciHelmAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "helmRepoUrl": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OciHelmUsernamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/OciHelmAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OidcAccessTokenOptions": {
      "type": "object",
      "properties": {
        "userProject": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OidcChartmuseumGcpConfig": {
      "type": "object",
      "properties": {
        "audience": {
          "type": "string"
        },
        "service_account_impersonation_url": {
          "type": "string"
        },
        "subject_token_type": {
          "type": "string"
        },
        "token_url": {
          "type": "string"
        },
        "type": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OidcWorkloadAccessTokenRequest": {
      "type": "object",
      "properties": {
        "audience": {
          "type": "string"
        },
        "grant_type": {
          "type": "string"
        },
        "options": {
          "$ref": "#/definitions/OidcAccessTokenOptions"
        },
        "requested_token_type": {
          "type": "string"
        },
        "scope": {
          "type": "string"
        },
        "subject_token": {
          "type": "string"
        },
        "subject_token_type": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OpenAIAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OpenAIAuthenticationDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Token"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Token"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/OpenAITokenCredentialsDTO"
              }
            }
          }
        }
      ]
    },
    "OpenAIConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "authentication"
          ],
          "properties": {
            "authentication": {
              "$ref": "#/definitions/OpenAIAuthenticationDTO"
            },
            "baseUrl": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "model": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OpenAITokenCredentialsDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/OpenAIAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "tokenRef"
          ],
          "properties": {
            "tokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "OpsGenieConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "url"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "PagerDutyConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiTokenRef"
          ],
          "properties": {
            "apiTokenRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "PhysicalDataCenterConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "properties": {
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "hosts": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/HostDTO"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "PrometheusConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "url"
          ],
          "properties": {
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "headers": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/CustomHealthKeyAndValue"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "passwordRef": {
              "type": "string"
            },
            "url": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "RancherConnectorBearerTokenAuthenticationDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/RancherConnectorConfigAuthenticationSpecDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "RancherConnectorConfigAuthCredentialsDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "BearerToken"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "BearerToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/RancherConnectorBearerTokenAuthenticationDTO"
              }
            }
          }
        }
      ]
    },
    "RancherConnectorConfigAuthDTO": {
      "type": "object",
      "required": [
        "auth",
        "rancherUrl"
      ],
      "properties": {
        "auth": {
          "$ref": "#/definitions/RancherConnectorConfigAuthCredentialsDTO"
        },
        "rancherUrl": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "RancherConnectorConfigAuthenticationSpecDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "RancherConnectorConfigDTO": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "spec": {
          "$ref": "#/definitions/RancherConnectorConfigAuthDTO"
        },
        "type": {
          "type": "string",
          "enum": [
            "ManualConfig"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "RancherConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "properties": {
            "credential": {
              "$ref": "#/definitions/RancherConnectorConfigDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential"
          ],
          "properties": {
            "credential": {
              "$ref": "#/definitions/SalesforceCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "Jwt",
            "SfdxAuthUrl"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "Jwt"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceJwtCredentialDetails"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "SfdxAuthUrl"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SalesforceSfdxAuthUrlCredentialDetails"
              }
            }
          }
        }
      ]
    },
    "SalesforceCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceJwtCredentialDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/SalesforceCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "clientId": {
              "type": "string"
            },
            "jwtKeyFileRef": {
              "type": "string"
            },
            "loginUrl": {
              "type": "string"
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SalesforceSfdxAuthUrlCredentialDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/SalesforceCredentialSpec"
        },
        {
          "type": "object",
          "properties": {
            "sfdxUrl": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceNowADFSDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceNowAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "adfsUrl",
            "certificateRef",
            "clientIdRef",
            "privateKeyRef",
            "resourceIdRef"
          ],
          "properties": {
            "adfsUrl": {
              "type": "string"
            },
            "certificateRef": {
              "type": "string"
            },
            "clientIdRef": {
              "type": "string"
            },
            "privateKeyRef": {
              "type": "string"
            },
            "resourceIdRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceNowAuthCredentialsDTO": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceNowAuthenticationDTO": {
      "type": "object",
      "required": [
        "spec",
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "UsernamePassword",
            "AdfsClientCredentialsWithCertificate",
            "RefreshTokenGrantType"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "AdfsClientCredentialsWithCertificate"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ServiceNowADFSDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "RefreshTokenGrantType"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ServiceNowRefreshTokenDTO"
              }
            }
          }
        },
        {
          "if": {
            "properties": {
              "type": {
                "const": "UsernamePassword"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/ServiceNowUserNamePasswordDTO"
              }
            }
          }
        }
      ]
    },
    "ServiceNowConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "auth",
            "serviceNowUrl"
          ],
          "properties": {
            "auth": {
              "$ref": "#/definitions/ServiceNowAuthenticationDTO"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "passwordRef": {
              "type": "string"
            },
            "serviceNowUrl": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceNowRefreshTokenDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceNowAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "clientIdRef",
            "refreshTokenRef",
            "tokenUrl"
          ],
          "properties": {
            "clientIdRef": {
              "type": "string"
            },
            "clientSecretRef": {
              "type": "string"
            },
            "refreshTokenRef": {
              "type": "string"
            },
            "scope": {
              "type": "string"
            },
            "tokenUrl": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ServiceNowUserNamePasswordDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ServiceNowAuthCredentialsDTO"
        },
        {
          "type": "object",
          "required": [
            "passwordRef"
          ],
          "properties": {
            "passwordRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "usernameRef"
              ]
            },
            {
              "required": [
                "username"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SignalFXConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiTokenRef",
            "url"
          ],
          "properties": {
            "apiTokenRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SlackConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiAccessType"
          ],
          "properties": {
            "accessTokenRef": {
              "type": "string"
            },
            "apiAccessType": {
              "type": "string",
              "enum": [
                "TOKEN",
                "OAUTH"
              ]
            },
            "botUserTokenRef": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "refreshTokenRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SplunkConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "accountId",
            "splunkUrl"
          ],
          "properties": {
            "accountId": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "passwordRef": {
              "type": "string"
            },
            "splunkUrl": {
              "type": "string"
            },
            "tokenRef": {
              "type": "string"
            },
            "type": {
              "type": "string",
              "enum": [
                "UsernamePassword",
                "Anonymous",
                "Bearer Token(HTTP Header)",
                "HEC Token"
              ]
            },
            "username": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SpotConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential"
          ],
          "properties": {
            "credential": {
              "$ref": "#/definitions/SpotCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SpotCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "PermanentTokenConfig"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "PermanentTokenConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/SpotPermanentTokenConfigSpec"
              }
            }
          }
        }
      ]
    },
    "SpotCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SpotPermanentTokenConfigSpec": {
      "allOf": [
        {
          "$ref": "#/definitions/SpotCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "apiTokenRef"
          ],
          "properties": {
            "apiTokenRef": {
              "type": "string"
            },
            "spotAccountId": {
              "type": "string"
            },
            "spotAccountIdRef": {
              "type": "string"
            }
          }
        },
        {
          "oneOf": [
            {
              "required": [
                "spotAccountId"
              ]
            },
            {
              "required": [
                "spotAccountIdRef"
              ]
            }
          ]
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "SumoLogicConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "accessIdRef",
            "accessKeyRef",
            "url"
          ],
          "properties": {
            "accessIdRef": {
              "type": "string"
            },
            "accessKeyRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TGTGenerationSpecDTO": {
      "type": "object",
      "discriminator": "tgtGenerationMethod",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TGTKeyTabFilePathSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/TGTGenerationSpecDTO"
        },
        {
          "type": "object",
          "properties": {
            "keyPath": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TGTPasswordSpecDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/TGTGenerationSpecDTO"
        },
        {
          "type": "object",
          "properties": {
            "password": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TasConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential"
          ],
          "properties": {
            "credential": {
              "$ref": "#/definitions/TasCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TasCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "ManualConfig"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ManualConfig"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TasManualDetails"
              }
            }
          }
        }
      ]
    },
    "TasCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TasManualDetails": {
      "allOf": [
        {
          "$ref": "#/definitions/TasCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "endpointUrl",
            "passwordRef"
          ],
          "properties": {
            "endpointUrl": {
              "type": "string",
              "readOnly": true
            },
            "passwordRef": {
              "type": "string"
            },
            "refreshTokenRef": {
              "type": "string"
            },
            "username": {
              "type": "string"
            },
            "usernameRef": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TemplateLinkConfigForCustomSecretManager": {
      "type": "object",
      "required": [
        "templateRef",
        "versionLabel"
      ],
      "properties": {
        "templateInputs": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": {
              "$ref": "#/definitions/NameValuePairWithDefault"
            }
          }
        },
        "templateRef": {
          "type": "string"
        },
        "versionLabel": {
          "type": "string",
          "pattern": "^[0-9a-zA-Z][^\\s/&]{0,63}$"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TerraformCloudConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "credential",
            "terraformCloudUrl"
          ],
          "properties": {
            "credential": {
              "$ref": "#/definitions/TerraformCloudCredential"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "terraformCloudUrl": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TerraformCloudCredential": {
      "type": "object",
      "required": [
        "type"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "ApiToken"
          ]
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#",
      "allOf": [
        {
          "if": {
            "properties": {
              "type": {
                "const": "ApiToken"
              }
            }
          },
          "then": {
            "properties": {
              "spec": {
                "$ref": "#/definitions/TerraformCloudTokenCredentials"
              }
            }
          }
        }
      ]
    },
    "TerraformCloudCredentialSpec": {
      "type": "object",
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "TerraformCloudTokenCredentials": {
      "allOf": [
        {
          "$ref": "#/definitions/TerraformCloudCredentialSpec"
        },
        {
          "type": "object",
          "required": [
            "apiToken"
          ],
          "properties": {
            "apiToken": {
              "type": "string",
              "readOnly": true
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "VaultConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "renewalIntervalMinutes",
            "vaultUrl"
          ],
          "properties": {
            "accessType": {
              "type": "string",
              "enum": [
                "APP_ROLE",
                "TOKEN",
                "VAULT_AGENT",
                "AWS_IAM",
                "K8s_AUTH",
                "JWT"
              ]
            },
            "appRoleId": {
              "type": "string"
            },
            "appRolePath": {
              "type": "string"
            },
            "authToken": {
              "type": "string"
            },
            "awsRegion": {
              "type": "string"
            },
            "basePath": {
              "type": "string"
            },
            "default": {
              "type": "boolean"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "enableCache": {
              "type": "boolean"
            },
            "executeOnDelegate": {
              "type": "boolean"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "jwtAuthPath": {
              "type": "string"
            },
            "jwtAuthRole": {
              "type": "string"
            },
            "jwtAuthRoleWithGranularClaims": {
              "type": "string"
            },
            "k8sAuthEndpoint": {
              "type": "string"
            },
            "namespace": {
              "type": "string"
            },
            "ngCertificateRef": {
              "type": "string"
            },
            "proxy": {
              "type": "boolean"
            },
            "readOnly": {
              "type": "boolean"
            },
            "renewAppRoleToken": {
              "type": "boolean"
            },
            "renewalIntervalMinutes": {
              "type": "integer",
              "format": "int64"
            },
            "secretEngineManuallyConfigured": {
              "type": "boolean"
            },
            "secretEngineName": {
              "type": "string"
            },
            "secretEngineVersion": {
              "type": "integer",
              "format": "int32"
            },
            "secretId": {
              "type": "string"
            },
            "serviceAccountTokenPath": {
              "type": "string"
            },
            "sinkPath": {
              "type": "string"
            },
            "useAwsIam": {
              "type": "boolean"
            },
            "useJwtAuth": {
              "type": "boolean"
            },
            "useK8sAuth": {
              "type": "boolean"
            },
            "useVaultAgent": {
              "type": "boolean"
            },
            "vaultAwsIamRole": {
              "type": "string"
            },
            "vaultK8sAuthRole": {
              "type": "string"
            },
            "vaultOidcTokenExchangeDetails": {
              "$ref": "#/definitions/VaultOidcTokenExchangeDetails"
            },
            "vaultUrl": {
              "type": "string"
            },
            "xvaultAwsIamServerId": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "VaultOidcTokenExchangeDetails": {
      "type": "object",
      "properties": {
        "idTokenExpiryTime": {
          "type": "integer",
          "format": "int64"
        },
        "jwtAuthRoleForTokenExchange": {
          "type": "string"
        },
        "oidcIdToken": {
          "type": "string"
        }
      },
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "XMattersConnectorDTO": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "url"
          ],
          "properties": {
            "apiKeyRef": {
              "type": "string"
            },
            "apiSecretRef": {
              "type": "string"
            },
            "delegateSelectors": {
              "type": "array",
              "uniqueItems": true,
              "items": {
                "type": "string"
              }
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "url": {
              "type": "string"
            }
          }
        }
      ],
      "$schema": "http://json-schema.org/draft-07/schema#"
    },
    "ZoomConnector": {
      "allOf": [
        {
          "$ref": "#/definitions/ConnectorConfigDTO"
        },
        {
          "type": "object",
          "required": [
            "apiAccessType"
          ],
          "properties": {
            "accessTokenRef": {
              "type": "string"
            },
            "apiAccessType": {
              "type": "string",
              "enum": [
                "TOKEN",
                "OAUTH"
              ]
            },
            "clientId": {
              "type": "string"
            },
            "clientSecretRef": {
              "type": "string"
            },
            "ignoreTestConnection": {
              "type": "boolean"
            },
            "refreshTokenRef": {
              "type": "string"
            },
            "tokenExpirationTime": {
              "type": "integer",
              "format": "int64"
            },
            "zoomAccountId": {
              "type": "string"
            },
            "zoomUserId": {
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
  "resourceType": "connector",
  "scope": "project",
  "syncedAt": "2026-05-27T09:53:36.734Z",
  "accountId": "VpehPBwPQ9qKsX-xDP8SFg",
  "orgId": "default",
  "projectId": "aidevops"
};
