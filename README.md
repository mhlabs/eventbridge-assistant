# Eventbridge Assistant

This extension integrates with Amazon EventBridge Schema Registry to provide autocomplete when composing event patterns.

![Demo](./images/demo.gif)

## Known issues

* It currently only supports YAML templates and the schema registries `aws.events` and `discovered-schemas`
* Certain other extensions might push down the suggestions provided by this extension on the list

## Unknown issues

There are many ways vscode can be configured and this has been validated on a few of them. That said - there might be unforeseen bugs when parsing the YAML.

If you encounter any issues, please take a moment to report them [here](https://github.com/mhlabs/eventbridge-assistant/issues)


