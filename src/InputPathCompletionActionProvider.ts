/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as jp from "jsonpath";
import { TemplateParser } from "./util/TamplateParser";
import * as filterTypes from "./schema/filterTypes.json";
import { SchemasUtil } from "./util/SchemasUtil";
export class InputPathCompletionActionProvider
  implements vscode.CompletionItemProvider
{
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<
    | vscode.CompletionItem[]
    | vscode.CompletionList<vscode.CompletionItem>
    | null
    | undefined
  > {

    let resourceName = SchemasUtil.getResourceName(position, document);
    const template = TemplateParser.parse(document.getText());
    if (!template) {
      return { items: [], isIncomplete: true };
    }
    const resource = template.Resources[resourceName];

    const current = SchemasUtil.getCurrentLine(document.getText(), position.line)
      .split(" ");
    const currentProperty = current[0];
    if (!resource || currentProperty !== "InputPath") {
      return;
    }
    let jsonPath = "";
    if (current.length === 1) {
      jsonPath = "$";
    } else {
      jsonPath = current[1];
    }
    const schemaKeys = SchemasUtil.getSchemaKeys(resource);
    const jsonPathSplit = jsonPath.split(".");
    try {
      const registry = SchemasUtil.getRegistry(resource);
      const schema = await SchemasUtil.getSchema(
        schemaKeys.source,
        schemaKeys.detailType,
        registry
      );
      let schemaPath = schema.components.schemas.AWSEvent.properties;
      const schemaProperty = SchemasUtil.navigateSchema(
        jsonPathSplit.slice(1).filter((p) => p.length),
        schemaPath,
        schema,
        false
      );
      if (!schemaProperty.isLeaf) {
        const suggestions = Object.keys(schemaProperty.schemaPath).map(
          (key) => ({
            label: key,
            sortText: " " + key,
            insertText: `${
              current.length === 1
                ? "$."
                : !schemaProperty.isPartial
                ? jsonPathSplit.slice(-1)[0]
                : ""
            }${key}`,
            //          filterText: jsonPathSplit.slice(-1)[0],
            kind: schemaProperty.schemaPath[key]["$ref"]
              ? vscode.CompletionItemKind.Field
              : vscode.CompletionItemKind.Value,
          })
        );
        return { items: suggestions, isIncomplete: true };
      }
    } catch (e) {
      console.log(e);
    }
  }
}
