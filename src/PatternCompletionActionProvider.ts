/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as jp from "jsonpath";
import { TemplateParser } from "./util/TamplateParser";
import * as filterTypes from "./schema/filterTypes.json";
import { SchemasUtil } from "./util/SchemasUtil";
const jsondiffpatch = require("jsondiffpatch").create();
const schemas = new SchemasUtil();
export class PatternCompletionActionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<
    | vscode.CompletionItem[]
    | vscode.CompletionList<vscode.CompletionItem>
    | null
    | undefined
  > {
    let resourceName = schemas.getResourceName(position, document);
    const template = TemplateParser.parse(document.getText());
    if (!template) {
      return { items: [], isIncomplete: true };
    }
    const resource = template.Resources[resourceName];
    if (resource) {
      // Get and cache schema names
      await schemas.getSchemas("aws.events");
      await schemas.getSchemas("discovered-schemas");

      // Get registry based on EventBusName
      const registryName = schemas.getRegistry(resource);

      const schemaKeySuggestions = schemas.schemaKeysSuggestions(
        document,
        position,
        registryName,
        resource
      );
      if (schemaKeySuggestions) {
        return schemaKeySuggestions;
      }

      let { source, detailType }: { source: string; detailType: string } =
        schemas.getSchemaKeys(resource);

      const jsonPath = schemas.estimateJsonPath(
        resource,
        document.getText(),
        position.line
      );
      let pathSplit = jsonPath?.split("Properties.Pattern.");
      if (pathSplit.length === 1) {
        pathSplit = jsonPath?.split("Properties.EventPattern.");
      }
      const pathList = pathSplit.length > 1 ? pathSplit[1].split(".") : [];
      const schema = await schemas.getSchema(source, detailType, registryName);

      let schemaPath = schema.components.schemas.AWSEvent.properties;
      let isLeaf = false;

      ({ schemaPath, isLeaf } = schemas.navigateSchema(
        pathList,
        schemaPath,
        schema,
        isLeaf
      ));

      const schemaKeys = Object.keys(schemaPath);
      if (isLeaf) {
        const suggestions = filterTypes.map((key) => ({
          label: key.name,
		  sortText: " " + key,
		  filterText: `- ${key}`,
          insertText: key.insertText || `- ${key.name}${key.newLine ? ":\n\t- " : ": "}`,
          kind: vscode.CompletionItemKind.Event,
          range: schemas.getSuggestionRange(position, document),
        }));
        return { items: suggestions, isIncomplete: true };
      }
      const suggestions = schemaKeys.map((key) => ({
        label: key,
		sortText: " " + key,
        insertText: key + ":\n\t",
        kind: schemaPath[key]["$ref"] ? vscode.CompletionItemKind.Field : vscode.CompletionItemKind.Value,
        range: schemas.getSuggestionRange(position, document),
      }));
      return { items: suggestions, isIncomplete: true };
    }

    return { items: [], isIncomplete: true };
  }

  

  getJsonPath(oldResource: any, resource: any) {
    const diff = jsondiffpatch.diff(oldResource, resource);

    let jsonPath = pathDiff(diff)[0];
    
    if (!jsonPath) {
      return null;
    }
    const leafItem = jp.query(resource, jsonPath)[0];
    if (typeof leafItem === "object" && leafItem) {
      jsonPath += `.${Object.keys(leafItem)[0]}`;
    }
    return jsonPath;
  }
}

function pathDiff(obj: any, path?: string): string[] {
  if (!obj) {
    return [];
  }
  path = path || "$";
  
  let item: string[] = [];
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      item.push(...pathDiff(obj[key], `${path}.${key}`));
    } else {
      item.push(`${path}.${key}`);
    }
  });
  return item;
}

