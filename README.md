## Configuration

This extension is designed to be used as a front-end interface to the [Automatic Formal Verification tool](https://github.com/input-output-hk/sc-fvt) developed by the Cardano High Assurance team. To use this extension you will need to first have the Automatic Formal Verification tool installed. Follow the instructions below to set up your environment so you can use the extension

1. Download the Automatic Formal Verification tool and follow the readme in the AFV repo to ensure your installation and development environment are working properly.
2. Once the Automatic Formal Verification tool is working you can install and activate the VS Code extension from the Visual Studio Marketplace or from the Extensions panel in VS Code.

## Features

The AFV Extension comes with several features that allow you to discover annotated properties you want to prove and inspect the results returned from the solver.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Contributions

TBA

### Folder Structure

- **`AFV-EXTENSION`**: The main application directory.
    - **`src`**: The `src` folder contains all of the extension-related source code and can be thought of as containing the "backend" code/logic for the entire extension.
        - **`extension.ts`**: Contains the logic for activating and deactiving the extension live here. This is also the place where extension commands are registered.
        - **`views`**: Contains all of the webview-related code that will be executed within the extension context. It can be thought of as the place where all of the "backend" code for each webview panel is contained.
        - **`utils.ts`**: Contains all of the extension utility functions that make setting up and managing an extension easier. 
    - **`webview-ui`**: Contains all of the React-based webview source code and can be thought of as containing the "frontend" code/logic for the extension webview.
        - **`components`**

**Enjoy!**