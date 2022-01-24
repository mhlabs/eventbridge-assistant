/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as Schemas from "aws-sdk/clients/schemas";
import { DescribeSchemaResponse } from "aws-sdk/clients/schemas";
import * as envelope from "../schema/envelope.json";
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
      detailType = detailTypeCheck[0].replace(/ /g, "");
    }
    return { source, detailType };
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
}
