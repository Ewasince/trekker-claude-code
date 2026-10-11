import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { CliRunnerOptions, TrekkerResult } from './types.js';

const execFileAsync = promisify(execFile);

interface TrekkerCommand {
  file: string;
  prefixArgs: string[];
}

const NOT_FOUND_HINT =
  'Set TREKKER_BIN to the path of trekker.js (e.g. ' +
  '<npm prefix>/node_modules/@obsfx/trekker/bin/trekker.js) or a native trekker binary.';

let cachedCommand: TrekkerCommand | undefined;

function fileExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Locate the `trekker` CLI. On Windows a global npm install exposes only
 * `trekker.cmd` / `trekker.ps1` shims: `execFile('trekker')` fails with ENOENT because
 * PATHEXT is not consulted without a shell, and `.cmd` files cannot be spawned
 * without a shell at all (EINVAL on Node >= 18.20 / 20.12 / 22, CVE-2024-27980).
 *
 * Resolution order:
 *   1. `TREKKER_BIN` env var — an explicit path to the CLI (`trekker.js`, a native
 *      binary, or a `.cmd` shim).
 *   2. Non-Windows: plain `trekker`, resolved by the OS as before.
 *   3. Windows: find `trekker.cmd` in PATH and run the `trekker.js` that the npm shim
 *      points at (`<dir>/node_modules/@obsfx/trekker/bin/trekker.js`) directly with
 *      the current node.
 *
 * The CLI is never run through a shell: arguments carry task titles and descriptions
 * (free text from the MCP client), and cmd.exe quoting is not reliable enough to pass
 * them safely. If the CLI cannot be resolved, an error naming TREKKER_BIN is thrown.
 */
function resolveTrekkerCommand(): TrekkerCommand {
  if (cachedCommand) return cachedCommand;

  const explicit = process.env.TREKKER_BIN?.trim();
  if (explicit) {
    cachedCommand = commandForPath(resolve(explicit));
    return cachedCommand;
  }

  if (process.platform !== 'win32') {
    cachedCommand = { file: 'trekker', prefixArgs: [] };
    return cachedCommand;
  }

  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const name of ['trekker.cmd', 'trekker.exe', 'trekker']) {
      const candidate = join(dir, name);
      if (fileExists(candidate)) {
        cachedCommand = commandForPath(candidate);
        return cachedCommand;
      }
    }
  }

  throw new Error(`trekker CLI not found in PATH. ${NOT_FOUND_HINT}`);
}

function commandForPath(path: string): TrekkerCommand {
  const lower = path.toLowerCase();

  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return { file: process.execPath, prefixArgs: [path] };
  }

  if (lower.endsWith('.cmd') || lower.endsWith('.bat') || lower.endsWith('.ps1')) {
    // npm's shim layout: <prefix>/trekker.cmd -> <prefix>/node_modules/@obsfx/trekker/bin/trekker.js
    const script = join(dirname(path), 'node_modules', '@obsfx', 'trekker', 'bin', 'trekker.js');
    if (fileExists(script)) {
      return { file: process.execPath, prefixArgs: [script] };
    }
    throw new Error(
      `Found ${path} but not the trekker.js it should point at (${script}). ${NOT_FOUND_HINT}`
    );
  }

  return { file: path, prefixArgs: [] };
}

export async function runTrekker<T = unknown>(
  args: string[],
  options: CliRunnerOptions = {}
): Promise<TrekkerResult<T>> {
  const { cwd = process.cwd(), toon = true } = options;

  const fullArgs: string[] = [];
  if (toon) fullArgs.push('--toon');
  fullArgs.push(...args);

  try {
    const command = resolveTrekkerCommand();
    const { stdout, stderr } = await execFileAsync(
      command.file,
      [...command.prefixArgs, ...fullArgs],
      {
        cwd,
        timeout: 30000,
      }
    );

    if (stderr) {
      console.error('trekker stderr:', stderr);
    }

    return { success: true, data: stdout as unknown as T };
  } catch (error) {
    const err = error as Error & { stderr?: string; code?: string };
    return {
      success: false,
      error: err.stderr || err.message || 'Unknown error',
    };
  }
}

export async function runTrekkerText(
  args: string[],
  options: CliRunnerOptions = {}
): Promise<TrekkerResult<string>> {
  return runTrekker<string>(args, options);
}
