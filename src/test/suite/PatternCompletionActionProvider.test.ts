import * as assert from "assert";
import * as vscode from "vscode";
import { SchemasUtil } from "../../util/SchemasUtil";
const schemas = new SchemasUtil();
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { PatternCompletionActionProvider } from "../../PatternCompletionActionProvider";
// import * as myExtension from '../../extension';
const provider = new PatternCompletionActionProvider();
suite("getJsonPath tests", () => {
  vscode.window.showInformationMessage("Start all tests.");
  test("Get JSON path test - value change", () => {
    const ob1 = {
      a: {
        b: {
          c: 10,
        },
      },
    };
    const ob2 = {
      a: {
        b: {
          c: 12,
        },
      },
    };
    const path = provider.getJsonPath(ob1, ob2);
    assert.strictEqual("$.a.b.c", path);
  });

  test("Get JSON path test - value change to null", () => {
    const ob1 = {
      a: {
        b: {
          c: 10,
        },
      },
    };
    const ob2 = {
      a: {
        b: {
          c: null,
        },
      },
    };
    const path = provider.getJsonPath(ob1, ob2);
    assert.strictEqual("$.a.b.c", path);
  });

  test("Get JSON path test - object added", () => {
    const ob1 = {
      a: {
        b: {},
      },
    };

    const ob2 = {
      a: {
        b: {
          c: null,
        },
      },
    };

    const path = provider.getJsonPath(ob1, ob2);
    assert.strictEqual("$.a.b.c", path);
  });

  test("Get JSON path test - nothing changed", () => {
    const ob1 = {
      a: {
        b: {
          c: null,
        },
      },
    };
    const ob2 = {
      a: {
        b: {
          c: null,
        },
      },
    };

    const path = provider.getJsonPath(ob1, ob2);
    assert.strictEqual(null, path);
  });

  test("Estimate JSON-path test - nothing changed", () => {
    const ob1 = {
      a: {
        b: {
          c: null,
        },
      },
    };
	const yaml = `
		a:
			b:
				c:
				`;

    const path = SchemasUtil.estimateJsonPath(ob1, yaml, 4);
    assert.strictEqual("$.a.b", path);
  });
});
