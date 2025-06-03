/**
 * Interactive CLI Interface for obsidian-feed MCP Integration
 *
 * Features:
 * - Interactive menu system
 * - Real-time validation feedback
 * - Workflow progress visualization
 * - Guided task creation
 */

import * as readline from 'readline';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { MCPIntegration } from './index';
import { WorkflowManager, Phase } from './workflow';
import { WorkflowAutomation } from './workflow-automation';
import { Validator } from './validator';

// Note: Install chalk for colors: npm install chalk@4

export class InteractiveCLI {
  private rl: readline.Interface;

  private mcp!: MCPIntegration;

  private workflowManager: WorkflowManager;

  private workflowAutomation: WorkflowAutomation;

  private validator: Validator;

  private currentTaskId: string | null = null;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('mcp> '),
    });

    this.workflowManager = new WorkflowManager();
    this.workflowAutomation = new WorkflowAutomation();
    this.validator = new Validator();
  }

  async initialize(): Promise<void> {
    console.log(chalk.green('🚀 Initializing MCP Integration...'));

    this.mcp = new MCPIntegration();

    // MCPIntegration constructor handles initialization
    await this.workflowAutomation.initialize();

    console.log(chalk.green('✅ MCP Integration ready!'));
    console.log(chalk.gray('Type "help" for available commands\n'));
  }

  async start(): Promise<void> {
    await this.initialize();

    this.rl.prompt();

    this.rl.on('line', async line => {
      const input = line.trim();

      if (input === '') {
        this.rl.prompt();
        return;
      }

      await this.handleCommand(input);
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log(chalk.yellow('\n👋 Goodbye!'));
      process.exit(0);
    });
  }

  private async handleCommand(input: string): Promise<void> {
    const [command, ...args] = input.split(' ');

    switch (command.toLowerCase()) {
      case 'help':
      case '?':
        this.showHelp();
        break;

      case 'task':
        await this.handleTaskCommand(args);
        break;

      case 'validate':
      case 'v':
        await this.handleValidateCommand(args);
        break;

      case 'workflow':
      case 'w':
        await this.handleWorkflowCommand(args);
        break;

      case 'fetch':
      case 'f':
        await this.handleFetchCommand(args);
        break;

      case 'guards':
      case 'g':
        await this.listGuards();
        break;

      case 'status':
      case 's':
        await this.showStatus();
        break;

      case 'clear':
        console.clear();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        this.rl.close();
        break;

      default:
        console.log(chalk.red(`Unknown command: ${command}`));
        console.log(chalk.gray('Type "help" for available commands'));
    }
  }

  private showHelp(): void {
    console.log(chalk.bold('\n📚 Available Commands:\n'));

    const commands = [
      { cmd: 'help, ?', desc: 'Show this help message' },
      { cmd: 'task <new|select|list>', desc: 'Manage tasks' },
      { cmd: 'validate <file>', desc: 'Validate a turn file' },
      { cmd: 'workflow <init|transition|status>', desc: 'Manage workflow' },
      { cmd: 'fetch <url|library>', desc: 'Fetch documentation' },
      { cmd: 'guards', desc: 'List all available guards' },
      { cmd: 'status', desc: 'Show current task status' },
      { cmd: 'clear', desc: 'Clear the screen' },
      { cmd: 'exit, quit, q', desc: 'Exit the CLI' },
    ];

    commands.forEach(({ cmd, desc }) => {
      console.log(`  ${chalk.yellow(cmd.padEnd(30))} ${desc}`);
    });

    console.log('');
  }

  private async handleTaskCommand(args: string[]): Promise<void> {
    const [subCommand] = args;

    switch (subCommand) {
      case 'new':
        await this.createNewTask();
        break;

      case 'select':
        await this.selectTask();
        break;

      case 'list':
        await this.listTasks();
        break;

      default:
        console.log(chalk.gray('Usage: task <new|select|list>'));
    }
  }

  private async createNewTask(): Promise<void> {
    const taskId = await this.prompt('Enter task ID (e.g., TASK-001): ');
    const description = await this.prompt('Enter task description: ');

    try {
      await this.workflowManager.initTask(taskId);
      this.currentTaskId = taskId;

      // Save task metadata
      const taskDir = path.join('.workflow', taskId);
      const metadata = {
        id: taskId,
        description,
        created: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(taskDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

      console.log(chalk.green(`✅ Task ${taskId} created successfully!`));
      console.log(chalk.gray(`Current phase: FETCH`));
    } catch (error) {
      console.log(
        chalk.red(
          `❌ Error creating task: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async selectTask(): Promise<void> {
    const tasks = this.getAllTasks();

    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found. Create one with "task new"'));
      return;
    }

    console.log(chalk.bold('\nAvailable tasks:'));
    tasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.id} - ${task.description || 'No description'}`);
    });

    const choice = await this.prompt('\nSelect task number: ');
    const index = parseInt(choice, 10) - 1;

    if (index >= 0 && index < tasks.length) {
      this.currentTaskId = tasks[index].id;
      console.log(chalk.green(`✅ Selected task: ${this.currentTaskId}`));
    } else {
      console.log(chalk.red('Invalid selection'));
    }
  }

  private async listTasks(): Promise<void> {
    const tasks = this.getAllTasks();

    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found'));
      return;
    }

    console.log(chalk.bold('\n📋 All Tasks:\n'));

    for (const task of tasks) {
      const state = await this.workflowManager.getState(task.id);
      const status = state ? chalk.cyan(state.currentPhase) : chalk.gray('Unknown');

      console.log(
        `  ${chalk.yellow(task.id.padEnd(15))} ${status.padEnd(20)} ${task.description || ''}`
      );
    }
    console.log('');
  }

  private getAllTasks(): Array<{ id: string; description?: string }> {
    const workflowDir = '.workflow';
    if (!fs.existsSync(workflowDir)) {
      return [];
    }

    return fs
      .readdirSync(workflowDir)
      .filter(dir => fs.statSync(path.join(workflowDir, dir)).isDirectory())
      .map(id => {
        const metadataPath = path.join(workflowDir, id, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          return { id, description: metadata.description };
        }
        return { id };
      });
  }

  private async handleValidateCommand(args: string[]): Promise<void> {
    const [file] = args;

    if (!file) {
      console.log(chalk.gray('Usage: validate <file>'));
      return;
    }

    if (!fs.existsSync(file)) {
      console.log(chalk.red(`File not found: ${file}`));
      return;
    }

    console.log(chalk.gray(`\nValidating ${file}...\n`));

    try {
      const result = await this.mcp.validate(file);

      if (result.valid) {
        console.log(chalk.green('✅ Validation passed!'));
      } else {
        console.log(chalk.red('❌ Validation failed:'));

        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          result.errors.forEach(error => {
            console.log(`  • ${error}`);
          });
        }

        if (result.guardFailures && result.guardFailures.length > 0) {
          console.log(chalk.red('\nFailed guards:'));
          result.guardFailures.forEach(failure => {
            console.log(`  • ${chalk.yellow(failure.guard)}: ${failure.message}`);
          });
        }
      }

      if (result.warnings && result.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        result.warnings.forEach(warning => {
          console.log(`  • ${warning}`);
        });
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async handleWorkflowCommand(args: string[]): Promise<void> {
    const [subCommand] = args;

    if (!this.currentTaskId && subCommand !== 'status') {
      console.log(chalk.yellow('No task selected. Use "task select" first'));
      return;
    }

    switch (subCommand) {
      case 'init':
        await this.initWorkflow();
        break;

      case 'transition':
        await this.transitionWorkflow(args[1]);
        break;

      case 'status':
        await this.showWorkflowStatus();
        break;

      case 'auto':
        await this.checkAutoTransition();
        break;

      case 'visualize':
        await this.visualizeWorkflow();
        break;

      default:
        console.log(chalk.gray('Usage: workflow <init|transition|status|auto|visualize>'));
    }
  }

  private async initWorkflow(): Promise<void> {
    if (!this.currentTaskId) {
      console.log(chalk.yellow('No task selected. Use "task select" first'));
      return;
    }

    try {
      await this.workflowManager.initTask(this.currentTaskId);
      console.log(chalk.green(`✅ Workflow initialized for ${this.currentTaskId}`));
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async transitionWorkflow(phase?: string): Promise<void> {
    let targetPhase = phase;
    if (!targetPhase) {
      const phases: Phase[] = ['FETCH', 'INV', 'ANA', 'PLAN', 'BUILD', 'VERIF', 'REL'];
      console.log(chalk.bold('\nAvailable phases:'));
      phases.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

      const choice = await this.prompt('\nSelect phase number: ');
      const index = parseInt(choice, 10) - 1;

      if (index >= 0 && index < phases.length) {
        targetPhase = phases[index];
      } else {
        console.log(chalk.red('Invalid selection'));
        return;
      }
    }

    if (!this.currentTaskId) {
      console.log(chalk.yellow('No task selected'));
      return;
    }

    try {
      await this.workflowManager.transitionPhase(this.currentTaskId, targetPhase as Phase);
      console.log(chalk.green(`✅ Transitioned to ${targetPhase}`));
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async showWorkflowStatus(): Promise<void> {
    if (!this.currentTaskId) {
      console.log(chalk.yellow('No task selected'));
      return;
    }

    const state = await this.workflowManager.getState(this.currentTaskId);

    if (!state) {
      console.log(chalk.red('No workflow state found'));
      return;
    }

    console.log(chalk.bold(`\n📊 Workflow Status for ${this.currentTaskId}\n`));
    console.log(`Current Phase: ${chalk.cyan(state.currentPhase)}`);
    console.log(`Started: ${new Date(state.startTime).toLocaleString()}`);
    console.log(`Last Updated: ${new Date(state.lastUpdate).toLocaleString()}`);

    if (state.completedPhases.length > 0) {
      console.log(`\nCompleted Phases:`);
      state.completedPhases.forEach(phase => {
        console.log(`  ✅ ${phase}`);
      });
    }

    console.log('');
  }

  private async checkAutoTransition(): Promise<void> {
    if (!this.currentTaskId) {
      console.log(chalk.yellow('No task selected'));
      return;
    }

    console.log(chalk.gray('Checking for auto-transition...'));

    try {
      const result = await this.workflowAutomation.checkAndTransition(this.currentTaskId);

      const data = result.data as
        | { transitioned?: boolean; from?: string; to?: string }
        | undefined;
      if (data?.transitioned && data.from && data.to) {
        console.log(chalk.green(`✅ Auto-transitioned from ${data.from} to ${data.to}`));
      } else {
        console.log(chalk.yellow('ℹ️  No transition available yet'));
        console.log(chalk.gray('  Complete current phase requirements to proceed'));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async visualizeWorkflow(): Promise<void> {
    if (!this.currentTaskId) {
      console.log(chalk.yellow('No task selected'));
      return;
    }

    try {
      const viz = await this.workflowAutomation.generateVisualization(this.currentTaskId);
      console.log(`\n${viz}\n`);
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async handleFetchCommand(args: string[]): Promise<void> {
    const [source] = args;

    if (!source) {
      console.log(chalk.gray('Usage: fetch <url|library>'));
      console.log(chalk.gray('Examples: fetch https://example.com, fetch react'));
      return;
    }

    console.log(chalk.gray(`Fetching ${source}...`));

    try {
      const results = await this.mcp.fetch(source);

      if (results[0]?.success) {
        console.log(chalk.green('✅ Fetch successful!'));
        console.log(chalk.gray(`Content length: ${results[0].content?.length || 0} characters`));

        if (this.currentTaskId) {
          const saveChoice = await this.prompt('Save to current task? (y/n): ');
          if (saveChoice.toLowerCase() === 'y') {
            const filename = await this.prompt('Filename: ');
            const taskDir = path.join('.workflow', this.currentTaskId);
            fs.writeFileSync(path.join(taskDir, filename), results[0].content || '');
            console.log(chalk.green('✅ Saved!'));
          }
        }
      } else {
        console.log(chalk.red(`❌ Fetch failed: ${results[0]?.error}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async listGuards(): Promise<void> {
    const guards = this.validator.getGuardList();

    console.log(chalk.bold('\n🛡️  Available Guards:\n'));

    guards.forEach(guard => {
      console.log(`  ${chalk.yellow(guard.id.padEnd(15))} ${guard.description}`);
    });

    console.log(chalk.gray(`\nTotal: ${guards.length} guards`));
  }

  private async showStatus(): Promise<void> {
    console.log(chalk.bold('\n📊 MCP Integration Status\n'));

    console.log(
      `Current Task: ${this.currentTaskId ? chalk.cyan(this.currentTaskId) : chalk.gray('None')}`
    );

    if (this.currentTaskId) {
      const state = await this.workflowManager.getState(this.currentTaskId);
      if (state) {
        console.log(`Current Phase: ${chalk.cyan(state.currentPhase)}`);
        console.log(`Progress: ${state.completedPhases.length}/7 phases completed`);
      }
    }

    console.log(`\nMCP Servers: ${chalk.green('Connected')}`);
    console.log(`Guards Available: ${chalk.green(this.validator.getGuardList().length)}`);
    console.log('');
  }

  private prompt(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(chalk.gray(question), answer => {
        resolve(answer);
      });
    });
  }
}

// Main entry point
if (require.main === module) {
  const cli = new InteractiveCLI();
  cli.start().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export default InteractiveCLI;
