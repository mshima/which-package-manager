/* eslint-disable @typescript-eslint/naming-convention */
import { join } from 'node:path';
import process from 'node:process';
import { beforeAll, describe, it, expect } from 'vitest';
import helpers from 'yeoman-test';
import { whichPackageManager } from '../src/index.js';

describe('whichPackageManager', () => {
  describe('with no package.json', async () => {
    beforeAll(async () => {
      await helpers.prepareTemporaryDir();
    });
    it('with no preferred pm should return undefined', async () => {
      await expect(whichPackageManager()).resolves.toBeUndefined();
    });
    it('with npm preferred pm should return npm', async () => {
      await expect(whichPackageManager({ preferred: ['npm', 'yarn'] })).resolves.toBe('npm');
    });
    it('with npm preferred pm should return npm', async () => {
      await expect(whichPackageManager({ preferred: ['npm', 'yarn'], checkExecutable: true })).resolves.toBe('npm');
    });
    it('with pnpm preferred pm should return pnpm', async () => {
      await expect(whichPackageManager({ preferred: ['pnpm', 'yarn'] })).resolves.toBe('pnpm');
    });
    it('with yarn preferred pm should return yarn', async () => {
      await expect(whichPackageManager({ preferred: ['yarn', 'npm'] })).resolves.toBe('yarn');
    });
  });
  describe('with no lock file', () => {
    it('single package with a package.json', async () => {
      await helpers
        .prepareTemporaryDir()
        .withFiles({
          'package.json': {
            private: true,
          },
        })
        .commitFiles();
      await expect(whichPackageManager()).resolves.toBeUndefined();
    });
    describe('workspaces package.json file with ambiguous compatibility', () => {
      beforeAll(async () => {
        const files = {
          'package.json': {
            private: true,
            workspaces: ['package', 'workspaces/*'],
          },
          'package/package.json': {},
          'workspaces/workspace-a/package.json': {},
        };
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
      });
      it('at root', async () => {
        await expect(whichPackageManager()).resolves.toBeUndefined();
      });
      it('at package', async () => {
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBeUndefined();
      });
      it('at workspaces/workspace-a', async () => {
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBeUndefined();
      });
      it('at not-workspace', async () => {
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
      });
    });
    describe('workspaces package.json with yarn support', async () => {
      const files = {
        'package.json': {
          private: true,
          workspaces: {
            packages: ['package', 'workspaces/*'],
          },
        },
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
      };
      it('at root', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager()).resolves.toBe('yarn');
      });
      it('at package', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBe('yarn');
      });
      it('at workspaces/workspace-a', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBe('yarn');
      });
      it('at not-workspace', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
      });
    });
    describe('workspaces package.json with npm support', async () => {
      const files = {
        'package.json': {
          private: false,
          workspaces: ['package', 'workspaces/*'],
        },
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
      };
      it('at root', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager()).resolves.toBe('npm');
      });
      it('at package', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBe('npm');
      });
      it('at workspaces/workspace-a', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBe('npm');
      });
      it('at not-workspace', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
      });
    });
    describe('workspaces with pnpm-workspace.yaml', async () => {
      const files = {
        'package.json': {
          private: true,
          workspaces: ['package', 'workspaces/*'],
        },
        'pnpm-workspace.yaml': '',
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
      };
      it('at root', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager()).resolves.toBe('pnpm');
      });
      it('at package', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBe('pnpm');
      });
      it('at workspaces/workspace-a', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBe('pnpm');
      });
      it('at not-workspace', async () => {
        await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
        await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBe('pnpm');
      });
    });
  });
  describe('workspaces package.json with multiples lock files', async () => {
    beforeAll(async () => {
      const files = {
        'package.json': {
          private: true,
          workspaces: ['package', 'workspaces/*'],
        },
        'yarn.lock': '',
        'package-lock.json': {},
        'pnpm-lock.yaml': '',
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
        'workspaces/yarn/package.json': {},
        'workspaces/yarn/yarn.lock': '',
        'workspaces/npm/package.json': {},
        'workspaces/npm/package-lock.json': '',
        'workspaces/pnpm/package.json': {},
        'workspaces/pnpm/pnpm-lock.yaml': '',
      };
      await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
    });
    it('at root', async () => {
      await expect(whichPackageManager()).rejects.toMatch(/Lock files for multiples package managers found: npm, pnpm, yarn/);
    });
    it('at package', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).rejects.toMatch(
        /Lock files for multiples package managers found: npm, pnpm, yarn/,
      );
    });
    it('at workspaces/workspace-a', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).rejects.toMatch(
        /Lock files for multiples package managers found: npm, pnpm, yarn/,
      );
    });
    it('at not-workspace', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
    });
    it('at workspaces/npm', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/npm') })).resolves.toBe('npm');
    });
    it('at workspaces/yarn', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/yarn') })).resolves.toBe('yarn');
    });
    it('at workspaces/pnpm', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/pnpm') })).resolves.toBe('pnpm');
    });
  });
  describe('workspaces npm lock file', async () => {
    beforeAll(async () => {
      const files = {
        'package.json': {
          private: true,
          workspaces: ['package', 'workspaces/*'],
        },
        'package-lock.json': {},
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
      };
      await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
    });
    it('at root', async () => {
      await expect(whichPackageManager()).resolves.toBe('npm');
    });
    it('at package', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBe('npm');
    });
    it('at workspaces/workspace-a', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBe('npm');
    });
    it('at not-workspace', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
    });
  });
  describe('workspaces yarn lock file', async () => {
    beforeAll(async () => {
      const files = {
        'package.json': {
          private: true,
          workspaces: ['package', 'workspaces/*'],
        },
        'yarn.lock': {},
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
      };
      await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
    });
    it('at root', async () => {
      await expect(whichPackageManager()).resolves.toBe('yarn');
    });
    it('at package', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBe('yarn');
    });
    it('at workspaces/workspace-a', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBe('yarn');
    });
    it('at not-workspace', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
    });
  });
  describe('workspaces pnpm lock file', async () => {
    beforeAll(async () => {
      const files = {
        'package.json': {
          private: true,
          workspaces: ['package', 'workspaces/*'],
        },
        'pnpm-lock.yaml': {},
        'package/package.json': {},
        'workspaces/workspace-a/package.json': {},
      };
      await helpers.prepareTemporaryDir().withFiles(files).commitFiles();
    });
    it('at root', async () => {
      await expect(whichPackageManager()).resolves.toBe('pnpm');
    });
    it('at package', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'package') })).resolves.toBe('pnpm');
    });
    it('at workspaces/workspace-a', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'workspaces/workspace-a') })).resolves.toBe('pnpm');
    });
    it('at not-workspace', async () => {
      await expect(whichPackageManager({ cwd: join(process.cwd(), 'not-workspace') })).resolves.toBeUndefined();
    });
  });
});
