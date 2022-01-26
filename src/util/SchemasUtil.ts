/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as Schemas from "aws-sdk/clients/schemas";
import { DescribeSchemaResponse } from "aws-sdk/clients/schemas";
import * as envelope from "../schema/envelope.json";
import * as jp from "jsonpath";

const JsonFind = require("json-find");

const schemas = new Schemas();
export class SchemasUtil {
  schemaNames: { [registry: string]: string[] } = {};
  schemaResponse: { [name: string]: DescribeSchemaResponse | undefined } = {
    "@": { Content: JSON.stringify(envelope) },
  };

  async getSchemas(registryName: string) {
    if (!this.schemaNames[registryName]) {
      this.schemaNames[registryName] = [];
      let token: string | undefined;
      do {
        try {
          const schemaList = await schemas
            .listSchemas({ RegistryName: registryName, NextToken: token })
            .promise();
          if (schemaList.Schemas !== undefined) {
            this.schemaNames[registryName].push(
              ...(schemaList.Schemas?.map((p) => p.SchemaName || "") || [])
            );
          }
          token = schemaList.NextToken;
        } catch (e: any) {
          vscode.window.showErrorMessage(e.message);
        }
      } while (token);
    }
  }
  async getSchema(
    source: string,
    detailType: string,
    registryName: string | null
  ) {
    if (!registryName) {
      return;
    }
    const schemaName = source && detailType ? `${source}@${detailType}` : "@";
    this.schemaResponse[schemaName] =
      this.schemaResponse[schemaName] ||
      (await schemas
        .describeSchema({
          RegistryName: registryName,
          SchemaName: schemaName,
        })
        .promise());
    const schema = JSON.parse(this.schemaResponse[schemaName]?.Content || "{}");
    return schema;
  }

  getSchemaKeys(resource: any) {
    const doc = JsonFind(resource);
    let detailType: string = "";
    let source: string = "";

    const sourceCheck = doc.checkKey("source");
    if (sourceCheck) {
      source = sourceCheck[0];
    }
    const detailTypeCheck = doc.checkKey("detail-type");
    if (detailTypeCheck) {
      detailType = this.toPascal(detailTypeCheck[0].replace(/ /g, ""));
    }
    return { source, detailType };
  }
  private toPascal(str: string) {
    return str
      .split("/")
      .map((p) =>
        p
          .split("-")
          .map((substr) => substr.charAt(0).toUpperCase() + substr.slice(1))
          .join("")
      )
      .join("/");
  }
  getRegistry(resource: any) {
    const doc = JsonFind(resource);
    const props = JsonFind(resource.Properties);
    const isEventContextCheck = doc.checkKey("Type");
    const isEventContextSAMCheck = props.checkKey("Type");
    let isEventContext = false;
    if (isEventContextCheck) {
      isEventContext =
        isEventContextCheck === "AWS::Events::Rule" ||
        isEventContextSAMCheck === "EventBridgeRule" ||
        isEventContextSAMCheck === "CloudWatchEvent";
    }
    const eventBusNameCheck = doc.checkKey("EventBusName");
    let eventBusName: string = eventBusNameCheck || "default";
    let registryName: string = "aws.events";
    if (eventBusName !== "default") {
      registryName = "discovered-schemas";
    }
    return isEventContext ? registryName : null;
  }

  navigateSchema(
    pathList: string[],
    schemaPath: any,
    schema: any,
    isLeaf: boolean
  ) {
    for (const path of pathList || []) {
      if (!schemaPath[path]) {
        return { schemaPath, isLeaf: false, isPartial: true };
      }
      schemaPath = schemaPath[path];
      if (schemaPath["$ref"] && (schemaPath.type || "object") === "object") {
        schemaPath =
          schema.components.schemas[schemaPath["$ref"].split("/").slice(-1)[0]]
            .properties;
        isLeaf = false;
      } else if (schemaPath.type === "array") {
        schemaPath =
          schema.components.schemas[
            schemaPath.items["$ref"].split("/").slice(-1)[0]
          ].properties;
        isLeaf = false;
      } else {
        isLeaf = true;
      }
    }
    return { schemaPath, isLeaf };
  }

  sources(
    position: vscode.Position,
    document: vscode.TextDocument,
    index: number,
    registryName: string
  ) {
    const sources = [
      ...new Set(
        this.schemaNames[registryName].map((p) => p.split("@")[index])
      ),
    ];
    const suggestions = sources.map((key) => ({
      label: `${key}`,
      sortText: " " + key,
      filterText: `- ${key}`,
      insertText: `- ${key}\n`,
      kind: vscode.CompletionItemKind.Event,
      data: key,
      range: this.getSuggestionRange(position, document),
    }));
    return suggestions;
  }

  getSuggestionRange(
    position: vscode.Position,
    document: vscode.TextDocument
  ) {
    return new vscode.Range(
      position.line,
      this.getStartChar(
        document.getText(
          new vscode.Range(position.line, 0, position.line, position.character)
        )
      ).startChar,
      position.line,
      position.character
    );
  }

  getStartChar(previousRow: string): any {
    const trimmed = previousRow.trimStart();
    const startChar = previousRow.length - trimmed.length;
    return { startChar, trimmed };
  }
  detailTypes(
    position: vscode.Position,
    document: vscode.TextDocument,
    index: number,
    filter: string,
    registryName: string
  ) {
    const detailTypes = [
      ...new Set(
        this.schemaNames[registryName]
          .filter((p) => p.split("@")[0] === filter)
          .map((p) =>
            registryName === "aws.events"
              ? p
                  .split("@")
                  [index].replace(/([A-Z]+)/g, " $1")
                  .replace(/^ /, "")
              : p.split("@")[index]
          )
      ),
    ];
    const suggestions = detailTypes.map((key) => ({
      label: `${key}`,
      sortText: " " + key,
      filterText: `- ${key}`,
      insertText: `- ${key}\n`,
      kind: vscode.CompletionItemKind.Event,
      data: key,
      range: this.getSuggestionRange(position, document),
    }));
    return suggestions;
  }

  getResourceName(position: vscode.Position, document: vscode.TextDocument) {
    let line = position.line;
    let info: string = "";
    let previousStartChar = 10000;
    let resourceName;
    while (true) {
      line--;
      if (line === 1) break;
      const previousRow = document
        .getText(new vscode.Range(line, 0, line, 10000))
        .trimEnd();
      const { startChar, trimmed } = this.getStartChar(previousRow);
      info = trimmed;
      if (startChar < 4 && trimmed.endsWith(":")) {
        resourceName = info.trim().replace(":", "");
        break;
      } else if (startChar === 0 && trimmed === "Resources:") break;
      if (trimmed.length && !trimmed.startsWith("#")) {
        previousStartChar = startChar;
        resourceName = trimmed.replace(":", "");
      }
    }

    return resourceName;
  }

  getCurrentLine(document: string, line: number) {
    const lines = document.split("\n");
    return lines[line].trim().replace(":", "");
  }

  schemaKeysSuggestions(
    document: vscode.TextDocument,
    position: vscode.Position,
    registryName: string | null,
    resource: any
  ) {
    if (!registryName) {
      return null;
    }
    if (this.previousLine(document, position) === "source") {
      const suggestions = this.sources(position, document, 0, registryName);
      return { items: suggestions, isIncomplete: true };
    }

    if (this.previousLine(document, position) === "detail-type") {
      const source = jp.query(resource, "$..source");
      const suggestions = this.detailTypes(
        position,
        document,
        1,
        source[0][0],
        registryName
      );
      return { items: suggestions, isIncomplete: true };
    }
  }

  private previousLine(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    return this.getCurrentLine(document.getText(), position.line - 1);
  }

  estimateJsonPath(resource: any, document: string, line: number) {
    const lines = document.split("\n");
    const currentStartChar = this.getStartChar(lines[line]).startChar;
    let previousRow;
    for (let i = line; i >= 0; i--) {
      if (this.getStartChar(lines[i]).startChar < currentStartChar) {
        previousRow = lines[i].trim().replace(":", "");
        break;
      }
    }
    const query = jp.nodes(resource, `$..["${previousRow}"]`);
    return query[0].path.join(".");
  }
}
