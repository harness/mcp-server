// Auto-generated from https://raw.githubusercontent.com/harness/harness-schema/main/v1/overlayInputSet.json
// @ts-nocheck

const schema: Record<string, any> = {
  "type": "object",
  "title": "overlayInputSet_v1",
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
      "description": "defines the kind of yaml (pipeline/template)",
      "type": "string",
      "enum": [
        "overlay-input-set"
      ]
    },
    "spec": {
      "required": [
        "input_sets"
      ],
      "properties": {
        "input_sets": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    }
  },
  "definitions": {}
};
export default schema;
