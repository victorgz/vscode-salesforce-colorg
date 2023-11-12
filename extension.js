// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const watchers = [];
const OLD_PATH = '**/.sfdx/sfdx-config.json';
const NEW_PATH = '**/.sf/config.json';
let sfConfigFile = undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
async function activate() {
	/**
	 *
	 * @param {string} uri - file uri of the config file
	 */
	const handleFileContent = (uri) => {
		const file = requireUncached(path.resolve(uri.fsPath));
		const conf = vscode.workspace.getConfiguration();
		const targets = conf.get('sf-colorg.rules') || [];
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
		try {
			await initialCleanup();
			let files = await vscode.workspace.findFiles(NEW_PATH, null, 1);

			if (files.length > 0) {
				sfConfigFile = files[0];
				handleFileContent(files[0]);
			} else {
				files = await vscode.workspace.findFiles(OLD_PATH, null, 1);

				if (files.length > 0) {
					sfConfigFile = files[0];
					handleFileContent(files[0]);
				}
			}
		} catch (err) {
			console.error(err);
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
	vscode.window.onDidChangeWindowState(() => {
		const config = vscode.workspace.getConfiguration();
		if (sfConfigFile === undefined) {
			return;
		}

		if (
			!vscode.window.state.focused &&
			config.get('sf-colorg.target.settingsScope') === 'user'
		) {
			return setColor(undefined, undefined);
		} else {
			const isASfProject = checkIfInSfProject();
			// If the focused window is confirmed to be a SF project
			if (isASfProject) {
				// Bypass initialization if targets are already available
				return handleFileContent(sfConfigFile);
			}
			return setColor(undefined, undefined);
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
	let newPathFiles = await vscode.workspace.findFiles(NEW_PATH, null, 1);
	if (newPathFiles.length > 0) {
		watchers.push(
			vscode.workspace.createFileSystemWatcher(
				path.resolve(newPathFiles[0].fsPath)
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
	if (foregroundColor !== undefined) {
		newColorSettings['statusBar.foreground'] = foregroundColor;
		newColorSettings['activityBar.inactiveForeground'] = foregroundColor;
	}

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
		let settingsScope =
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
