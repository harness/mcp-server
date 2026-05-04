// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v1/infra.json
// @ts-nocheck

const schema: Record<string, any> = {
  "title": "infra_v1",
  "type": "object",
  "required": [
    "spec",
    "version",
    "kind"
  ],
  "properties": {
    "version": {
      "description": "Version defines the schema version.",
      "type": "number",
      "enum": [
        1
      ]
    },
    "kind": {
      "description": "defines the kind of yaml (pipeline/template/service/infra)",
      "type": "string",
      "enum": [
        "infra-def"
      ]
    },
    "spec": {
      "type": "object",
      "description": "definition of infra structure entity",
      "$ref": "#/definitions/infra_v1/InfraDefSpec"
    },
    "desc": {
      "description": "This is the description for Infra Structure Definition Entity"
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "pipeline": {
      "common": {
        "StringNGVariableV1": {
          "title": "StringNGVariableV1",
          "description": "String variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Variable"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "description": "Variable type.",
                  "type": "string",
                  "enum": [
                    "string"
                  ]
                },
                "value": {
                  "description": "Variable value. Supports expressions.",
                  "type": "string"
                },
                "default": {
                  "description": "Default value for the variable.",
                  "type": "string"
                },
                "enum": {
                  "description": "Defines a list of accepted input values.",
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                "options": {
                  "description": "Defines a list of accepted input values. Alias for enum (GitHub compatibility).",
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "Variable": {
          "title": "Variable",
          "type": "object",
          "discriminator": "type",
          "description": "Variable defines a variable object",
          "properties": {
            "type": {
              "description": "Type defines the variable type.",
              "type": "string",
              "enum": [
                "string",
                "number",
                "boolean",
                "array",
                "object",
                "secret",
                "step",
                "stage",
                "connector"
              ]
            },
            "desc": {
              "type": "string",
              "description": "Desc defines the variable description."
            },
            "required": {
              "type": "boolean",
              "description": "Required indicates the variable is required."
            },
            "execution_input": {
              "description": "A boolean that defines whether the value is an execution input.",
              "type": "boolean",
              "default": false
            },
            "items": {
              "description": "Defines the item type for array variables.",
              "type": "array"
            },
            "options": {
              "description": "Defines a list of accepted input values. Alias for enum (GitHub compatibility).",
              "type": "array"
            },
            "enum": {
              "description": "Defines a list of accepted input values.",
              "type": "array"
            },
            "pattern": {
              "description": "Regex pattern for variable value validation.",
              "type": "string"
            },
            "mask": {
              "description": "Indicates the input should be masked.",
              "type": "boolean",
              "deprecated": true
            },
            "ui": {
              "description": "UI configuration for variable rendering in forms.",
              "$ref": "#/definitions/pipeline/common/VariableUI"
            }
          }
        },
        "VariableUI": {
          "title": "VariableUI",
          "description": "UI configuration for variable rendering in forms.",
          "type": "object",
          "properties": {
            "component": {
              "description": "Form element type for rendering the variable input.",
              "type": "string",
              "enum": [
                "dropdown",
                "text",
                "number",
                "date",
                "datetime",
                "textarea",
                "checkbox",
                "radio"
              ]
            },
            "placeholder": {
              "description": "Placeholder text for the form element.",
              "type": "string"
            },
            "tooltip": {
              "description": "Tooltip/help text for the form element.",
              "type": "string"
            },
            "autofocus": {
              "description": "Whether the form element should be auto-focused.",
              "type": "boolean",
              "default": false
            },
            "hidden": {
              "description": "Whether the variable should be hidden in the UI.",
              "type": "boolean",
              "default": false
            },
            "readonly": {
              "description": "Whether the variable should be read-only in the UI.",
              "type": "boolean",
              "default": false
            },
            "label": {
              "description": "Display label for the variable in the UI.",
              "type": "string"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "NumberVariable": {
          "title": "NumberVariable",
          "description": "Number variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Variable"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "description": "Variable type.",
                  "type": "string",
                  "enum": [
                    "number"
                  ]
                },
                "value": {
                  "description": "Variable value. Supports expressions.",
                  "oneOf": [
                    {
                      "type": "number",
                      "format": "double"
                    },
                    {
                      "type": "string",
                      "pattern": "((^[+-]?[0-9]*\\.?[0-9]+$)|(<\\+.+>.*))"
                    }
                  ],
                  "metadata": {
                    "inputProperties": {
                      "dependsOn": [
                        "type"
                      ]
                    }
                  }
                },
                "default": {
                  "description": "Default value for the variable.",
                  "type": "number",
                  "format": "double"
                },
                "enum": {
                  "description": "Defines a list of accepted input values.",
                  "type": "array",
                  "items": {
                    "oneOf": [
                      {
                        "type": "number",
                        "format": "double"
                      },
                      {
                        "type": "string",
                        "pattern": "((^[+-]?[0-9]*\\.?[0-9]+$)|(<\\+.+>.*))"
                      }
                    ]
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ArrayVariable": {
          "title": "ArrayVariable",
          "description": "Array variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Variable"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "description": "Variable type.",
                  "type": "string",
                  "enum": [
                    "array"
                  ]
                },
                "value": {
                  "description": "Variable value.",
                  "type": "array"
                },
                "default": {
                  "description": "Default value for the variable.",
                  "type": "array"
                },
                "enum": {
                  "description": "Defines a list of accepted input values.",
                  "type": "array",
                  "items": {
                    "type": "array"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "BooleanVariable": {
          "title": "BooleanVariable",
          "description": "Boolean variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Variable"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "description": "Variable type.",
                  "type": "string",
                  "enum": [
                    "boolean"
                  ]
                },
                "value": {
                  "description": "Variable value.",
                  "type": "boolean"
                },
                "default": {
                  "description": "Default value for the variable.",
                  "type": "boolean"
                },
                "enum": {
                  "description": "Defines a list of accepted input values.",
                  "type": "array",
                  "items": {
                    "type": "boolean"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ObjectVariable": {
          "title": "ObjectVariable",
          "description": "Object variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Variable"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "description": "Variable type.",
                  "type": "string",
                  "enum": [
                    "object"
                  ]
                },
                "value": {
                  "description": "Variable value.",
                  "type": "object"
                },
                "default": {
                  "description": "Default value for the variable.",
                  "type": "object"
                },
                "enum": {
                  "description": "Defines a list of accepted input values.",
                  "type": "array",
                  "items": {
                    "type": "object"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "SecretVariable": {
          "title": "SecretVariable",
          "description": "Secret variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Variable"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "type": {
                  "description": "Variable type.",
                  "type": "string",
                  "enum": [
                    "secret"
                  ]
                },
                "value": {
                  "description": "Variable value (secret reference).",
                  "type": "string",
                  "metadata": {
                    "inputProperties": {
                      "dependsOn": [
                        "type"
                      ]
                    }
                  }
                },
                "default": {
                  "description": "Default value for the variable.",
                  "type": "string"
                },
                "enum": {
                  "description": "Defines a list of accepted input values.",
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "StringInput": {
          "title": "StringInput",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Input"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "default": {
                  "type": "string"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "string"
                  ]
                },
                "value": {
                  "type": "string"
                },
                "validator": {
                  "type": "object",
                  "oneOf": [
                    {
                      "allOf": [
                        {
                          "properties": {
                            "allowed": {
                              "description": "defines allowed values for an input",
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            }
                          }
                        }
                      ],
                      "required": [
                        "allowed"
                      ]
                    },
                    {
                      "allOf": [
                        {
                          "properties": {
                            "regex": {
                              "description": "defines regex pattern for an input value",
                              "type": "string"
                            }
                          }
                        }
                      ],
                      "required": [
                        "regex"
                      ]
                    }
                  ]
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "Input": {
          "title": "Input",
          "type": "object",
          "discriminator": "type",
          "description": "Input defines an input parameter.",
          "properties": {
            "type": {
              "description": "Type defines the input type.",
              "type": "string",
              "enum": [
                "string",
                "number",
                "boolean",
                "array",
                "object",
                "secret",
                "step",
                "duration",
                "choice",
                "environment"
              ]
            },
            "description": {
              "type": "string",
              "description": "Description defines the input description."
            },
            "default": {
              "description": "Default defines the default value."
            },
            "required": {
              "type": "boolean",
              "description": "Required indicates the input is required."
            },
            "items": {
              "type": "array",
              "description": "Items defines an array type."
            },
            "enum": {
              "type": "array",
              "description": "Enum defines a list of accepted input values."
            },
            "pattern": {
              "type": "string",
              "description": "Pattern defines a regular expression input constraint."
            },
            "component": {
              "type": "string",
              "description": "Component defines the form element for rendering the input.",
              "enum": [
                "dropdown",
                "text",
                "number",
                "date",
                "datetime"
              ]
            },
            "autofocus": {
              "type": "boolean",
              "description": "Autofocus configures the form element autofocus attribute."
            },
            "placeholder": {
              "type": "string",
              "description": "Placeholder configures the form element placeholder attribute."
            },
            "tooltip": {
              "type": "string",
              "description": "Tooltip configures the form element alt attribute."
            },
            "options": {
              "type": "array",
              "description": "Options defines a list of accepted input values (alias for enum, GitHub compatibility)."
            },
            "mask": {
              "type": "boolean",
              "description": "Mask indicates the input should be masked (deprecated).",
              "deprecated": true
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "NumberInput": {
          "title": "NumberInput",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Input"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "default": {
                  "type": "number",
                  "format": "double"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "number"
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
                      "pattern": "((^[+-]?[0-9]*\\.?[0-9]+$)|(<\\+.+>.*))"
                    }
                  ]
                },
                "validator": {
                  "type": "object",
                  "oneOf": [
                    {
                      "allOf": [
                        {
                          "properties": {
                            "allowed": {
                              "description": "defines allowed values for an input",
                              "type": "array",
                              "items": {
                                "oneOf": [
                                  {
                                    "type": "number",
                                    "format": "double"
                                  },
                                  {
                                    "type": "string",
                                    "pattern": "((^[+-]?[0-9]*\\.?[0-9]+$)|(<\\+.+>.*))"
                                  }
                                ]
                              }
                            }
                          }
                        }
                      ],
                      "required": [
                        "allowed"
                      ]
                    },
                    {
                      "allOf": [
                        {
                          "properties": {
                            "regex": {
                              "description": "defines regex pattern for an input value",
                              "type": "string"
                            }
                          }
                        }
                      ],
                      "required": [
                        "regex"
                      ]
                    }
                  ]
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ArrayInput": {
          "title": "ArrayInput",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Input"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "default": {
                  "type": "array"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "array"
                  ]
                },
                "value": {
                  "type": "array"
                },
                "validator": {
                  "type": "object",
                  "oneOf": [
                    {
                      "allOf": [
                        {
                          "properties": {
                            "allowed": {
                              "description": "defines allowed values for an input",
                              "type": "array",
                              "items": {
                                "type": "array"
                              }
                            }
                          }
                        }
                      ],
                      "required": [
                        "allowed"
                      ]
                    },
                    {
                      "allOf": [
                        {
                          "properties": {
                            "regex": {
                              "description": "defines regex pattern for an input value",
                              "type": "string"
                            }
                          }
                        }
                      ],
                      "required": [
                        "regex"
                      ]
                    }
                  ]
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "BooleanInput": {
          "title": "BooleanInput",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Input"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "default": {
                  "type": "boolean"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "boolean"
                  ]
                },
                "value": {
                  "type": "boolean"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ObjectInput": {
          "title": "ObjectInput",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Input"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "default": {
                  "type": "object"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "object"
                  ]
                },
                "value": {
                  "type": "object"
                },
                "validator": {
                  "type": "object",
                  "oneOf": [
                    {
                      "allOf": [
                        {
                          "properties": {
                            "allowed": {
                              "description": "defines allowed values for an input",
                              "type": "array",
                              "items": {
                                "type": "object"
                              }
                            }
                          }
                        }
                      ],
                      "required": [
                        "allowed"
                      ]
                    },
                    {
                      "allOf": [
                        {
                          "properties": {
                            "regex": {
                              "description": "defines regex pattern for an input value",
                              "type": "string"
                            }
                          }
                        }
                      ],
                      "required": [
                        "regex"
                      ]
                    }
                  ]
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "SecretInput": {
          "title": "SecretInput",
          "allOf": [
            {
              "$ref": "#/definitions/pipeline/common/Input"
            },
            {
              "type": "object",
              "required": [
                "type"
              ],
              "properties": {
                "default": {
                  "type": "string"
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "secret"
                  ]
                },
                "value": {
                  "type": "string"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      }
    },
    "infra_v1": {
      "InfraDefSpec": {
        "title": "InfraDefSpec",
        "type": "object",
        "required": [
          "spec",
          "type",
          "variables"
        ],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "kubernetes-gcp"
            ]
          },
          "parallel": {
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "boolean"
              }
            ],
            "description": "true value of parallel field allow multiple deployment on same infra simultaneously"
          },
          "variables": {
            "type": "object",
            "description": "Variables defines for infra structure definition",
            "additionalProperties": {
              "oneOf": [
                {
                  "$ref": "#/definitions/pipeline/common/StringNGVariableV1"
                },
                {
                  "$ref": "#/definitions/pipeline/common/NumberVariable"
                },
                {
                  "$ref": "#/definitions/pipeline/common/ArrayVariable"
                },
                {
                  "$ref": "#/definitions/pipeline/common/BooleanVariable"
                },
                {
                  "$ref": "#/definitions/pipeline/common/ObjectVariable"
                },
                {
                  "$ref": "#/definitions/pipeline/common/SecretVariable"
                }
              ]
            }
          },
          "inputs": {
            "type": "object",
            "description": "Inputs defines the infrastructure input parameters.",
            "additionalProperties": {
              "oneOf": [
                {
                  "$ref": "#/definitions/pipeline/common/StringInput"
                },
                {
                  "$ref": "#/definitions/pipeline/common/NumberInput"
                },
                {
                  "$ref": "#/definitions/pipeline/common/ArrayInput"
                },
                {
                  "$ref": "#/definitions/pipeline/common/BooleanInput"
                },
                {
                  "$ref": "#/definitions/pipeline/common/ObjectInput"
                },
                {
                  "$ref": "#/definitions/pipeline/common/SecretInput"
                }
              ]
            },
            "propertyNames": {
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$-]{0,127}$"
            }
          }
        },
        "allOf": [
          {
            "if": {
              "properties": {
                "type": {
                  "const": "kubernetes-gcp"
                }
              }
            },
            "then": {
              "properties": {
                "spec": {
                  "$ref": "#/definitions/infra_v1/KubernetesGcpInfraDefSpec"
                }
              }
            }
          }
        ],
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "KubernetesGcpInfraDefSpec": {
        "title": "KubernetesGcpInfraDefSpec",
        "allOf": [
          {
            "$ref": "#/definitions/infra_v1/BasicInfraDefSpec"
          },
          {
            "type": "object",
            "required": [
              "connector",
              "cluster",
              "namespace",
              "release"
            ],
            "properties": {
              "cluster": {
                "type": "string",
                "minLength": 1
              },
              "connector": {
                "type": "string",
                "minLength": 1
              },
              "namespace": {
                "type": "string",
                "minLength": 1
              },
              "release": {
                "type": "string",
                "minLength": 1
              }
            }
          }
        ],
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "BasicInfraDefSpec": {
        "title": "BasicInfraDefSpec",
        "type": "object",
        "discriminator": "type",
        "$schema": "http://json-schema.org/draft-07/schema#"
      }
    }
  }
};
export default schema;
