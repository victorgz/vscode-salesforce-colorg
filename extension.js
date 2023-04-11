// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const watchers = [];
const OLD_PATH = '**/.sfdx/sfdx-config.json';
const NEW_PATH = '**/.sf/config.json';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

async function activate() {
	const handleFileContent = (uri) => {
		const file = requireUncached(uri.path);
		const conf = vscode.workspace.getConfiguration();

		const targets = conf.get('sf-colorg.rules') || [];
		let targetColor = null;
		for (let target of targets) {
			const attribute = uri.path.includes('/.sfdx/')
				? 'defaultusername'
				: 'target-org';

			if (new RegExp(target.regex).test(file[attribute])) {
				targetColor = target.color;
				break;
			}
		}
		setColor(targetColor);
	};

	const init = async () => {
		// Initial setup
		try {
			await initialCleanup();
			let files = await vscode.workspace.findFiles(NEW_PATH);

			if (files.length > 0) {
				handleFileContent(files[0]);
			} else {
				files = await vscode.workspace.findFiles(OLD_PATH);

				if (files.length > 0) {
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

	// File change watchet
	watchers.push(vscode.workspace.createFileSystemWatcher(OLD_PATH));
	watchers.push(vscode.workspace.createFileSystemWatcher(NEW_PATH));

	// Event listener
	watchers.forEach((watcher) => {
		watcher.onDidChange((uri) => handleFileContent(uri));
		watcher.onDidCreate((uri) => handleFileContent(uri));
	});
}

async function setColor(color) {
	const config = vscode.workspace.getConfiguration();
	const colorCustomizations = config.get('workbench.colorCustomizations');
	const statusBar = config.get('sf-colorg.target.statusBar');
	const activityBar = config.get('sf-colorg.target.activityBar');

	if (statusBar || color == null) {
		colorCustomizations['statusBar.background'] = color;
	} else {
		colorCustomizations['statusBar.background'] = undefined;
	}

	if (activityBar || color == null) {
		colorCustomizations['activityBar.background'] = color;
	} else {
		colorCustomizations['activityBar.background'] = undefined;
	}

	await vscode.workspace
		.getConfiguration()
		.update(
			'workbench.colorCustomizations',
			colorCustomizations,
			vscode.ConfigurationTarget.Workspace
		);
}

// Remove previous color customizations to avoid color blinking when switching to an unknown config
async function initialCleanup() {
	const config = vscode.workspace.getConfiguration();
	const colorCustomizations = config.get('workbench.colorCustomizations');

	colorCustomizations['statusBar.background'] = undefined;
	colorCustomizations['activityBar.background'] = undefined;

	return vscode.workspace
		.getConfiguration()
		.update(
			'workbench.colorCustomizations',
			colorCustomizations,
			vscode.ConfigurationTarget.Global
		);
}

function requireUncached(module) {
	delete require.cache[require.resolve(module)];
	return require(module);
}

// This method is called when your extension is deactivated
async function deactivate() {
	watchers.forEach((watcher) => {
		watcher.dispose();
	});
	setColor(null);
}

module.exports = {
	activate,
	deactivate,
};
