## Configuration

This extension is designed to be used as a front-end interface to the [Automatic Formal Verification tool](https://github.com/input-output-hk/sc-fvt) developed by the Cardano High Assurance team. To use this extension you will need to first have the Automatic Formal Verification tool installed. Follow the instructions below to set up your environment so you can use the extension

1. Download the Automatic Formal Verification tool and follow the readme in the AFV repo to ensure your installation and development environment are working properly.
2. Once the Automatic Formal Verification tool is working you can install and activate the VS Code extension from the Visual Studio Marketplace or from the Extensions panel in VS Code.

## Getting Started Locally

To run this extension locally for development or testing purposes, follow the steps below:

1. **Ensure AFV Executable Is Globally Available**

The `sc-verifier` CLI tool must be available globally on your system (i.e., accessible from your terminal or command prompt). You can verify this by running:

```bash
sc-verifier --help
```

2. **Clone the Repository**
```bash
git clone https://github.com/input-output-hk/afv-extension.git
cd afv-extension
```

3. **Install Dependencies**

Make sure you have [Node.js](https://nodejs.org/en/) and [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) installed on your system. 

Then install the project dependencies:
```bash
npm install
```

4. **Start the Extension in Debug Mode**

Open the extension project in Visual Studio Code. Press `F5` to launch the extension in debugging mode. This will activate your extension in a sandboxed VS Code environment where you can test and interact with it.

5. **Open the Folder Containing `.lean` Files**

   In the Extension debug window, open the folder that contains the `.lean` files you want to analyze `<your-project-root>/sc-fvt/DemoRareEvo` (This folder is found in the root directory once you pull down the sc-fvt repo).

6. **Use the Test Explorer to Run Proofs**

   Open the **Test Explorer** view in VS Code. From there, you can run proofs using the AFV tool in one of the following ways:
   
   - Run proofs on the entire folder.
   - Run proofs on a specific file.
   - Run proofs on an individual property within a file.

   The results will be streamed directly into the Test Explorer and displayed next to each test item.

## Folder Structure

- **`AFV-EXTENSION`**: The main application directory.
    - **`src`**: The `src` folder contains all of the extension-related source code and can be thought of as containing the "backend" code/logic for the entire extension.
        - **`extension.ts`**: Contains the logic for activating and deactiving the extension live here. This is also the place where extension commands are registered.
        - **`views`**: Contains all of the webview-related code that will be executed within the extension context. It can be thought of as the place where all of the "backend" code for each webview panel is contained.
        - **`utils.ts`**: Contains all of the extension utility functions that make setting up and managing an extension easier. 
    - **`webview-ui`**: Contains all of the React-based webview source code and can be thought of as containing the "frontend" code/logic for the extension webview.
        - **`components`**

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

**Enjoy!**