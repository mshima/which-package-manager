import { exec } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import micromatch from 'micromatch';
import { findUp } from 'find-up';
import type { PackageJson } from 'type-fest';

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

type PackageManagerField = { packageManager: string; version?: string };

export type PackageStructure = {
  lockFile?: string;
  compatiblePackageManager?: readonly PackageManager[];
  packageManagerField?: PackageManagerField;
  workspaceRoot?: string;
};

type DetectWorkspace =
  | { isRoot: true; compatiblePackageManager: PackageManager[]; workspaces: string[] }
  | { isRoot: false; compatiblePackageManager?: undefined; workspaces?: undefined };

type WorkspaceCompatibility = { compatible: true; workspaces: string[] } | { compatible: false };

const packageManagers: PackageManager[] = ['npm', 'pnpm', 'yarn'];

const lockFilesForPackageManager: Record<PackageManager, string> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
};

const getPackageManagerField = (packageJson: PackageJson): PackageManagerField | undefined => {
  const [packageManager, version] = packageJson.packageManager?.split('@') ?? [];
  if (packageManager) {
    return { packageManager: packageManager as PackageManager, version };
  }

  return undefined;
};

const isFile = async (file: string): Promise<boolean> => {
  try {
    const fileStat = await stat(file);
    return fileStat.isFile();
  } catch {
    return false;
  }
};

export const hasLockFile = async (pm: PackageManager, cwd: string): Promise<boolean> => isFile(join(cwd, lockFilesForPackageManager[pm]));

/**
 * Yarn's package.json private field must be true and workspaces field can be a structure.
 */
const checkYarnWorkspaceRoot = (packageJson: PackageJson): WorkspaceCompatibility => {
  if (packageJson.private === true) {
    const workspaces: string[] = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : packageJson.workspaces!.packages!;
    return { compatible: true, workspaces };
  }

  return { compatible: false };
};

/**
 * Npm's package.json workspaces field must be an array.
 */
const checkNpmWorkspaceRoot = (packageJson: PackageJson): WorkspaceCompatibility => {
  const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : undefined;
  return workspaces === undefined ? { compatible: false } : { compatible: true, workspaces };
};

const getPackageJson = async (file: string): Promise<PackageJson> => {
  const packageJsonRawContent = await readFile(file);
  return JSON.parse(packageJsonRawContent.toString()) as PackageJson;
};

const findLockFile = async (cwd: string): Promise<PackageManager | undefined> => {
  const unfilteredLockFiles = await Promise.all(packageManagers.map(async pm => ((await hasLockFile(pm, cwd)) ? pm : undefined)));
  const detectedLockFiles = unfilteredLockFiles.filter(pm => pm !== undefined);
  if (detectedLockFiles.length > 1) {
    throw new Error(`Lock files for multiples package managers found: ${detectedLockFiles.join(', ')}`);
  }

  return detectedLockFiles[0];
};

const checkWorkspaceRoot = async (cwd: string, packageJson: PackageJson): Promise<DetectWorkspace> => {
  if (await isFile(join(cwd, 'pnpm-workspace.yaml'))) {
    return { isRoot: true, compatiblePackageManager: ['pnpm'], workspaces: ['**'] };
  }

  // Workspaces field is supported by yarn and npm
  if (packageJson.workspaces) {
    const detectWorkspace: DetectWorkspace = { isRoot: true, compatiblePackageManager: [], workspaces: [] };
    const npmWorkspace = checkNpmWorkspaceRoot(packageJson);
    if (npmWorkspace.compatible) {
      detectWorkspace.workspaces = npmWorkspace.workspaces;
      detectWorkspace.compatiblePackageManager.push('npm');
    }

    const yarnWorkspace = checkYarnWorkspaceRoot(packageJson);
    if (yarnWorkspace.compatible) {
      detectWorkspace.workspaces = yarnWorkspace.workspaces;
      detectWorkspace.compatiblePackageManager.push('yarn');
    }

    return detectWorkspace;
  }

  return { isRoot: false };
};

const getWorkspaceRoot = async (
  cwd: string,
): Promise<
  | undefined
  | {
      compatiblePackageManager: PackageManager[];
      lockFile: string | undefined;
      workspaceRoot: string;
      packageManagerField?: PackageManagerField;
    }
> => {
  const packageJsonRoot = await findUp('package.json', { cwd: join(cwd, '..') });
  if (!packageJsonRoot) {
    return undefined;
  }

  const workspaceRoot = dirname(packageJsonRoot);
  const packageJson = await getPackageJson(packageJsonRoot);
  const packageManagerField = getPackageManagerField(packageJson);
  const detectWorkspace = await checkWorkspaceRoot(workspaceRoot, packageJson);
  const relativeToPackageJson = relative(workspaceRoot, cwd);
  if (detectWorkspace.isRoot && micromatch.isMatch(relativeToPackageJson, detectWorkspace.workspaces)) {
    const lockFile = await findLockFile(workspaceRoot);
    return {
      compatiblePackageManager: lockFile ? [lockFile] : detectWorkspace.compatiblePackageManager,
      lockFile,
      workspaceRoot,
      packageManagerField,
    };
  }

  return undefined;
};

export const detectPackageStructure = async ({ cwd = process.cwd() }: { cwd?: string }): Promise<PackageStructure> => {
  const packageJsonFile = join(cwd, 'package.json');
  const hasPackageJson = await isFile(join(packageJsonFile));
  let packageManagerField: PackageManagerField | undefined;
  if (hasPackageJson) {
    const packageJson = await getPackageJson(packageJsonFile);
    packageManagerField = getPackageManagerField(packageJson);
    const lockFile = await findLockFile(cwd);
    if (lockFile) {
      return {
        lockFile,
        compatiblePackageManager: [lockFile],
        packageManagerField,
      };
    }

    const detectWorkspace: DetectWorkspace = await checkWorkspaceRoot(cwd, packageJson);
    if (detectWorkspace.isRoot) {
      const { compatiblePackageManager } = detectWorkspace;
      return { compatiblePackageManager, packageManagerField };
    }
  }

  const findWorkspaceRoot = await getWorkspaceRoot(cwd);
  if (findWorkspaceRoot) {
    const { workspaceRoot, compatiblePackageManager, packageManagerField: workspacePackageManagerField } = findWorkspaceRoot;
    return {
      workspaceRoot,
      compatiblePackageManager,
      packageManagerField: workspacePackageManagerField,
    };
  }

  return {
    compatiblePackageManager: packageManagers,
    packageManagerField,
  };
};

export const whichPackageManager = async ({
  cwd,
  preferred = [],
  checkExecutable,
  ignorePackageManagerField,
}: { cwd?: string; preferred?: PackageManager[]; checkExecutable?: boolean; ignorePackageManagerField?: boolean } = {}): Promise<
  string | undefined
> => {
  const structure = await detectPackageStructure({ cwd });
  if (structure.compatiblePackageManager?.length === 1) {
    return structure.compatiblePackageManager[0];
  }

  const packageManagerFromField = structure.packageManagerField?.packageManager;
  // Package Manager from package.json field should be compatible.
  if (
    packageManagerFromField &&
    !ignorePackageManagerField &&
    structure.compatiblePackageManager?.includes(packageManagerFromField as PackageManager)
  ) {
    return packageManagerFromField;
  }

  for (const pm of preferred) {
    if (structure.compatiblePackageManager?.includes(pm)) {
      if (!checkExecutable) {
        return pm;
      }

      try {
        const promise = promisify(exec)(`${pm} -v`);
        // eslint-disable-next-line no-await-in-loop
        await promise;
        if (promise.child.exitCode === 0) {
          return pm;
        }
        /* c8 ignore next */
      } catch {}
    }
  }

  return undefined;
};
