export const LEO_UNAVAILABLE_REASON =
  "Leo CLI is not available. Please run through WSL or install Leo in the current environment.";
export const EXPECTED_LEO_VERSION = "4.4.0";

export type LeoCommandMode = "native" | "wsl" | "unavailable";

export type LeoCliDetection =
  | {
      available: true;
      mode: "native" | "wsl";
      version: string;
      executable?: string;
    }
  | {
      available: false;
      mode: "unavailable";
      reason: string;
    };

export type LeoCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type LeoCommandRunner = (
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    input?: string;
  },
) => Promise<LeoCommandResult>;

export type LeoRunResult = LeoCommandResult & {
  ok: boolean;
  detection: LeoCliDetection;
};

type LeoCommandOptions = {
  projectPath?: string;
  input?: string;
  detection?: LeoCliDetection;
  runner?: LeoCommandRunner;
};

export function windowsPathToWslPath(inputPath: string) {
  const normalized = inputPath.replace(/\\/g, "/");
  const match = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!match) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function configuredLeoBinary() {
  return process.env.LEO_BIN?.trim() ?? "";
}

function isExpectedLeoVersion(version: string) {
  return version.toLowerCase().includes(`leo ${EXPECTED_LEO_VERSION}`);
}

async function defaultRunner(
  command: string,
  args: string[],
  options: { cwd?: string; input?: string } = {},
): Promise<LeoCommandResult> {
  const { spawn } = await import("node:child_process");

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      resolve({
        exitCode: null,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: error.message,
      });
    });
    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    child.stdin.end(options.input ?? "");
  });
}

async function tryRun(
  runner: LeoCommandRunner,
  command: string,
  args: string[],
): Promise<LeoCommandResult> {
  try {
    return await runner(command, args);
  } catch (error) {
    return {
      exitCode: null,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Leo command failed",
    };
  }
}

function wslDetection(output: string, fallbackExecutable: string): LeoCliDetection {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasExecutable = lines.length > 1 && (lines[0].includes("/") || lines[0] === "leo");
  return {
    available: true,
    mode: "wsl",
    executable: hasExecutable ? lines[0] : fallbackExecutable,
    version: (hasExecutable ? lines.slice(1) : lines).join("\n").trim(),
  };
}

function preferredWslProbe() {
  const binary = `$HOME/.local/leo-toolchains/${EXPECTED_LEO_VERSION}/bin/leo`;
  return `if [ -x "${binary}" ]; then printf '%s\\n' "${binary}"; "${binary}" --version; else exit 1; fi`;
}

export async function detectLeoCli(
  runner: LeoCommandRunner = defaultRunner,
): Promise<LeoCliDetection> {
  const configured = configuredLeoBinary();
  if (configured) {
    const native = await tryRun(runner, configured, ["--version"]);
    if (native.exitCode === 0) {
      return { available: true, mode: "native", executable: configured, version: native.stdout.trim() };
    }

    const wsl = await tryRun(runner, "wsl", ["bash", "-lc", `${shellQuote(configured)} --version`]);
    if (wsl.exitCode === 0) return wslDetection(wsl.stdout, configured);
    return { available: false, mode: "unavailable", reason: LEO_UNAVAILABLE_REASON };
  }

  const native = await tryRun(runner, "leo", ["--version"]);
  if (native.exitCode === 0 && isExpectedLeoVersion(native.stdout.trim())) {
    return { available: true, mode: "native", executable: "leo", version: native.stdout.trim() };
  }

  const preferredWsl = await tryRun(runner, "wsl", ["bash", "-lc", preferredWslProbe()]);
  if (preferredWsl.exitCode === 0) return wslDetection(preferredWsl.stdout, "leo");

  const wsl = await tryRun(runner, "wsl", ["bash", "-lc", "which leo && leo --version"]);
  if (wsl.exitCode === 0) return wslDetection(wsl.stdout, "leo");

  if (native.exitCode === 0) {
    return { available: true, mode: "native", executable: "leo", version: native.stdout.trim() };
  }
  return { available: false, mode: "unavailable", reason: LEO_UNAVAILABLE_REASON };
}

export function getLeoCommand(detection: LeoCliDetection): { mode: LeoCommandMode; executable: string; args: string[] } {
  if (!detection.available) return { mode: "unavailable", executable: "", args: [] };
  if (detection.mode === "wsl") return { mode: "wsl", executable: "wsl", args: ["bash", "-lc"] };
  return { mode: "native", executable: detection.executable ?? "leo", args: [] };
}

async function defaultLeoProjectPath(projectPath: string | undefined) {
  if (projectPath) return projectPath;
  const path = await import("node:path");
  return path.join(process.cwd(), "leo", "bug_proof");
}

function nativeLeoArgs(command: string, executable: string) {
  if (!command.startsWith("leo ")) return { executable: command, args: [] };
  return { executable, args: command.slice("leo ".length).split(" ").filter(Boolean) };
}

function commandSucceeded(result: LeoCommandResult) {
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  return result.exitCode === 0 && !/(^|\n)\s*Error\s+\[[A-Z0-9]+]/.test(combinedOutput);
}

export function sanitizeLeoCliOutput(output: string) {
  return output
    .split(/\r?\n/)
    .filter((line) => !/No valid private key specified/i.test(line))
    .join("\n")
    .replace(/A(?:PrivateKey1)[0-9A-Za-z]+/g, "[REDACTED]");
}

function sanitizeLeoCommandResult(result: LeoCommandResult): LeoCommandResult {
  return {
    ...result,
    stdout: sanitizeLeoCliOutput(result.stdout),
    stderr: sanitizeLeoCliOutput(result.stderr),
  };
}

function commandWithLeoBinary(command: string, executable: string) {
  if (command.startsWith("leo ")) {
    return `${shellQuote(executable)} ${command.slice("leo ".length)}`;
  }
  if (command.startsWith("bash ")) {
    return `LEO_BIN=${shellQuote(executable)} ${command}`;
  }
  return command;
}

export async function runLeoCommand(
  command: string,
  options: LeoCommandOptions = {},
): Promise<LeoRunResult> {
  const runner = options.runner ?? defaultRunner;
  const detection = options.detection ?? await detectLeoCli(runner);
  if (!detection.available) {
    return { ok: false, exitCode: null, stdout: "", stderr: detection.reason, detection };
  }

  const projectPath = await defaultLeoProjectPath(options.projectPath);
  if (detection.mode === "wsl") {
    const result = await runner("wsl", [
      "bash",
      "-lc",
      `cd ${shellQuote(windowsPathToWslPath(projectPath))} && ${commandWithLeoBinary(command, detection.executable ?? "leo")}`,
    ], { input: options.input });
    const sanitized = sanitizeLeoCommandResult(result);
    return { ...sanitized, ok: commandSucceeded(result), detection };
  }

  const native = nativeLeoArgs(command, detection.executable ?? "leo");
  const result = await runner(native.executable, native.args, { cwd: projectPath, input: options.input });
  const sanitized = sanitizeLeoCommandResult(result);
  return { ...sanitized, ok: commandSucceeded(result), detection };
}

export async function runLeoBuild(options: Omit<LeoCommandOptions, "input"> = {}) {
  return runLeoCommand("leo build", options);
}