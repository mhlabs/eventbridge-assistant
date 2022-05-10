process.env.AWS_SDK_LOAD_CONFIG = "1";
import * as vscode from "vscode";
import { PatternCompletionActionProvider } from "./PatternCompletionActionProvider";
import * as AWS from "aws-sdk";
import { SingleSignOnCredentials } from "@mhlabs/aws-sdk-sso";
import { InputPathCompletionActionProvider } from "./InputPathCompletionActionProvider";
import { InputTemplateCompletionActionProvider } from "./InputTemplateCompletionActionProvider";
import { InputPathsMapCompletionActionProvider } from "./InputPathsMapCompletionActionProvider";
import sharedIniFileLoader = require("@aws-sdk/shared-ini-file-loader");
import { SchemasUtil } from "./util/SchemasUtil";

const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
  "eventbridge-assistant"
);
export async function activate(context: vscode.ExtensionContext) {
  try {
    await authenticate();
  } catch (err: any) {
    await vscode.window.showErrorMessage(err);
  }
  vscode.commands.registerCommand(
    "eventbridge-assistant.awsProfile",
    async (cmd: any) => {
      try {
        const configFiles = await sharedIniFileLoader.loadSharedConfigFiles();
        const profile = await vscode.window.showQuickPick(
          Object.keys(configFiles.configFile)
        );
        await config.update("AWSProfile", profile);
        process.env.AWS_PROFILE = profile;
        const creds = await (
          AWS.config.credentialProvider as any
        ).resolvePromise();
        creds.profile = profile;
        await creds.refreshPromise();
        SchemasUtil.schemaNames = {};
        SchemasUtil.schemaResponse = {};
        vscode.window.showInformationMessage(`Switched to profile: ${profile}`);
      } catch (err: any) {
        vscode.window.showInformationMessage(err.message);
      }
    }
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("eventbridge-assistant.enable", () => {
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new PatternCompletionActionProvider(),
        ""
      );
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new InputPathCompletionActionProvider(),
        "."
      );
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new InputPathsMapCompletionActionProvider(),
        "."
      );
      vscode.languages.registerCompletionItemProvider(
        "yaml",
        new InputTemplateCompletionActionProvider(),
        "<"
      );
    })
  );

  await vscode.commands.executeCommand("eventbridge-assistant.enable");
}

async function authenticate(profile?: any) {
  try {
    process.env.AWS_PROFILE =
      profile ||
      (await config.get("AWSProfile")) ||
      process.env.AWS_PROFILE ||
      "default";
    AWS.config.credentialProvider?.providers.unshift(
      new SingleSignOnCredentials()
    );
  } catch (err: any) {
    await vscode.window.showWarningMessage(err);
    console.log(err);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
