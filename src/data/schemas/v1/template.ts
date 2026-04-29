// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v1/template.json
// @ts-nocheck

const schema: Record<string, any> = {
  "type": "object",
  "title": "template_v1",
  "required": [
    "template"
  ],
  "properties": {
    "version": {
      "type": "number",
      "enum": [
        1
      ]
    },
    "template": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Display name of the template."
        },
        "description": {
          "type": "string",
          "description": "Description of the template."
        },
        "tags": {
          "type": "object",
          "description": "Tags for the template.",
          "additionalProperties": {
            "type": "string"
          }
        },
        "inputs": {
          "$ref": "#/definitions/template_v1/common/UnifiedInputs"
        }
      },
      "oneOf": [
        {
          "required": [
            "pipeline"
          ],
          "properties": {
            "pipeline": {
              "$ref": "#/definitions/template_v1/pipeline"
            }
          }
        },
        {
          "required": [
            "stage"
          ],
          "properties": {
            "stage": {
              "$ref": "#/definitions/template_v1/stages/unified/UnifiedStageNodeV1"
            }
          }
        },
        {
          "required": [
            "step"
          ],
          "properties": {
            "step": {
              "$ref": "#/definitions/template_v1/steps/unified/StepItems"
            }
          }
        },
        {
          "required": [
            "group"
          ],
          "properties": {
            "group": {
              "$ref": "#/definitions/template/group/GroupTemplateSpec"
            }
          }
        }
      ]
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "template": {
      "group": {
        "GroupTemplateSpec": {
          "title": "GroupTemplateSpec",
          "oneOf": [
            {
              "type": "object",
              "required": [
                "steps"
              ],
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Unique identifier for the step group.",
                  "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
                },
                "name": {
                  "type": "string",
                  "description": "Display name of the step group."
                },
                "desc": {
                  "type": "string",
                  "description": "Description of the step group."
                },
                "if": {
                  "type": "string",
                  "description": "Conditional execution expression. Group is skipped if condition resolves to false."
                },
                "strategy": {
                  "description": "Execution strategy (matrix, for, while, repeat). Supports expressions.",
                  "oneOf": [
                    {
                      "$ref": "#/definitions/template_v1/common/StrategyConfigV1"
                    },
                    {
                      "type": "string",
                      "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                    }
                  ]
                },
                "on-failure": {
                  "$ref": "#/definitions/template_v1/common/OnFailure"
                },
                "timeout": {
                  "type": "string",
                  "description": "Step group timeout duration.",
                  "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
                },
                "steps": {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/template_v1/steps/unified/StepItems"
                  },
                  "maxItems": 256,
                  "minItems": 1
                }
              }
            },
            {
              "type": "object",
              "required": [
                "stages"
              ],
              "properties": {
                "id": {
                  "description": "Unique identifier for the group.",
                  "type": "string"
                },
                "name": {
                  "description": "Display name of the group.",
                  "type": "string"
                },
                "stages": {
                  "description": "Stages within the group.",
                  "type": "array",
                  "items": {
                    "oneOf": [
                      {
                        "$ref": "#/definitions/template_v1/stages/unified/UnifiedStageNodeV1"
                      },
                      {
                        "$ref": "#/definitions/template_v1/stages/unified/UnifiedPipelineStageNode"
                      },
                      {
                        "$ref": "#/definitions/template_v1/stages/unified/ParallelStages"
                      },
                      {
                        "$ref": "#/definitions/template_v1/stages/unified/GroupStages"
                      }
                    ]
                  },
                  "minItems": 1
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      }
    },
    "template_v1": {
      "common": {
        "UnifiedInputs": {
          "title": "UnifiedInputs",
          "type": "object",
          "description": "Defines typed input parameters for any entity.",
          "additionalProperties": {
            "oneOf": [
              {
                "$ref": "#/definitions/template_v1/common/StringInput"
              },
              {
                "$ref": "#/definitions/template_v1/common/NumberInput"
              },
              {
                "$ref": "#/definitions/template_v1/common/ArrayInput"
              },
              {
                "$ref": "#/definitions/template_v1/common/BooleanInput"
              },
              {
                "$ref": "#/definitions/template_v1/common/ObjectInput"
              },
              {
                "$ref": "#/definitions/template_v1/common/SecretInput"
              }
            ]
          },
          "propertyNames": {
            "pattern": "^[a-zA-Z_][0-9a-zA-Z_\\.$-]{0,127}$"
          }
        },
        "StringInput": {
          "title": "StringInput",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Input"
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
              "$ref": "#/definitions/template_v1/common/Input"
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
              "$ref": "#/definitions/template_v1/common/Input"
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
              "$ref": "#/definitions/template_v1/common/Input"
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
              "$ref": "#/definitions/template_v1/common/Input"
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
              "$ref": "#/definitions/template_v1/common/Input"
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
        },
        "NGVariableV1Wrapper": {
          "title": "NGVariableV1Wrapper",
          "description": "Wrapper for stage/pipeline-level input variables. Keys are variable names, values define variable configuration.",
          "type": "object",
          "additionalProperties": {
            "oneOf": [
              {
                "$ref": "#/definitions/template_v1/common/StringNGVariableV1"
              },
              {
                "$ref": "#/definitions/template_v1/common/NumberVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/BooleanVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/ArrayVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/ObjectVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/SecretVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/StepVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/StageVariable"
              },
              {
                "$ref": "#/definitions/template_v1/common/ConnectorVariable"
              }
            ]
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "StringNGVariableV1": {
          "title": "StringNGVariableV1",
          "description": "String variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
              "$ref": "#/definitions/template_v1/common/VariableUI"
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
              "$ref": "#/definitions/template_v1/common/Variable"
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
        "BooleanVariable": {
          "title": "BooleanVariable",
          "description": "Boolean variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
        "ArrayVariable": {
          "title": "ArrayVariable",
          "description": "Array variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
        "ObjectVariable": {
          "title": "ObjectVariable",
          "description": "Object variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
              "$ref": "#/definitions/template_v1/common/Variable"
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
        "StepVariable": {
          "title": "StepVariable",
          "description": "Step variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
                    "step"
                  ]
                },
                "value": {
                  "description": "Variable value. Supports expressions.",
                  "type": "object",
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
        "StageVariable": {
          "title": "StageVariable",
          "description": "Stage variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
                    "stage"
                  ]
                },
                "value": {
                  "description": "Variable value. Supports expressions.",
                  "type": "object",
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
        "ConnectorVariable": {
          "title": "ConnectorVariable",
          "description": "Connector variable definition.",
          "allOf": [
            {
              "$ref": "#/definitions/template_v1/common/Variable"
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
                    "connector"
                  ]
                },
                "value": {
                  "description": "Connector reference value. Supports expressions.",
                  "type": "string"
                },
                "default": {
                  "description": "Default connector reference.",
                  "type": "string"
                },
                "oneof": {
                  "description": "List of allowed connector types.",
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "gitlab",
                      "github",
                      "bitbucket",
                      "gcp",
                      "aws",
                      "docker",
                      "kubernetes",
                      "artifactory",
                      "azure",
                      "jenkins",
                      "jira",
                      "servicenow"
                    ]
                  }
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "Delegate": {
          "title": "Delegate",
          "description": "Delegate defines the delegate matching logic.",
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
        "TemplateRef": {
          "title": "TemplateRef",
          "description": "Template identifier and input configuration.",
          "type": "object",
          "required": [
            "uses"
          ],
          "properties": {
            "uses": {
              "description": "Template identifier reference.",
              "type": "string"
            },
            "with": {
              "description": "Template input overrides.",
              "$ref": "#/definitions/template_v1/common/WithInputs"
            },
            "gitBranch": {
              "description": "Git branch for remote template resolution.",
              "type": "string"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "WithInputs": {
          "title": "WithInputs",
          "description": "Input overrides for service, environment, or infrastructure.",
          "type": "object",
          "properties": {
            "overlay": {
              "description": "Overlay configuration for merging inputs.",
              "type": "object",
              "additionalProperties": true
            }
          },
          "additionalProperties": true,
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "StrategyConfigV1": {
          "title": "StrategyConfigV1",
          "type": "object",
          "description": "Strategy defines execution strategy configuration (matrix, for, while, repeat).",
          "properties": {
            "max-parallel": {
              "description": "Maximum number of parallel executions. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer"
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "fail-fast": {
              "description": "Whether to fail fast on first failure. Supports expressions.",
              "oneOf": [
                {
                  "type": "boolean"
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            }
          },
          "oneOf": [
            {
              "properties": {
                "matrix": {
                  "oneOf": [
                    {
                      "$ref": "#/definitions/template_v1/common/MatrixConfigV1"
                    },
                    {
                      "type": "string",
                      "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                    }
                  ]
                }
              },
              "required": [
                "matrix"
              ]
            },
            {
              "properties": {
                "for": {
                  "oneOf": [
                    {
                      "$ref": "#/definitions/template_v1/common/ForConfigV1"
                    },
                    {
                      "type": "string",
                      "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                    }
                  ]
                }
              },
              "required": [
                "for"
              ]
            },
            {
              "properties": {
                "while": {
                  "oneOf": [
                    {
                      "$ref": "#/definitions/template_v1/common/WhileConfigV1"
                    },
                    {
                      "type": "string",
                      "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                    }
                  ]
                }
              },
              "required": [
                "while"
              ]
            },
            {
              "properties": {
                "repeat": {
                  "oneOf": [
                    {
                      "$ref": "#/definitions/template_v1/common/RepeatConfigV1"
                    },
                    {
                      "type": "string",
                      "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                    }
                  ]
                }
              },
              "required": [
                "repeat"
              ]
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "MatrixConfigV1": {
          "title": "MatrixConfigV1",
          "type": "object",
          "description": "Matrix strategy configuration for parallel execution across multiple dimensions.",
          "properties": {
            "exclude": {
              "description": "Combinations to exclude from the matrix. Supports expressions.",
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": true
                  }
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "include": {
              "description": "Additional combinations to include in the matrix. Supports expressions.",
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": true
                  }
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "node-name": {
              "description": "Custom naming pattern for matrix nodes. Supports expressions.",
              "type": "string"
            }
          },
          "additionalProperties": {
            "description": "Matrix axes - key is axis name, value is array of values or expression.",
            "oneOf": [
              {
                "type": "array",
                "items": {
                  "oneOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "object"
                    }
                  ]
                }
              },
              {
                "type": "string"
              }
            ]
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ForConfigV1": {
          "title": "ForConfigV1",
          "type": "object",
          "description": "For loop strategy configuration.",
          "properties": {
            "iterations": {
              "description": "Number of iterations to execute. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 0
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "node-name": {
              "description": "Custom naming pattern for loop nodes. Supports expressions.",
              "type": "string"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "WhileConfigV1": {
          "title": "WhileConfigV1",
          "type": "object",
          "description": "While loop strategy configuration.",
          "properties": {
            "iterations": {
              "description": "Maximum number of iterations. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 0
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "condition": {
              "description": "Condition expression to evaluate for continuing the loop. Supports expressions.",
              "type": "string"
            },
            "node-name": {
              "description": "Custom naming pattern for loop nodes. Supports expressions.",
              "type": "string"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "RepeatConfigV1": {
          "title": "RepeatConfigV1",
          "type": "object",
          "description": "Repeat strategy configuration for iterating over items.",
          "properties": {
            "iterations": {
              "description": "Number of iterations (alternative to items). Supports expressions.",
              "oneOf": [
                {
                  "type": "integer"
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "items": {
              "description": "List of items to iterate over. Supports expressions.",
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "node-name": {
              "description": "Custom naming pattern for repeat nodes. Supports expressions.",
              "type": "string"
            },
            "partition-size": {
              "description": "Size of each partition when splitting items. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 0
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "start": {
              "description": "Starting index for iteration. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 0
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "end": {
              "description": "Ending index for iteration. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 0
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "unit": {
              "description": "Unit for partition-size (percentage or count).",
              "type": "string",
              "enum": [
                "percentage",
                "count"
              ]
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "OnFailure": {
          "title": "OnFailure",
          "description": "Failure strategy configuration. Supports single value or array. Supports expressions.",
          "oneOf": [
            {
              "$ref": "#/definitions/template_v1/common/FailureConfigV1"
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/definitions/template_v1/common/FailureConfigV1"
              }
            },
            {
              "type": "string",
              "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "FailureConfigV1": {
          "title": "FailureConfigV1",
          "type": "object",
          "description": "Failure strategy configuration for handling errors.",
          "required": [
            "errors",
            "action"
          ],
          "properties": {
            "errors": {
              "description": "List of error types to handle. Supports single value or array. Supports expressions.",
              "oneOf": [
                {
                  "type": "array",
                  "items": {
                    "$ref": "#/definitions/template_v1/common/NGFailureTypeV1"
                  }
                },
                {
                  "$ref": "#/definitions/template_v1/common/NGFailureTypeV1"
                }
              ]
            },
            "action": {
              "$ref": "#/definitions/template_v1/common/FailureStrategyActionConfigV1"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "NGFailureTypeV1": {
          "title": "NGFailureTypeV1",
          "description": "Failure error types for failure strategy configuration.",
          "type": "string",
          "enum": [
            "unknown",
            "all",
            "authentication",
            "connectivity",
            "timeout",
            "authorization",
            "verification",
            "delegate-provisioning",
            "policy-evaluation",
            "input-timeout",
            "approval-rejection",
            "delegate-restart",
            "user-mark-fail",
            "proceed-with-default"
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "FailureStrategyActionConfigV1": {
          "title": "FailureStrategyActionConfigV1",
          "description": "Action configuration for failure strategy. Can be a string shorthand or a detailed object.",
          "oneOf": [
            {
              "type": "string",
              "enum": [
                "abort",
                "ignore",
                "success",
                "stage-rollback",
                "pipeline-rollback",
                "fail"
              ]
            },
            {
              "type": "object",
              "properties": {
                "retry": {
                  "$ref": "#/definitions/template_v1/common/RetryFailureSpecConfigV1"
                },
                "manual-intervention": {
                  "$ref": "#/definitions/template_v1/common/ManualFailureSpecConfigV1"
                },
                "abort": {
                  "description": "Abort the execution.",
                  "type": "object"
                },
                "ignore": {
                  "description": "Ignore the failure and continue.",
                  "type": "object"
                },
                "success": {
                  "description": "Mark the execution as success.",
                  "type": "object"
                },
                "stage-rollback": {
                  "description": "Rollback the stage.",
                  "type": "object"
                },
                "pipeline-rollback": {
                  "description": "Rollback the pipeline.",
                  "type": "object"
                },
                "fail": {
                  "description": "Mark the execution as failed.",
                  "type": "object"
                },
                "retry-step-group": {
                  "$ref": "#/definitions/template_v1/common/RetryStepGroupFailureSpecConfigV1"
                }
              }
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "RetryFailureSpecConfigV1": {
          "title": "RetryFailureSpecConfigV1",
          "type": "object",
          "description": "Retry configuration for failure strategy.",
          "properties": {
            "attempts": {
              "description": "Number of retry attempts. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 1
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "interval": {
              "description": "Interval between retries. Can be single value or array of timeouts. Supports expressions.",
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
            "failure-action": {
              "description": "Action to take after all retries are exhausted.",
              "$ref": "#/definitions/template_v1/common/FailureStrategyActionConfigV1"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ManualFailureSpecConfigV1": {
          "title": "ManualFailureSpecConfigV1",
          "type": "object",
          "description": "Manual intervention configuration for failure strategy.",
          "properties": {
            "timeout": {
              "description": "Timeout for manual intervention. Supports expressions.",
              "type": "string"
            },
            "timeout-action": {
              "description": "Action to take when timeout is reached.",
              "$ref": "#/definitions/template_v1/common/FailureStrategyActionConfigV1"
            },
            "available-actions": {
              "description": "List of available actions for manual intervention.",
              "type": "array",
              "items": {
                "$ref": "#/definitions/template_v1/common/FailureStrategyActionConfigV1"
              }
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "RetryStepGroupFailureSpecConfigV1": {
          "title": "RetryStepGroupFailureSpecConfigV1",
          "type": "object",
          "description": "Retry step group configuration for failure strategy.",
          "properties": {
            "attempts": {
              "description": "Number of retry attempts. Supports expressions.",
              "oneOf": [
                {
                  "type": "integer",
                  "minimum": 1
                },
                {
                  "type": "string",
                  "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                }
              ]
            },
            "interval": {
              "description": "Interval between retries. Can be single value or array of timeouts. Supports expressions.",
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
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "OutputV1": {
          "title": "OutputV1",
          "description": "Output variable definition for capturing step outputs.",
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "description": "Name of the output variable.",
              "type": "string",
              "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
            },
            "alias": {
              "description": "Alias for the output variable.",
              "type": "string"
            },
            "mask": {
              "description": "Whether to mask the output variable value in logs.",
              "type": "boolean",
              "default": false
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "ObjectOrExpression": {
          "title": "ObjectOrExpression",
          "description": "Object or expression value. Supports expressions.",
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": true
            },
            {
              "type": "string",
              "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
            }
          ],
          "$schema": "http://json-schema.org/draft-07/schema#"
        },
        "UnifiedTemplate": {
          "title": "UnifiedTemplate",
          "description": "Template reference for steps, stages, or pipelines.",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "Identifier for the template-referenced item."
            },
            "name": {
              "type": "string",
              "description": "Display name for the template-referenced item."
            },
            "template": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "action": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "deploy": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "build": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "test": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "chaos": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "idp": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "iacm": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            },
            "sto": {
              "$ref": "#/definitions/template_v1/common/TemplateRef"
            }
          },
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      },
      "pipeline": {
        "type": "object",
        "title": "pipeline",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
          },
          "name": {
            "type": "string",
            "pattern": "^[a-zA-Z_0-9-.][-0-9a-zA-Z_\\s.]{0,127}$"
          },
          "clone": {
            "$ref": "#/definitions/template_v1/Clone"
          },
          "inputs": {
            "$ref": "#/definitions/template_v1/common/NGVariableV1Wrapper"
          },
          "timeout": {
            "type": "string",
            "description": "Defines pipeline timeout",
            "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
          },
          "allow-stage-executions": {
            "type": "boolean",
            "description": "Allows stage executions."
          },
          "fixed-inputs-on-rerun": {
            "type": "boolean",
            "description": "Fixed inputs on rerun."
          },
          "delegate": {
            "$ref": "#/definitions/template_v1/common/Delegate"
          },
          "env": {
            "type": "object",
            "additionalProperties": {
              "type": "string"
            },
            "description": "Provides the default environment variables."
          },
          "repo": {
            "description": "Configures the default repository.",
            "$ref": "#/definitions/template_v1/Repository"
          },
          "barriers": {
            "type": "array",
            "description": "Barriers provides optional pipeline barriers.",
            "items": {
              "type": "string"
            }
          },
          "if": {
            "type": "string",
            "description": "If provides conditional pipeline execution logic. If the condition resolves to false, the pipeline is skipped."
          },
          "on": {
            "$ref": "#/definitions/template_v1/On"
          },
          "notifications": {
            "type": "array",
            "description": "Notifications provides optional pipeline notifications.",
            "items": {
              "$ref": "#/definitions/template_v1/NotificationRules"
            }
          },
          "tags": {
            "type": "object",
            "description": "Tags for the pipeline.",
            "additionalProperties": {
              "type": "string"
            }
          },
          "template": {
            "description": "Pipeline template reference.",
            "$ref": "#/definitions/template_v1/common/TemplateRef"
          },
          "stages": {
            "type": "array",
            "description": "Pipeline stages - can contain stages, groups, or parallel executions.",
            "items": {
              "$ref": "#/definitions/template_v1/stages/unified/StageItems"
            },
            "maxItems": 256,
            "minItems": 1
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "Clone": {
        "title": "Clone",
        "type": "object",
        "description": "Clone defines the default clone behavior.",
        "properties": {
          "depth": {
            "description": "Depth defines the clone depth.",
            "oneOf": [
              {
                "type": "integer",
                "format": "int32"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "enabled": {
            "description": "Enables or disables the default clone step.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "insecure": {
            "description": "Insecure disables ssl verification.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "lfs": {
            "description": "Lfs enables cloning lfs files.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "strategy": {
            "description": "Strategy configures the PR clone strategy.",
            "type": "string",
            "enum": [
              "source-branch",
              "merge"
            ]
          },
          "submodules": {
            "description": "Submodules enables cloning all submodules.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "tags": {
            "description": "Tags enables cloning all tags.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "trace": {
            "description": "Trace enables trace logging.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "ref": {
            "description": "Reference defines the clone ref.",
            "oneOf": [
              {
                "$ref": "#/definitions/template_v1/Reference"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "repo": {
            "description": "Repo defines the repository name or URL.",
            "type": "string",
            "minLength": 1
          },
          "connector": {
            "description": "Connector defines the connector reference.",
            "type": "string",
            "minLength": 1
          },
          "clonedir": {
            "description": "Clonedir defines the clone directory path.",
            "type": "string",
            "minLength": 1
          },
          "resources": {
            "description": "Resources defines container resource limits.",
            "$ref": "#/definitions/template_v1/Resource"
          },
          "sparse-checkout": {
            "description": "SparseCheckout defines paths to limit the clone to specific directories.",
            "oneOf": [
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "pre-fetch": {
            "description": "PreFetch defines a command to run before the clone operation.",
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          },
          "persist-credentials": {
            "description": "PersistCredentials configures git credentials to persist after clone so subsequent git operations in the workspace can authenticate.",
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "Reference": {
        "title": "Reference",
        "description": "Reference defines a git clone reference.",
        "type": "object",
        "properties": {
          "name": {
            "description": "Name provides ref name (branch name, tag name, or PR number).",
            "type": "string",
            "minLength": 1
          },
          "type": {
            "description": "Type defines the ref type.",
            "type": "string",
            "enum": [
              "branch",
              "tag",
              "pull-request",
              "commit"
            ]
          },
          "sha": {
            "description": "Sha provides the commit sha for direct sha-based clone.",
            "type": "string",
            "minLength": 1
          },
          "number": {
            "description": "Number provides the PR number for pull-request type clone.",
            "oneOf": [
              {
                "type": "integer",
                "format": "int32"
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)",
                "minLength": 1
              }
            ]
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "Resource": {
        "title": "Resource",
        "type": "object",
        "description": "Resource defines container resource limits and requests.",
        "properties": {
          "limits": {
            "description": "Limits defines the maximum resources the container can use.",
            "$ref": "#/definitions/template_v1/ResourceLimits"
          },
          "requests": {
            "description": "Requests defines the minimum resources reserved for the container.",
            "$ref": "#/definitions/template_v1/ResourceLimits"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "ResourceLimits": {
        "title": "ResourceLimits",
        "type": "object",
        "description": "ResourceLimits defines CPU and memory constraints.",
        "properties": {
          "cpu": {
            "description": "CPU allocation (e.g., \"100m\", \"0.5\", \"2\").",
            "type": "string",
            "minLength": 1
          },
          "memory": {
            "description": "Memory allocation (e.g., \"128Mi\", \"1Gi\").",
            "type": "string",
            "minLength": 1
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "Repository": {
        "title": "Repository",
        "description": "Repository defines a remote git repository.",
        "type": "object",
        "properties": {
          "connector": {
            "description": "Connector provides the repository connector.",
            "type": "string"
          },
          "name": {
            "description": "Name provides the repository name.",
            "type": "string"
          }
        }
      },
      "On": {
        "title": "On",
        "description": "On provides conditional pipeline execution logic based on trigger event and action mapping. If the conditional logic resolves to false, the pipeline is skipped.",
        "oneOf": [
          {
            "$ref": "#/definitions/template_v1/EventType"
          },
          {
            "type": "array",
            "items": {
              "$ref": "#/definitions/template_v1/OnEvent"
            }
          }
        ],
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "EventType": {
        "title": "EventType",
        "description": "EventType defines the supported trigger event types.",
        "type": "string",
        "enum": [
          "push",
          "pull_request"
        ],
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "OnEvent": {
        "title": "OnEvent",
        "description": "OnEvent represents a single event in the on array - either a string or an object with event configuration.",
        "oneOf": [
          {
            "$ref": "#/definitions/template_v1/EventType"
          },
          {
            "type": "object",
            "properties": {
              "push": {
                "$ref": "#/definitions/template_v1/BranchFilter"
              },
              "pull_request": {
                "$ref": "#/definitions/template_v1/BranchFilter"
              }
            },
            "minProperties": 1,
            "maxProperties": 1
          }
        ],
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "BranchFilter": {
        "title": "BranchFilter",
        "description": "BranchFilter defines branch filtering for push and pull_request events.",
        "type": "object",
        "properties": {
          "branches": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "NotificationRules": {
        "title": "NotificationRules",
        "description": "NotificationRules defines notification configuration for pipeline events.",
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier for the notification rule."
          },
          "name": {
            "type": "string",
            "description": "Name of the notification rule."
          },
          "disabled": {
            "type": "boolean",
            "description": "Whether the notification rule is disabled."
          },
          "on": {
            "type": "array",
            "description": "Notification events that trigger the notification.",
            "items": {
              "$ref": "#/definitions/template_v1/NotificationEvent"
            }
          },
          "uses": {
            "type": "string",
            "description": "Notification channel type.",
            "enum": [
              "email",
              "webhook",
              "pagerduty",
              "msteams",
              "slack",
              "datadog"
            ]
          },
          "with": {
            "description": "Channel-specific configuration based on 'uses' type.",
            "oneOf": [
              {
                "$ref": "#/definitions/template_v1/PmsEmailChannel"
              },
              {
                "$ref": "#/definitions/template_v1/PmsSlackChannel"
              },
              {
                "$ref": "#/definitions/template_v1/PmsMSTeamChannel"
              },
              {
                "$ref": "#/definitions/template_v1/PmsWebhookChannel"
              },
              {
                "$ref": "#/definitions/template_v1/PmsPagerDutyChannel"
              },
              {
                "$ref": "#/definitions/template_v1/PmsDatadogChannel"
              }
            ]
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "NotificationEvent": {
        "title": "NotificationEvent",
        "description": "NotificationEvent defines event types that trigger notifications.",
        "type": "object",
        "properties": {
          "pipeline": {
            "description": "Pipeline-level events.",
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "all",
                  "start",
                  "success",
                  "failed",
                  "end"
                ]
              },
              {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "all",
                    "start",
                    "success",
                    "failed",
                    "end"
                  ]
                }
              }
            ]
          },
          "stage": {
            "description": "Stage-level events.",
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "all"
                ]
              },
              {
                "type": "array",
                "items": {
                  "oneOf": [
                    {
                      "type": "string",
                      "enum": [
                        "all",
                        "start",
                        "success",
                        "failed"
                      ]
                    },
                    {
                      "type": "object",
                      "properties": {
                        "all": {
                          "oneOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            }
                          ]
                        },
                        "start": {
                          "oneOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            }
                          ]
                        },
                        "success": {
                          "oneOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            }
                          ]
                        },
                        "failed": {
                          "oneOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "array",
                              "items": {
                                "type": "string"
                              }
                            }
                          ]
                        }
                      },
                      "minProperties": 1,
                      "maxProperties": 1
                    }
                  ]
                }
              }
            ]
          },
          "step": {
            "description": "Step-level events.",
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "failed"
                ]
              },
              {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "failed"
                  ]
                }
              }
            ]
          },
          "trigger": {
            "description": "Trigger-level events.",
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "failed"
                ]
              },
              {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "failed"
                  ]
                }
              }
            ]
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "PmsEmailChannel": {
        "title": "PmsEmailChannel",
        "description": "Email notification channel configuration.",
        "type": "object",
        "required": [
          "recipients"
        ],
        "properties": {
          "user-groups": {
            "description": "List of user group references.",
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            ]
          },
          "recipients": {
            "description": "List of email recipients.",
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "PmsSlackChannel": {
        "title": "PmsSlackChannel",
        "description": "Slack notification channel configuration.",
        "type": "object",
        "required": [
          "webhook"
        ],
        "properties": {
          "user-groups": {
            "description": "List of user group references.",
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            ]
          },
          "webhook": {
            "description": "Slack webhook URL.",
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "PmsMSTeamChannel": {
        "title": "PmsMSTeamChannel",
        "description": "Microsoft Teams notification channel configuration.",
        "type": "object",
        "required": [
          "keys"
        ],
        "properties": {
          "keys": {
            "description": "List of MS Teams webhook keys.",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "user-groups": {
            "description": "List of user group references.",
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            ]
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "PmsWebhookChannel": {
        "title": "PmsWebhookChannel",
        "description": "Webhook notification channel configuration.",
        "type": "object",
        "required": [
          "url"
        ],
        "properties": {
          "url": {
            "description": "Webhook URL.",
            "type": "string"
          },
          "headers": {
            "description": "HTTP headers for the webhook request.",
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "PmsPagerDutyChannel": {
        "title": "PmsPagerDutyChannel",
        "description": "PagerDuty notification channel configuration.",
        "type": "object",
        "required": [
          "key"
        ],
        "properties": {
          "user-groups": {
            "description": "List of user group references.",
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            ]
          },
          "key": {
            "description": "PagerDuty integration key.",
            "type": "string"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "PmsDatadogChannel": {
        "title": "PmsDatadogChannel",
        "description": "Datadog notification channel configuration.",
        "type": "object",
        "required": [
          "api-key",
          "url"
        ],
        "properties": {
          "api-key": {
            "description": "Datadog API key.",
            "type": "string"
          },
          "url": {
            "description": "Datadog URL endpoint.",
            "type": "string"
          },
          "headers": {
            "description": "HTTP headers for the request.",
            "type": "object",
            "additionalProperties": {
              "type": "string"
            }
          },
          "delegate": {
            "description": "Delegate selectors.",
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "execute-on-delegate": {
            "description": "Whether to execute on delegate.",
            "type": "boolean"
          }
        },
        "$schema": "http://json-schema.org/draft-07/schema#"
      },
      "stages": {
        "unified": {
          "StageItems": {
            "title": "StageItems",
            "description": "Available stage types for pipeline execution.",
            "type": "object",
            "if": {
              "anyOf": [
                {
                  "required": [
                    "steps"
                  ]
                },
                {
                  "required": [
                    "chain"
                  ]
                },
                {
                  "required": [
                    "parallel"
                  ]
                },
                {
                  "required": [
                    "group"
                  ]
                },
                {
                  "required": [
                    "template"
                  ]
                },
                {
                  "required": [
                    "action"
                  ]
                },
                {
                  "required": [
                    "deploy"
                  ]
                },
                {
                  "required": [
                    "build"
                  ]
                },
                {
                  "required": [
                    "test"
                  ]
                },
                {
                  "required": [
                    "chaos"
                  ]
                },
                {
                  "required": [
                    "idp"
                  ]
                },
                {
                  "required": [
                    "iacm"
                  ]
                },
                {
                  "required": [
                    "sto"
                  ]
                }
              ]
            },
            "then": {
              "allOf": [
                {
                  "if": {
                    "required": [
                      "steps"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/stages/unified/UnifiedStageNodeV1"
                  }
                },
                {
                  "if": {
                    "required": [
                      "chain"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/stages/unified/UnifiedPipelineStageNode"
                  }
                },
                {
                  "if": {
                    "required": [
                      "parallel"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/stages/unified/ParallelStages"
                  }
                },
                {
                  "if": {
                    "required": [
                      "group"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/stages/unified/GroupStages"
                  }
                },
                {
                  "if": {
                    "anyOf": [
                      {
                        "required": [
                          "template"
                        ]
                      },
                      {
                        "required": [
                          "action"
                        ]
                      },
                      {
                        "required": [
                          "deploy"
                        ]
                      },
                      {
                        "required": [
                          "build"
                        ]
                      },
                      {
                        "required": [
                          "test"
                        ]
                      },
                      {
                        "required": [
                          "chaos"
                        ]
                      },
                      {
                        "required": [
                          "idp"
                        ]
                      },
                      {
                        "required": [
                          "iacm"
                        ]
                      },
                      {
                        "required": [
                          "sto"
                        ]
                      }
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/common/UnifiedTemplate"
                  }
                }
              ]
            },
            "else": {
              "required": [
                "steps"
              ]
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedStageNodeV1": {
            "title": "UnifiedStageNodeV1",
            "description": "Unified stage node supporting CI, CD, IaCM and other stage types.",
            "type": "object",
            "required": [
              "steps"
            ],
            "properties": {
              "id": {
                "type": "string",
                "description": "Unique identifier for the stage."
              },
              "name": {
                "type": "string",
                "description": "Display name of the stage."
              },
              "desc": {
                "type": "string",
                "description": "Description of the stage."
              },
              "tags": {
                "type": "object",
                "description": "Tags for the stage.",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "if": {
                "type": "string",
                "description": "Conditional execution expression. Stage is skipped if condition resolves to false."
              },
              "inputs": {
                "$ref": "#/definitions/template_v1/common/NGVariableV1Wrapper"
              },
              "delegate": {
                "$ref": "#/definitions/template_v1/common/Delegate"
              },
              "strategy": {
                "description": "Execution strategy (matrix, parallelism, etc.).",
                "$ref": "#/definitions/template_v1/common/StrategyConfigV1"
              },
              "timeout": {
                "type": "string",
                "description": "Stage timeout duration.",
                "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
              },
              "labels": {
                "type": "object",
                "description": "Labels for the stage.",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "exports": {
                "type": "object",
                "description": "Export configuration for stage outputs."
              },
              "on-failure": {
                "$ref": "#/definitions/template_v1/common/OnFailure"
              },
              "needs": {
                "description": "Stage dependencies (stages that must complete before this one).",
                "oneOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                ]
              },
              "runs-on": {
                "type": "string",
                "description": "Infrastructure/runner specification."
              },
              "steps": {
                "type": "array",
                "description": "List of steps to execute in the stage.",
                "items": {
                  "$ref": "#/definitions/template_v1/steps/unified/StepItems"
                }
              },
              "rollback": {
                "type": "array",
                "description": "Rollback steps to execute on failure.",
                "items": {
                  "$ref": "#/definitions/template_v1/steps/unified/StepItems"
                }
              },
              "runtime": {
                "description": "Runtime configuration (cloud, VM, Kubernetes).",
                "$ref": "#/definitions/template_v1/stages/unified/RuntimeV1"
              },
              "clone": {
                "type": "object",
                "description": "Git clone configuration for the stage.",
                "$ref": "#/definitions/template_v1/Clone"
              },
              "platform": {
                "type": "object",
                "description": "Platform configuration (OS, architecture).",
                "properties": {
                  "os": {
                    "type": "string",
                    "enum": [
                      "linux",
                      "windows",
                      "macos"
                    ]
                  },
                  "arch": {
                    "type": "string",
                    "enum": [
                      "amd64",
                      "arm64"
                    ]
                  }
                }
              },
              "service": {
                "description": "Service configuration for CD stages.",
                "$ref": "#/definitions/template_v1/stages/unified/ServiceV1"
              },
              "environment": {
                "description": "Environment configuration for CD stages.",
                "$ref": "#/definitions/template_v1/stages/unified/EnvironmentV1"
              },
              "workspace": {
                "type": "string",
                "description": "IaCM workspace identifier."
              },
              "remote-execution": {
                "type": "string",
                "description": "Remote execution configuration for IaCM."
              },
              "tofu-module": {
                "type": "string",
                "description": "OpenTofu/Terraform module reference."
              },
              "env": {
                "type": "object",
                "description": "Environment variables for the stage.",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "cache": {
                "description": "Cache intelligence configuration.",
                "$ref": "#/definitions/template_v1/stages/unified/CachingV1"
              },
              "build-intelligence": {
                "description": "Build intelligence configuration for test optimization.",
                "$ref": "#/definitions/template_v1/stages/unified/BuildIntelligenceV1"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "RuntimeV1": {
            "title": "RuntimeV1",
            "description": "Defines the runtime execution engine. Can be a string shorthand or object with configuration.",
            "$schema": "http://json-schema.org/draft-07/schema#",
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "cloud",
                  "shell",
                  "vm",
                  "k8"
                ]
              },
              {
                "type": "object",
                "oneOf": [
                  {
                    "properties": {
                      "shell": {
                        "$ref": "#/definitions/template_v1/stages/unified/ShellRuntimeSpec"
                      }
                    },
                    "required": [
                      "shell"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "properties": {
                      "cloud": {
                        "$ref": "#/definitions/template_v1/stages/unified/CloudRuntimeSpec"
                      }
                    },
                    "required": [
                      "cloud"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "properties": {
                      "vm": {
                        "$ref": "#/definitions/template_v1/stages/unified/VMRuntimeSpec"
                      }
                    },
                    "required": [
                      "vm"
                    ],
                    "additionalProperties": false
                  },
                  {
                    "properties": {
                      "kubernetes": {
                        "$ref": "#/definitions/template_v1/stages/unified/K8RuntimeSpec"
                      }
                    },
                    "required": [
                      "kubernetes"
                    ],
                    "additionalProperties": false
                  }
                ]
              }
            ]
          },
          "ShellRuntimeSpec": {
            "title": "ShellRuntimeSpec",
            "description": "Shell runtime specification.",
            "type": "object",
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "CloudRuntimeSpec": {
            "title": "CloudRuntimeSpec",
            "description": "Cloud runtime specification.",
            "type": "object",
            "properties": {},
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "VMRuntimeSpec": {
            "title": "VMRuntimeSpec",
            "description": "VM runtime specification.",
            "type": "object",
            "required": [
              "pool"
            ],
            "properties": {
              "pool": {
                "description": "VM pool identifier. Supports expressions.",
                "type": "string"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "K8RuntimeSpec": {
            "title": "K8RuntimeSpec",
            "description": "Kubernetes runtime specification.",
            "type": "object",
            "properties": {
              "namespace": {
                "description": "Kubernetes namespace. Supports expressions.",
                "type": "string"
              },
              "connector": {
                "description": "Kubernetes connector reference. Supports expressions.",
                "type": "string"
              },
              "user": {
                "description": "User ID to run container as. Supports expressions.",
                "oneOf": [
                  {
                    "type": "integer"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "pull": {
                "description": "Image pull policy. Supports expressions.",
                "oneOf": [
                  {
                    "type": "string",
                    "enum": [
                      "always",
                      "never",
                      "if-not-exists"
                    ]
                  },
                  {
                    "type": "string"
                  }
                ]
              },
              "os": {
                "description": "Operating system type. Supports expressions.",
                "oneOf": [
                  {
                    "type": "string",
                    "enum": [
                      "Linux",
                      "MacOS",
                      "Windows"
                    ]
                  },
                  {
                    "type": "string"
                  }
                ]
              },
              "harness-image-connector": {
                "description": "Harness image connector for pulling images. Supports expressions.",
                "type": "string"
              },
              "automount-service-token": {
                "description": "Whether to automount service account token. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "priority-class": {
                "description": "Kubernetes priority class name. Supports expressions.",
                "type": "string"
              },
              "tolerations": {
                "description": "Kubernetes pod tolerations.",
                "type": "array",
                "items": {
                  "$ref": "#/definitions/template_v1/stages/unified/Toleration"
                }
              },
              "host": {
                "description": "Host aliases for the pod. Supports expressions.",
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
              "node-selector": {
                "description": "Kubernetes node selector. Supports expressions.",
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
              "timeout": {
                "description": "Init timeout duration. Supports expressions.",
                "type": "string",
                "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
              },
              "service-account": {
                "description": "Kubernetes service account name. Supports expressions.",
                "type": "string"
              },
              "labels": {
                "description": "Pod labels. Supports expressions.",
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
              "annotations": {
                "description": "Pod annotations. Supports expressions.",
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
              "volumes": {
                "description": "Volume configurations. Supports expressions.",
                "oneOf": [
                  {
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/template_v1/stages/unified/CIVolumeV1"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "pod-spec-overlay": {
                "description": "Pod spec overlay JSON/YAML. Supports expressions.",
                "type": "string"
              },
              "security-context": {
                "description": "Pod security context. Supports expressions.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/stages/unified/SecurityContextV1"
                  },
                  {
                    "type": "string"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "Toleration": {
            "title": "Toleration",
            "description": "Kubernetes pod toleration.",
            "type": "object",
            "properties": {
              "effect": {
                "description": "Toleration effect. Supports expressions.",
                "type": "string"
              },
              "key": {
                "description": "Toleration key. Supports expressions.",
                "type": "string"
              },
              "operator": {
                "description": "Toleration operator. Supports expressions.",
                "type": "string"
              },
              "tolerationSeconds": {
                "description": "Toleration seconds for NoExecute effect. Supports expressions.",
                "oneOf": [
                  {
                    "type": "integer"
                  },
                  {
                    "type": "string",
                    "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
                  }
                ]
              },
              "value": {
                "description": "Toleration value. Supports expressions.",
                "type": "string"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "CIVolumeV1": {
            "title": "CIVolumeV1",
            "description": "CI volume configuration. Type determined by 'uses' property.",
            "type": "object",
            "required": [
              "uses",
              "with"
            ],
            "properties": {
              "name": {
                "description": "Volume name.",
                "type": "string"
              },
              "uses": {
                "description": "Volume type.",
                "type": "string",
                "enum": [
                  "empty-dir",
                  "persistent-volume-claim",
                  "host-path",
                  "config-map",
                  "secret"
                ]
              }
            },
            "allOf": [
              {
                "if": {
                  "properties": {
                    "uses": {
                      "const": "empty-dir"
                    }
                  }
                },
                "then": {
                  "properties": {
                    "with": {
                      "$ref": "#/definitions/template_v1/stages/unified/EmptyDirYamlV1Spec"
                    }
                  }
                }
              },
              {
                "if": {
                  "properties": {
                    "uses": {
                      "const": "persistent-volume-claim"
                    }
                  }
                },
                "then": {
                  "properties": {
                    "with": {
                      "$ref": "#/definitions/template_v1/stages/unified/PersistentVolumeClaimYamlSpecV1"
                    }
                  }
                }
              },
              {
                "if": {
                  "properties": {
                    "uses": {
                      "const": "host-path"
                    }
                  }
                },
                "then": {
                  "properties": {
                    "with": {
                      "$ref": "#/definitions/template_v1/stages/unified/HostPathYamlSpecV1"
                    }
                  }
                }
              },
              {
                "if": {
                  "properties": {
                    "uses": {
                      "const": "config-map"
                    }
                  }
                },
                "then": {
                  "properties": {
                    "with": {
                      "$ref": "#/definitions/template_v1/stages/unified/ConfigMapVolumeYamlSpecV1"
                    }
                  }
                }
              },
              {
                "if": {
                  "properties": {
                    "uses": {
                      "const": "secret"
                    }
                  }
                },
                "then": {
                  "properties": {
                    "with": {
                      "$ref": "#/definitions/template_v1/stages/unified/SecretVolumeYamlSpecV1"
                    }
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "EmptyDirYamlV1Spec": {
            "title": "EmptyDirYamlV1Spec",
            "description": "EmptyDir volume specification.",
            "type": "object",
            "required": [
              "mount-path"
            ],
            "properties": {
              "mount-path": {
                "description": "Mount path in the container. Supports expressions.",
                "type": "string"
              },
              "medium": {
                "description": "Storage medium (Memory or default). Supports expressions.",
                "type": "string"
              },
              "size": {
                "description": "Size limit for the volume. Supports expressions.",
                "type": "string"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "PersistentVolumeClaimYamlSpecV1": {
            "title": "PersistentVolumeClaimYamlSpecV1",
            "description": "PersistentVolumeClaim volume specification.",
            "type": "object",
            "required": [
              "mount-path",
              "claim-name"
            ],
            "properties": {
              "mount-path": {
                "description": "Mount path in the container. Supports expressions.",
                "type": "string"
              },
              "claim-name": {
                "description": "Name of the PersistentVolumeClaim. Supports expressions.",
                "type": "string"
              },
              "read-only": {
                "description": "Whether to mount as read-only. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "HostPathYamlSpecV1": {
            "title": "HostPathYamlSpecV1",
            "description": "HostPath volume specification.",
            "type": "object",
            "required": [
              "mount-path",
              "path"
            ],
            "properties": {
              "mount-path": {
                "description": "Mount path in the container. Supports expressions.",
                "type": "string"
              },
              "path": {
                "description": "Path on the host. Supports expressions.",
                "type": "string"
              },
              "type": {
                "description": "HostPath type (DirectoryOrCreate, Directory, FileOrCreate, File, Socket, CharDevice, BlockDevice). Supports expressions.",
                "type": "string"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "ConfigMapVolumeYamlSpecV1": {
            "title": "ConfigMapVolumeYamlSpecV1",
            "description": "ConfigMap volume specification.",
            "type": "object",
            "required": [
              "mount-path",
              "name"
            ],
            "properties": {
              "mount-path": {
                "description": "Mount path in the container. Supports expressions.",
                "type": "string"
              },
              "name": {
                "description": "Name of the ConfigMap. Supports expressions.",
                "type": "string"
              },
              "optional": {
                "description": "Whether the ConfigMap must exist. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "SecretVolumeYamlSpecV1": {
            "title": "SecretVolumeYamlSpecV1",
            "description": "Secret volume specification.",
            "type": "object",
            "required": [
              "mount-path",
              "name"
            ],
            "properties": {
              "mount-path": {
                "description": "Mount path in the container. Supports expressions.",
                "type": "string"
              },
              "name": {
                "description": "Name of the Secret. Supports expressions.",
                "type": "string"
              },
              "optional": {
                "description": "Whether the Secret must exist. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "SecurityContextV1": {
            "title": "SecurityContextV1",
            "description": "Kubernetes pod security context.",
            "type": "object",
            "properties": {
              "allow-privilege-escalation": {
                "description": "Whether to allow privilege escalation. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "proc-mount": {
                "description": "Proc mount type. Supports expressions.",
                "type": "string"
              },
              "privileged": {
                "description": "Whether to run in privileged mode. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "read-only-root-file-system": {
                "description": "Whether root filesystem is read-only. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "run-as-non-root": {
                "description": "Whether to run as non-root user. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "run-as-group": {
                "description": "Group ID to run container as. Supports expressions.",
                "oneOf": [
                  {
                    "type": "integer"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "user": {
                "description": "User ID to run container as. Supports expressions.",
                "oneOf": [
                  {
                    "type": "integer"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "capabilities": {
                "description": "Container capabilities configuration. Supports expressions.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/stages/unified/Capabilities"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "Capabilities": {
            "title": "Capabilities",
            "description": "Container capabilities configuration.",
            "type": "object",
            "properties": {
              "add": {
                "description": "Capabilities to add. Supports expressions.",
                "oneOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "drop": {
                "description": "Capabilities to drop. Supports expressions.",
                "oneOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "ServiceV1": {
            "title": "ServiceV1",
            "description": "Service configuration for CD stages. Supports multiple formats.",
            "oneOf": [
              {
                "$ref": "#/definitions/template_v1/stages/unified/ServiceItem"
              },
              {
                "type": "object",
                "required": [
                  "items"
                ],
                "properties": {
                  "items": {
                    "description": "List of services for multi-service deployment.",
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/template_v1/stages/unified/ServiceItem"
                    }
                  },
                  "sequential": {
                    "description": "Execute services sequentially (one at a time). When false, services run in parallel.",
                    "type": "boolean",
                    "default": false
                  }
                },
                "additionalProperties": false
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "ServiceItem": {
            "title": "ServiceItem",
            "description": "Single service item configuration.",
            "oneOf": [
              {
                "type": "string",
                "description": "Service identifier reference."
              },
              {
                "type": "object",
                "required": [
                  "id"
                ],
                "properties": {
                  "id": {
                    "description": "Service identifier.",
                    "type": "string"
                  },
                  "ref": {
                    "description": "Git branch for the service configuration.",
                    "type": "string"
                  },
                  "with": {
                    "description": "Service input overrides.",
                    "$ref": "#/definitions/template_v1/common/WithInputs"
                  }
                },
                "additionalProperties": false
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "EnvironmentV1": {
            "title": "EnvironmentV1",
            "description": "Environment configuration for CD stages.",
            "type": "object",
            "if": {
              "anyOf": [
                {
                  "required": [
                    "deploy-to"
                  ]
                },
                {
                  "required": [
                    "items"
                  ]
                },
                {
                  "required": [
                    "group"
                  ]
                },
                {
                  "required": [
                    "filters"
                  ]
                }
              ]
            },
            "then": {
              "allOf": [
                {
                  "if": {
                    "required": [
                      "deploy-to"
                    ]
                  },
                  "then": {
                    "type": "object",
                    "required": [
                      "id",
                      "deploy-to"
                    ],
                    "properties": {
                      "id": {
                        "description": "Environment identifier.",
                        "type": "string"
                      },
                      "deploy-to": {
                        "description": "Infrastructure(s) to deploy to.",
                        "$ref": "#/definitions/template_v1/stages/unified/DeployTo"
                      },
                      "ref": {
                        "description": "Git branch for the environment configuration.",
                        "type": "string"
                      }
                    },
                    "additionalProperties": false
                  }
                },
                {
                  "if": {
                    "required": [
                      "items"
                    ]
                  },
                  "then": {
                    "type": "object",
                    "required": [
                      "items"
                    ],
                    "properties": {
                      "items": {
                        "description": "List of environments for multi-environment deployment.",
                        "type": "array",
                        "items": {
                          "$ref": "#/definitions/template_v1/stages/unified/EnvironmentItem"
                        }
                      },
                      "sequential": {
                        "description": "Execute environments sequentially (one at a time). When false, environments run in parallel.",
                        "type": "boolean",
                        "default": false
                      }
                    },
                    "additionalProperties": false
                  }
                },
                {
                  "if": {
                    "required": [
                      "group"
                    ]
                  },
                  "then": {
                    "type": "object",
                    "required": [
                      "group"
                    ],
                    "properties": {
                      "group": {
                        "description": "Environment group configuration.",
                        "$ref": "#/definitions/template_v1/stages/unified/EnvironmentGroup"
                      },
                      "sequential": {
                        "description": "Execute environments sequentially (one at a time). When false, environments run in parallel.",
                        "type": "boolean",
                        "default": false
                      }
                    },
                    "additionalProperties": false
                  }
                },
                {
                  "if": {
                    "required": [
                      "filters"
                    ]
                  },
                  "then": {
                    "type": "object",
                    "required": [
                      "filters"
                    ],
                    "properties": {
                      "filters": {
                        "description": "Filters for selecting environments and infrastructures.",
                        "$ref": "#/definitions/template_v1/stages/unified/Filters"
                      },
                      "sequential": {
                        "description": "Execute environments sequentially (one at a time). When false, environments run in parallel.",
                        "type": "boolean",
                        "default": false
                      }
                    },
                    "additionalProperties": false
                  }
                }
              ]
            },
            "else": {
              "required": [
                "deploy-to"
              ]
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "DeployTo": {
            "title": "DeployTo",
            "description": "Infrastructure deployment target configuration.",
            "oneOf": [
              {
                "$ref": "#/definitions/template_v1/stages/unified/InfraItem"
              },
              {
                "type": "array",
                "items": {
                  "$ref": "#/definitions/template_v1/stages/unified/InfraItem"
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "InfraItem": {
            "title": "InfraItem",
            "description": "Single infrastructure item configuration.",
            "oneOf": [
              {
                "type": "string",
                "description": "Infrastructure identifier."
              },
              {
                "type": "object",
                "required": [
                  "id"
                ],
                "properties": {
                  "id": {
                    "description": "Infrastructure identifier.",
                    "type": "string"
                  },
                  "with": {
                    "description": "Infrastructure input overrides.",
                    "$ref": "#/definitions/template_v1/common/WithInputs"
                  }
                },
                "additionalProperties": false
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "EnvironmentItem": {
            "title": "EnvironmentItem",
            "description": "Single environment item configuration.",
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "description": "Environment identifier.",
                "type": "string"
              },
              "ref": {
                "description": "Git branch for the environment configuration.",
                "type": "string"
              }
            },
            "oneOf": [
              {
                "required": [
                  "deploy-to"
                ],
                "properties": {
                  "deploy-to": {
                    "description": "Infrastructure(s) to deploy to.",
                    "$ref": "#/definitions/template_v1/stages/unified/DeployTo"
                  }
                }
              },
              {
                "required": [
                  "filters"
                ],
                "properties": {
                  "filters": {
                    "description": "Filters for selecting infrastructures.",
                    "$ref": "#/definitions/template_v1/stages/unified/Filters"
                  }
                }
              }
            ],
            "additionalProperties": false,
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "Filters": {
            "title": "Filters",
            "description": "Filters for selecting environments or infrastructures.",
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "infrastructures": {
                  "description": "Infrastructure filters.",
                  "oneOf": [
                    {
                      "type": "string",
                      "enum": [
                        "all"
                      ]
                    },
                    {
                      "type": "array",
                      "items": {
                        "$ref": "#/definitions/template_v1/stages/unified/FilterCondition"
                      }
                    },
                    {
                      "type": "object",
                      "properties": {
                        "or": {
                          "type": "array",
                          "items": {
                            "$ref": "#/definitions/template_v1/stages/unified/FilterCondition"
                          }
                        },
                        "and": {
                          "type": "array",
                          "items": {
                            "$ref": "#/definitions/template_v1/stages/unified/FilterCondition"
                          }
                        }
                      },
                      "additionalProperties": false
                    }
                  ]
                },
                "environments": {
                  "description": "Environment filters.",
                  "oneOf": [
                    {
                      "type": "string",
                      "enum": [
                        "all"
                      ]
                    },
                    {
                      "type": "array",
                      "items": {
                        "$ref": "#/definitions/template_v1/stages/unified/FilterCondition"
                      }
                    },
                    {
                      "type": "object",
                      "properties": {
                        "or": {
                          "type": "array",
                          "items": {
                            "$ref": "#/definitions/template_v1/stages/unified/FilterCondition"
                          }
                        },
                        "and": {
                          "type": "array",
                          "items": {
                            "$ref": "#/definitions/template_v1/stages/unified/FilterCondition"
                          }
                        }
                      },
                      "additionalProperties": false
                    }
                  ]
                }
              },
              "additionalProperties": false
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "FilterCondition": {
            "title": "FilterCondition",
            "description": "Filter condition for property-based filtering (e.g., tags).",
            "type": "object",
            "properties": {
              "tags": {
                "description": "Tag-based filter conditions.",
                "type": "object",
                "oneOf": [
                  {
                    "required": [
                      "in"
                    ],
                    "properties": {
                      "in": {
                        "description": "Match any of the specified tags (OR).",
                        "type": "object",
                        "additionalProperties": {
                          "type": "string"
                        }
                      }
                    },
                    "additionalProperties": false
                  },
                  {
                    "required": [
                      "all"
                    ],
                    "properties": {
                      "all": {
                        "description": "Match all of the specified tags (AND).",
                        "type": "object",
                        "additionalProperties": {
                          "type": "string"
                        }
                      }
                    },
                    "additionalProperties": false
                  }
                ]
              }
            },
            "additionalProperties": false,
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "EnvironmentGroup": {
            "title": "EnvironmentGroup",
            "description": "Environment group configuration.",
            "type": "object",
            "required": [
              "id"
            ],
            "properties": {
              "id": {
                "description": "Environment group identifier.",
                "type": "string"
              },
              "items": {
                "description": "List of environments from the group.",
                "type": "array",
                "items": {
                  "$ref": "#/definitions/template_v1/stages/unified/EnvironmentItem"
                }
              }
            },
            "additionalProperties": false,
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "CachingV1": {
            "title": "CachingV1",
            "description": "Cache intelligence configuration.",
            "type": "object",
            "properties": {
              "enabled": {
                "description": "Whether caching is enabled.",
                "type": "boolean"
              },
              "path": {
                "description": "Paths to cache.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "key": {
                "description": "Cache key.",
                "type": "string"
              },
              "override": {
                "description": "Whether to override existing cache.",
                "type": "boolean"
              },
              "policy": {
                "description": "Cache policy (pull, push, pull-push).",
                "type": "string",
                "enum": [
                  "pull",
                  "push",
                  "pull-push"
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "BuildIntelligenceV1": {
            "title": "BuildIntelligenceV1",
            "description": "Build intelligence configuration for test optimization.",
            "type": "object",
            "properties": {
              "enabled": {
                "description": "Whether build intelligence is enabled. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedPipelineStageNode": {
            "title": "UnifiedPipelineStageNode",
            "description": "Pipeline chain stage node for chaining pipelines.",
            "allOf": [
              {
                "$ref": "#/definitions/template_v1/steps/unified/UnifiedPmsAbstractStepNode"
              },
              {
                "type": "object",
                "required": [
                  "chain"
                ],
                "properties": {
                  "chain": {
                    "description": "Pipeline chain configuration.",
                    "type": "object",
                    "required": [
                      "uses"
                    ],
                    "properties": {
                      "uses": {
                        "description": "Reference to the pipeline to be chained.",
                        "type": "string"
                      },
                      "with": {
                        "description": "Parameters for the chained pipeline.",
                        "type": "object",
                        "properties": {
                          "inputs": {
                            "description": "Input parameters for the chained pipeline. Supports expressions.",
                            "oneOf": [
                              {
                                "type": "object",
                                "additionalProperties": true
                              },
                              {
                                "type": "string",
                                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                              }
                            ]
                          },
                          "outputs": {
                            "description": "Output mappings from the chained pipeline.",
                            "type": "array",
                            "items": {
                              "$ref": "#/definitions/template_v1/stages/unified/PipelineStageOutputs"
                            }
                          },
                          "input-sets": {
                            "description": "Input set references to apply.",
                            "type": "array",
                            "items": {
                              "type": "string"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "PipelineStageOutputs": {
            "title": "PipelineStageOutputs",
            "description": "Output configuration for pipeline stage.",
            "type": "object",
            "required": [
              "name",
              "value"
            ],
            "properties": {
              "name": {
                "description": "Output variable name.",
                "type": "string",
                "pattern": "^[a-zA-Z_][0-9a-zA-Z_]*$"
              },
              "value": {
                "description": "Output value expression. Supports expressions.",
                "type": "string"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "ParallelStages": {
            "title": "ParallelStages",
            "description": "Parallel stages execution configuration.",
            "type": "object",
            "required": [
              "parallel"
            ],
            "properties": {
              "parallel": {
                "description": "Stages to execute in parallel.",
                "type": "object",
                "required": [
                  "stages"
                ],
                "properties": {
                  "stages": {
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/template_v1/stages/unified/StageItems"
                    },
                    "minItems": 1
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "GroupStages": {
            "title": "GroupStages",
            "description": "Group of stages executed sequentially.",
            "type": "object",
            "required": [
              "group"
            ],
            "properties": {
              "group": {
                "description": "Group configuration.",
                "type": "object",
                "properties": {
                  "id": {
                    "description": "Unique identifier for the group.",
                    "type": "string"
                  },
                  "name": {
                    "description": "Display name of the group.",
                    "type": "string"
                  },
                  "stages": {
                    "description": "Stages within the group.",
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/template_v1/stages/unified/StageItems"
                    },
                    "minItems": 1
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          }
        }
      },
      "steps": {
        "unified": {
          "StepItems": {
            "title": "StepItems",
            "description": "Available step types for pipeline execution.",
            "type": "object",
            "if": {
              "anyOf": [
                {
                  "required": [
                    "run"
                  ]
                },
                {
                  "required": [
                    "clone"
                  ]
                },
                {
                  "required": [
                    "background"
                  ]
                },
                {
                  "required": [
                    "run-test"
                  ]
                },
                {
                  "required": [
                    "wait"
                  ]
                },
                {
                  "required": [
                    "barrier"
                  ]
                },
                {
                  "required": [
                    "queue"
                  ]
                },
                {
                  "required": [
                    "policy"
                  ]
                },
                {
                  "required": [
                    "approval"
                  ]
                },
                {
                  "required": [
                    "parallel"
                  ]
                },
                {
                  "required": [
                    "group"
                  ]
                },
                {
                  "required": [
                    "template"
                  ]
                },
                {
                  "required": [
                    "action"
                  ]
                },
                {
                  "required": [
                    "deploy"
                  ]
                },
                {
                  "required": [
                    "build"
                  ]
                },
                {
                  "required": [
                    "test"
                  ]
                },
                {
                  "required": [
                    "chaos"
                  ]
                },
                {
                  "required": [
                    "idp"
                  ]
                },
                {
                  "required": [
                    "iacm"
                  ]
                },
                {
                  "required": [
                    "sto"
                  ]
                }
              ]
            },
            "then": {
              "allOf": [
                {
                  "if": {
                    "anyOf": [
                      {
                        "required": [
                          "run"
                        ]
                      },
                      {
                        "required": [
                          "clone"
                        ]
                      },
                      {
                        "required": [
                          "background"
                        ]
                      },
                      {
                        "required": [
                          "run-test"
                        ]
                      }
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/StepNodeV1"
                  }
                },
                {
                  "if": {
                    "required": [
                      "wait"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/UnifiedWaitStepNode"
                  }
                },
                {
                  "if": {
                    "required": [
                      "barrier"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/UnifiedBarrierStepNode"
                  }
                },
                {
                  "if": {
                    "required": [
                      "queue"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/UnifiedQueueStepNode"
                  }
                },
                {
                  "if": {
                    "required": [
                      "policy"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/UnifiedPolicyStepNode"
                  }
                },
                {
                  "if": {
                    "required": [
                      "approval"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/UnifiedApprovalStepNode"
                  }
                },
                {
                  "if": {
                    "required": [
                      "parallel"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/ParallelSteps"
                  }
                },
                {
                  "if": {
                    "required": [
                      "group"
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/steps/unified/GroupSteps"
                  }
                },
                {
                  "if": {
                    "anyOf": [
                      {
                        "required": [
                          "template"
                        ]
                      },
                      {
                        "required": [
                          "action"
                        ]
                      },
                      {
                        "required": [
                          "deploy"
                        ]
                      },
                      {
                        "required": [
                          "build"
                        ]
                      },
                      {
                        "required": [
                          "test"
                        ]
                      },
                      {
                        "required": [
                          "chaos"
                        ]
                      },
                      {
                        "required": [
                          "idp"
                        ]
                      },
                      {
                        "required": [
                          "iacm"
                        ]
                      },
                      {
                        "required": [
                          "sto"
                        ]
                      }
                    ]
                  },
                  "then": {
                    "$ref": "#/definitions/template_v1/common/UnifiedTemplate"
                  }
                }
              ]
            },
            "else": {
              "required": [
                "run"
              ]
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "StepNodeV1": {
            "title": "StepNodeV1",
            "description": "Unified step node for CI/CD pipelines.",
            "type": "object",
            "anyOf": [
              {
                "required": [
                  "run"
                ]
              },
              {
                "required": [
                  "clone"
                ]
              },
              {
                "required": [
                  "background"
                ]
              },
              {
                "required": [
                  "run-test"
                ]
              }
            ],
            "properties": {
              "id": {
                "description": "Unique identifier for the step.",
                "type": "string"
              },
              "name": {
                "description": "Display name of the step.",
                "type": "string"
              },
              "desc": {
                "description": "Description of the step.",
                "type": "string"
              },
              "if": {
                "description": "Conditional execution expression. Step is skipped if condition resolves to false. Supports expressions.",
                "type": "string"
              },
              "strategy": {
                "description": "Execution strategy (matrix, for, while, repeat). Supports expressions.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/common/StrategyConfigV1"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "enforce": {
                "description": "Policy enforcement configuration.",
                "$ref": "#/definitions/template_v1/steps/unified/PolicyConfig"
              },
              "needs": {
                "description": "Step dependencies (steps that must complete before this one).",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "on-failure": {
                "$ref": "#/definitions/template_v1/common/OnFailure"
              },
              "timeout": {
                "description": "Step timeout duration. Supports expressions.",
                "type": "string",
                "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
              },
              "run": {
                "description": "Run step configuration. Can be a simple command string or a detailed run configuration object.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/steps/unified/RunStepInfoV1"
                  },
                  {
                    "type": "string"
                  }
                ]
              },
              "run-test": {
                "description": "Run tests step configuration. Supports expressions.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/steps/unified/RunTestsStepInfoV1"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "clone": {
                "description": "Git clone step configuration.",
                "$ref": "#/definitions/template_v1/Clone"
              },
              "background": {
                "description": "Background service step configuration. Supports expressions.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/steps/unified/RunStepInfoV1"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "PolicyConfig": {
            "title": "PolicyConfig",
            "description": "Policy enforcement configuration.",
            "type": "object",
            "properties": {
              "policySets": {
                "description": "Policy sets to enforce.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "RunStepInfoV1": {
            "title": "RunStepInfoV1",
            "description": "Run step configuration for executing scripts.",
            "type": "object",
            "properties": {
              "shell": {
                "description": "Shell type to use. Supports expressions.",
                "type": "string"
              },
              "script": {
                "description": "Script to execute. Supports expressions.",
                "type": "string"
              },
              "container": {
                "description": "Container configuration for the step.",
                "$ref": "#/definitions/template_v1/steps/unified/Container"
              },
              "output": {
                "description": "Output variables to capture.",
                "type": "array",
                "items": {
                  "$ref": "#/definitions/template_v1/common/OutputV1"
                }
              },
              "report": {
                "description": "Test report configuration. Supports expressions.",
                "$ref": "#/definitions/template_v1/steps/unified/Report"
              },
              "delegate": {
                "description": "Delegate selectors.",
                "$ref": "#/definitions/template_v1/common/Delegate"
              },
              "env": {
                "description": "Environment variables. Supports expressions.",
                "$ref": "#/definitions/template_v1/common/ObjectOrExpression"
              },
              "with": {
                "description": "Additional parameters. Supports expressions.",
                "$ref": "#/definitions/template_v1/common/ObjectOrExpression"
              },
              "download": {
                "description": "Download configuration. Supports expressions.",
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "source": {
                        "description": "Source URL to download from.",
                        "type": "string"
                      },
                      "target": {
                        "description": "Target path to save the file.",
                        "type": "string"
                      },
                      "checksum": {
                        "description": "Checksum to verify the downloaded file.",
                        "type": "string"
                      },
                      "fallback": {
                        "description": "Fallback URL if primary source fails.",
                        "type": "string"
                      }
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "output-alias": {
                "description": "Output alias configuration for exporting variables.",
                "type": "object",
                "required": [
                  "key",
                  "scope"
                ],
                "properties": {
                  "key": {
                    "description": "Output variable key. Supports expressions.",
                    "type": "string"
                  },
                  "scope": {
                    "description": "Export scope for the output.",
                    "type": "string",
                    "enum": [
                      "Pipeline",
                      "Stage",
                      "StepGroup"
                    ]
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "Container": {
            "title": "Container",
            "description": "Container configuration for step execution.",
            "type": "object",
            "properties": {
              "image": {
                "description": "Container image to use. Supports expressions.",
                "type": "string"
              },
              "connector": {
                "description": "Image registry connector. Supports expressions.",
                "type": "string"
              },
              "credentials": {
                "description": "Container registry credentials.",
                "type": "object",
                "properties": {
                  "username": {
                    "description": "Registry username.",
                    "type": "string"
                  },
                  "password": {
                    "description": "Registry password.",
                    "type": "string"
                  },
                  "aws": {
                    "description": "AWS ECR credentials.",
                    "type": "object",
                    "properties": {
                      "access-key": {
                        "description": "AWS access key.",
                        "type": "string"
                      },
                      "secret-key": {
                        "description": "AWS secret key.",
                        "type": "string"
                      }
                    }
                  }
                }
              },
              "pull": {
                "description": "Image pull policy. Supports expressions.",
                "oneOf": [
                  {
                    "type": "string",
                    "enum": [
                      "always",
                      "never",
                      "if-not-exists"
                    ]
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "entrypoint": {
                "description": "Container entrypoint.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "args": {
                "description": "Container arguments.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "dns": {
                "description": "Custom DNS servers.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "env": {
                "description": "Environment variables.",
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              },
              "extra-hosts": {
                "description": "Extra hosts to add to /etc/hosts.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "network": {
                "description": "Docker network name.",
                "type": "string"
              },
              "network-mode": {
                "description": "Docker network mode.",
                "type": "string"
              },
              "privileged": {
                "description": "Run in privileged mode. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "workdir": {
                "description": "Working directory.",
                "type": "string"
              },
              "ports": {
                "description": "Ports to expose.",
                "type": "array",
                "items": {
                  "type": "string"
                }
              },
              "port-bindings": {
                "description": "Port bindings. Supports expressions.",
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "volumes": {
                "description": "Volume mounts.",
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "source": {
                      "description": "Source path.",
                      "type": "string"
                    },
                    "target": {
                      "description": "Target path in container.",
                      "type": "string"
                    }
                  }
                }
              },
              "user": {
                "description": "User ID to run as. Supports expressions.",
                "oneOf": [
                  {
                    "type": "integer"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "group": {
                "description": "Group to run as.",
                "type": "string"
              },
              "cpu": {
                "description": "CPU limit.",
                "type": "string"
              },
              "memory": {
                "description": "Memory limit.",
                "type": "string"
              },
              "shm-size": {
                "description": "Shared memory size.",
                "type": "string"
              },
              "files": {
                "description": "Files to inject into container.",
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "Report": {
            "title": "Report",
            "description": "Test report configuration.",
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "paths": {
                    "description": "Report file paths. Can be single value or array. Supports expressions.",
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
                  "type": {
                    "description": "Report type.",
                    "type": "string",
                    "enum": [
                      "junit"
                    ]
                  }
                }
              },
              {
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "RunTestsStepInfoV1": {
            "title": "RunTestsStepInfoV1",
            "description": "Run tests step configuration for test intelligence.",
            "type": "object",
            "properties": {
              "shell": {
                "description": "Shell type to use. Supports expressions.",
                "type": "string"
              },
              "script": {
                "description": "Test command to execute. Supports expressions.",
                "type": "string"
              },
              "match": {
                "description": "Test file patterns to match. Supports expressions.",
                "oneOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "container": {
                "description": "Container configuration for the step.",
                "$ref": "#/definitions/template_v1/steps/unified/Container"
              },
              "output": {
                "description": "Output variables to capture.",
                "type": "array",
                "items": {
                  "$ref": "#/definitions/template_v1/common/OutputV1"
                }
              },
              "report": {
                "description": "Test report configuration. Supports expressions.",
                "$ref": "#/definitions/template_v1/steps/unified/Report"
              },
              "delegate": {
                "description": "Delegate selectors.",
                "$ref": "#/definitions/template_v1/common/Delegate"
              },
              "env": {
                "description": "Environment variables. Supports expressions.",
                "$ref": "#/definitions/template_v1/common/ObjectOrExpression"
              },
              "with": {
                "description": "Additional parameters. Supports expressions.",
                "$ref": "#/definitions/template_v1/common/ObjectOrExpression"
              },
              "intelligence": {
                "description": "Test intelligence configuration.",
                "type": "object",
                "properties": {
                  "disabled": {
                    "description": "Whether test intelligence is disabled. Supports expressions.",
                    "oneOf": [
                      {
                        "type": "boolean"
                      },
                      {
                        "type": "string",
                        "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                      }
                    ]
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedWaitStepNode": {
            "title": "UnifiedWaitStepNode",
            "description": "Wait step node for pausing pipeline execution.",
            "allOf": [
              {
                "$ref": "#/definitions/template_v1/steps/unified/UnifiedPmsAbstractStepNode"
              },
              {
                "type": "object",
                "required": [
                  "wait"
                ],
                "properties": {
                  "wait": {
                    "description": "Wait step configuration.",
                    "type": "object",
                    "required": [
                      "duration"
                    ],
                    "properties": {
                      "duration": {
                        "description": "Duration to wait (e.g., 10s, 5m, 1h). Supports expressions.",
                        "type": "string",
                        "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
                      }
                    }
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedPmsAbstractStepNode": {
            "title": "UnifiedPmsAbstractStepNode",
            "description": "Abstract step node with common properties shared by all step types.",
            "type": "object",
            "properties": {
              "id": {
                "description": "Unique identifier for the step.",
                "type": "string"
              },
              "name": {
                "description": "Display name of the step.",
                "type": "string"
              },
              "desc": {
                "description": "Description of the step.",
                "type": "string"
              },
              "if": {
                "description": "Conditional execution expression. Step is skipped if condition resolves to false. Supports expressions.",
                "type": "string"
              },
              "strategy": {
                "description": "Execution strategy (matrix, for, while, repeat). Supports expressions.",
                "oneOf": [
                  {
                    "$ref": "#/definitions/template_v1/common/StrategyConfigV1"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "enforce": {
                "description": "Policy enforcement configuration.",
                "$ref": "#/definitions/template_v1/steps/unified/PolicyConfig"
              },
              "on-failure": {
                "$ref": "#/definitions/template_v1/common/OnFailure"
              },
              "timeout": {
                "description": "Step timeout duration. Supports expressions.",
                "type": "string",
                "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedBarrierStepNode": {
            "title": "UnifiedBarrierStepNode",
            "description": "Barrier step node for synchronizing pipeline execution.",
            "allOf": [
              {
                "$ref": "#/definitions/template_v1/steps/unified/UnifiedPmsAbstractStepNode"
              },
              {
                "type": "object",
                "required": [
                  "barrier"
                ],
                "properties": {
                  "barrier": {
                    "description": "Barrier step configuration.",
                    "type": "object",
                    "required": [
                      "name"
                    ],
                    "properties": {
                      "name": {
                        "description": "Reference name of the barrier defined in pipeline barriers.",
                        "type": "string"
                      }
                    }
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedQueueStepNode": {
            "title": "UnifiedQueueStepNode",
            "description": "Queue step node for resource constraint management.",
            "allOf": [
              {
                "$ref": "#/definitions/template_v1/steps/unified/UnifiedPmsAbstractStepNode"
              },
              {
                "type": "object",
                "required": [
                  "queue"
                ],
                "properties": {
                  "queue": {
                    "description": "Queue step configuration.",
                    "type": "object",
                    "required": [
                      "key",
                      "scope"
                    ],
                    "properties": {
                      "key": {
                        "description": "Resource key for the queue. Supports expressions.",
                        "type": "string",
                        "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                      },
                      "scope": {
                        "description": "Scope of the queue holding.",
                        "type": "string",
                        "enum": [
                          "Pipeline",
                          "Stage"
                        ]
                      }
                    }
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedPolicyStepNode": {
            "title": "UnifiedPolicyStepNode",
            "description": "Policy step node for OPA policy evaluation.",
            "allOf": [
              {
                "$ref": "#/definitions/template_v1/steps/unified/UnifiedPmsAbstractStepNode"
              },
              {
                "type": "object",
                "required": [
                  "policy"
                ],
                "properties": {
                  "policy": {
                    "description": "Policy step configuration.",
                    "type": "object",
                    "required": [
                      "sets",
                      "payload"
                    ],
                    "properties": {
                      "sets": {
                        "description": "Policy sets to evaluate. Supports single value or array. Supports expressions.",
                        "oneOf": [
                          {
                            "type": "array",
                            "items": {
                              "type": "string"
                            }
                          },
                          {
                            "type": "string",
                            "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                          }
                        ]
                      },
                      "payload": {
                        "description": "JSON payload to evaluate against policies. Supports expressions.",
                        "type": "string",
                        "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                      }
                    }
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedApprovalStepNode": {
            "title": "UnifiedApprovalStepNode",
            "description": "Approval step node for manual, Jira, ServiceNow, or custom approvals.",
            "allOf": [
              {
                "$ref": "#/definitions/template_v1/steps/unified/UnifiedPmsAbstractStepNode"
              },
              {
                "type": "object",
                "required": [
                  "approval"
                ],
                "properties": {
                  "approval": {
                    "description": "Approval step configuration.",
                    "type": "object",
                    "required": [
                      "uses"
                    ],
                    "properties": {
                      "uses": {
                        "description": "Type of approval.",
                        "type": "string",
                        "enum": [
                          "harness",
                          "jira",
                          "servicenow",
                          "custom"
                        ]
                      },
                      "with": {
                        "description": "Approval type-specific configuration.",
                        "type": "object"
                      }
                    },
                    "allOf": [
                      {
                        "if": {
                          "properties": {
                            "uses": {
                              "const": "harness"
                            }
                          }
                        },
                        "then": {
                          "properties": {
                            "with": {
                              "$ref": "#/definitions/template_v1/steps/unified/UnifiedManualApprovalStepSpec"
                            }
                          }
                        }
                      },
                      {
                        "if": {
                          "properties": {
                            "uses": {
                              "const": "jira"
                            }
                          }
                        },
                        "then": {
                          "properties": {
                            "with": {
                              "$ref": "#/definitions/template_v1/steps/unified/UnifiedJiraApprovalStepSpec"
                            }
                          }
                        }
                      },
                      {
                        "if": {
                          "properties": {
                            "uses": {
                              "const": "servicenow"
                            }
                          }
                        },
                        "then": {
                          "properties": {
                            "with": {
                              "$ref": "#/definitions/template_v1/steps/unified/UnifiedServiceNowApprovalStepSpec"
                            }
                          }
                        }
                      },
                      {
                        "if": {
                          "properties": {
                            "uses": {
                              "const": "custom"
                            }
                          }
                        },
                        "then": {
                          "properties": {
                            "with": {
                              "$ref": "#/definitions/template_v1/steps/unified/UnifiedCustomApprovalStepSpec"
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ],
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedManualApprovalStepSpec": {
            "title": "UnifiedManualApprovalStepSpec",
            "description": "Harness manual approval step specification.",
            "type": "object",
            "properties": {
              "message": {
                "description": "Approval message. Supports expressions.",
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
              },
              "callback": {
                "description": "Callback ID for the approval. Supports expressions.",
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
              },
              "user-groups": {
                "description": "User groups for approval. Supports single value or array. Supports expressions.",
                "oneOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "service-accounts": {
                "description": "Service accounts for approval. Supports single value or array. Supports expressions.",
                "oneOf": [
                  {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "approvers-min-count": {
                "description": "Minimum number of approvers required. Supports expressions.",
                "oneOf": [
                  {
                    "type": "integer"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "block-executor": {
                "description": "Block pipeline executor from approving. Supports expressions.",
                "oneOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                  }
                ]
              },
              "execution-details": {
                "description": "Include pipeline execution history.",
                "type": "boolean"
              },
              "auto-reject": {
                "description": "Enable automatic rejection on timeout.",
                "type": "boolean"
              },
              "auto-approve": {
                "description": "Enable automatic approval.",
                "type": "boolean"
              },
              "timezone": {
                "description": "Timezone for auto-approval deadline. Supports expressions.",
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
              },
              "deadline": {
                "description": "Deadline for auto-approval. Supports expressions.",
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
              },
              "comments": {
                "description": "Comments for auto-approval. Supports expressions.",
                "type": "string",
                "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
              },
              "params": {
                "description": "Approver input parameters.",
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": true
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedJiraApprovalStepSpec": {
            "title": "UnifiedJiraApprovalStepSpec",
            "description": "Jira approval step specification.",
            "type": "object",
            "required": [
              "retry",
              "approve",
              "source"
            ],
            "properties": {
              "retry": {
                "description": "Retry interval for polling Jira.",
                "type": "string"
              },
              "approve": {
                "description": "Approval criteria configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "reject": {
                "description": "Rejection criteria configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "source": {
                "description": "Shell script source configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "run": {
                "description": "Run step configuration for script execution.",
                "$ref": "#/definitions/template_v1/steps/unified/RunStepInfoV1"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedServiceNowApprovalStepSpec": {
            "title": "UnifiedServiceNowApprovalStepSpec",
            "description": "ServiceNow approval step specification.",
            "type": "object",
            "required": [
              "retry",
              "approve",
              "source"
            ],
            "properties": {
              "retry": {
                "description": "Retry interval for polling ServiceNow.",
                "type": "string"
              },
              "approve": {
                "description": "Approval criteria configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "reject": {
                "description": "Rejection criteria configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "source": {
                "description": "Shell script source configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "run": {
                "description": "Run step configuration for script execution.",
                "$ref": "#/definitions/template_v1/steps/unified/RunStepInfoV1"
              },
              "change-window": {
                "description": "ServiceNow change window configuration.",
                "type": "object",
                "properties": {
                  "start": {
                    "description": "Start field for change window.",
                    "type": "string"
                  },
                  "end": {
                    "description": "End field for change window.",
                    "type": "string"
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "UnifiedCustomApprovalStepSpec": {
            "title": "UnifiedCustomApprovalStepSpec",
            "description": "Custom approval step specification.",
            "type": "object",
            "required": [
              "retry",
              "approve",
              "source"
            ],
            "properties": {
              "script-timeout": {
                "description": "Timeout for script execution.",
                "type": "string"
              },
              "retry": {
                "description": "Retry interval for polling.",
                "type": "string"
              },
              "approve": {
                "description": "Approval criteria configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "reject": {
                "description": "Rejection criteria configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "source": {
                "description": "Shell script source configuration.",
                "type": "object",
                "additionalProperties": true
              },
              "run": {
                "description": "Run step configuration for script execution.",
                "$ref": "#/definitions/template_v1/steps/unified/RunStepInfoV1"
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "ParallelSteps": {
            "title": "ParallelSteps",
            "description": "Defines a list of steps to be executed in parallel.",
            "type": "object",
            "required": [
              "parallel"
            ],
            "properties": {
              "parallel": {
                "type": "object",
                "required": [
                  "steps"
                ],
                "properties": {
                  "steps": {
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/template_v1/steps/unified/StepItems"
                    }
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          },
          "GroupSteps": {
            "title": "GroupSteps",
            "description": "Defines a group of steps.",
            "type": "object",
            "required": [
              "group"
            ],
            "properties": {
              "group": {
                "type": "object",
                "required": [
                  "steps"
                ],
                "properties": {
                  "id": {
                    "type": "string",
                    "description": "Unique identifier for the step group.",
                    "pattern": "^[a-zA-Z_][0-9a-zA-Z_]{0,127}$"
                  },
                  "name": {
                    "type": "string",
                    "description": "Display name of the step group."
                  },
                  "desc": {
                    "type": "string",
                    "description": "Description of the step group."
                  },
                  "if": {
                    "type": "string",
                    "description": "Conditional execution expression. Group is skipped if condition resolves to false."
                  },
                  "strategy": {
                    "description": "Execution strategy (matrix, for, while, repeat). Supports expressions.",
                    "oneOf": [
                      {
                        "$ref": "#/definitions/template_v1/common/StrategyConfigV1"
                      },
                      {
                        "type": "string",
                        "pattern": "(\\$\\{\\{.+\\}\\}|<\\+.+>.*)"
                      }
                    ]
                  },
                  "on-failure": {
                    "$ref": "#/definitions/template_v1/common/OnFailure"
                  },
                  "timeout": {
                    "type": "string",
                    "description": "Step group timeout duration.",
                    "pattern": "^(([1-9])+\\d+[s])|(((([1-9])+\\d*[mhwd])+([\\s]?\\d+[smhwd])*)|(.*<\\+.*>(?!.*\\.executionInput\\(\\)).*)|(^$))$"
                  },
                  "steps": {
                    "type": "array",
                    "items": {
                      "$ref": "#/definitions/template_v1/steps/unified/StepItems"
                    }
                  }
                }
              }
            },
            "$schema": "http://json-schema.org/draft-07/schema#"
          }
        }
      }
    }
  }
};
export default schema;
