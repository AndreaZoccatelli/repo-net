import * as vscode from 'vscode';
import * as cp from 'child_process';

export class PythonExecutionService {
    private pythonPath: string;

    constructor(context: vscode.ExtensionContext) {
        this.pythonPath = this.getPythonPath();
        console.log('Using Python Path: ', this.pythonPath); // Log the Python path being used
    }

    // Get the Python path from the VS Code settings (Python extension)
    private getPythonPath(): string {
        // Get the Python interpreter path from the VS Code workspace settings
        const config = vscode.workspace.getConfiguration('python');
        const pythonPath = config.get<string>('pythonPath'); // This is the selected Python interpreter

        // Log and return the Python path
        if (!pythonPath) {
            vscode.window.showErrorMessage('Python interpreter is not selected.');
            return 'python'; // Fallback if no interpreter is selected
        }

        return pythonPath;
    }

    async runPythonScript(scriptPath: string, args: string[]): Promise<void> {
        const pythonProcess = cp.spawn(this.pythonPath, [scriptPath, ...args]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        return new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(`Python script exited with code ${code}`);
                }
            });
        });
    }
}
