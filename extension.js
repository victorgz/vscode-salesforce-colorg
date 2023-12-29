// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const watchers = [];
const OLD_PATH = '**/.sfdx/sfdx-config.json';
const NEW_PATH = '**/.sf/config.json';
const outputChannel = vscode.window.createOutputChannel('SF Colorg');

async function getSfConfigFile() {
	const configFile = await vscode.workspace.findFiles(
		`{${NEW_PATH},${OLD_PATH}}`,
		'**/node_modules/**',
		1
	);

	// return regardless of whether it's found or not
	return configFile[0];
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
async function activate() {
	/**
	 *
	 * @param {string} uri - file uri of the config file
	 * @param {vscode.WorkspaceConfiguration} [vscodeConfig] - vscode configuration object
	 */
	const handleFileContent = async(uri, vscodeConfig = vscode.workspace.getConfiguration()) => {
		const file = requireUncached(path.resolve(uri.fsPath));
		const targets = await vscodeConfig.get('sf-colorg.rules') || [];
		let targetBackgroundColor = undefined;
		let targetForegroundColor = undefined;

		for (let target of targets) {
			const attribute = uri.fsPath.includes('/.sfdx/')
				? 'defaultusername'
				: 'target-org';

			if (new RegExp(target.regex).test(file[attribute])) {
				targetBackgroundColor = target.color;
				targetForegroundColor = target.foregroundColor;
				break;
			}
		}

		setColor(targetBackgroundColor, targetForegroundColor);
	};

	const init = async () => {
		// Initial setup
		await initialCleanup();
		const sfConfigFile = await getSfConfigFile();

		if (!sfConfigFile || !vscode.window.state.focused) {
			return;
		} else {
			outputChannel.appendLine('Found config file:', JSON.stringify(sfConfigFile));
			handleFileContent(sfConfigFile);
		}
	};

	init();

	// Config change listener
	vscode.workspace.onDidChangeConfiguration((changeConfigEvent) => {
		if (changeConfigEvent.affectsConfiguration('sf-colorg')) {
			init();
		}
	});

	// Event listener for when the window is focused
	vscode.window.onDidChangeWindowState(async () => {
		const vscodeConfig = vscode.workspace.getConfiguration();
		const sfConfigFile = await getSfConfigFile();

		if (!sfConfigFile) {
			return setColor(undefined, undefined);
		}

		if (vscode.window.state.focused &&
			vscodeConfig.get('sf-colorg.target.settingsScope') === 'user') {
			// Ignore the unnecessary await warning here, it's needed.
			const isASfProject = await checkIfInSfProject();

			// If the focused window is explictly confirmed to be a SF project
			if (isASfProject === true) {
				// Bypass initialization if targets are already available
				return handleFileContent(sfConfigFile, vscodeConfig);
			}
		}
	});

	// File change watcher
	let oldPathFile = await vscode.workspace.findFiles(OLD_PATH, null, 1);
	if (oldPathFile.length > 0) {
		watchers.push(
			vscode.workspace.createFileSystemWatcher(
				path.resolve(oldPathFile[0].fsPath)
			)
		);
	}
	let newPathFile = await vscode.workspace.findFiles(NEW_PATH, null, 1);
	if (newPathFile.length > 0) {
		watchers.push(
			vscode.workspace.createFileSystemWatcher(
				path.resolve(newPathFile[0].fsPath)
			)
		);
	}

	// Event listener
	watchers.forEach((watcher) => {
		watcher.onDidChange((uri) => handleFileContent(uri));
		watcher.onDidCreate((uri) => handleFileContent(uri));
	});
}

/**
 * Checks if the active editor is in a Salesforce project
 * @returns {boolean} true if the active editor is in a Salesforce project
 */
async function checkIfInSfProject() {
	const sfdxConfigFiles = await vscode.workspace.findFiles(
		OLD_PATH || NEW_PATH,
		null,
		1
	);

	if (sfdxConfigFiles.length > 0) {
		return true;
	}
	return false;
}

/**
 * Updates the VSCode workbench colors for the status and activity bars.
 * @param {string} backgroundColor - Hex color code for the background color.
 * @param {string} [foregroundColor] - Optional hex color code for the foreground color.
 */
async function setColor(backgroundColor, foregroundColor) {
	const config = vscode.workspace.getConfiguration();
	const newColorSettings = {};

	newColorSettings['statusBar.background'] = backgroundColor;
	newColorSettings['activityBar.background'] = backgroundColor;
	newColorSettings['statusBar.foreground'] = foregroundColor;
	newColorSettings['activityBar.inactiveForeground'] = foregroundColor;

	try {
		await config.update(
			'workbench.colorCustomizations',
			newColorSettings,
			getSettingsScope(config)
		);
	} catch (error) {
		console.error('Error updating color settings:', error);
	}
}

// Remove previous color customizations to avoid color blinking when switching to an unknown config
async function initialCleanup() {
	const config = vscode.workspace.getConfiguration();
	const target = getSettingsScope(config);

	if (target === vscode.ConfigurationTarget.Global) {
		const colorCustomizations = config.get('workbench.colorCustomizations');

		colorCustomizations['statusBar.foreground'] = undefined;
		colorCustomizations['statusBar.background'] = undefined;
		colorCustomizations['activityBar.inactiveForeground'] = undefined;
		colorCustomizations['activityBar.background'] = undefined;

		return config.update(
			'workbench.colorCustomizations',
			colorCustomizations,
			target
		);
	}
}

/**
 * Returns the configuration target for the settings scope in which color changes will be added
 * in specified in the extensions configuration.
 * Defaults to 'Global' if not specified.
 *
 * @param {vscode.WorkspaceConfiguration} config - workspace configuration object
 * @returns {vscode.ConfigurationTarget} - color settings target
 */
function getSettingsScope(config) {
	try {
		// default to 'user' if setting is absent
		const settingsScope =
			config.get('sf-colorg.target.settingsScope') || 'user';

		if (settingsScope === 'workspace') {
			// workspace settings
			return vscode.ConfigurationTarget.Workspace;
		}
		// user settings
		return vscode.ConfigurationTarget.Global;
	} catch (error) {
		console.error('Error in getting settings scope: ', error);
	}
}

function requireUncached(module) {
	delete require.cache[require.resolve(path.resolve(module))];
	return require(path.resolve(module));
}

// This method is called when your extension is deactivated
async function deactivate() {
	watchers.forEach((watcher) => {
		watcher.dispose();
	});
	setColor(undefined, undefined);
}

module.exports = {
	activate,
	deactivate,
};
