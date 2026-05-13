#!/usr/bin/env node
/**
 * init-brain.mjs — initialise the global ~/.brain/ tree.
 *
 * Implements BLUEPRINT--BRAIN-MERGE-STRATEGY §"Init script" (P4).
 *
 * Steps:
 *  1. Compute targetRoot = globalRoot() (inlined copy of packages/msp/src/brain/global-vault.ts logic;
 *     this script is plain Node ESM, so we don't import the TS module).
 *  2. Parse args: --dry-run, --force, --legacy-msp-path=<path>.
 *  3. If targetRoot exists AND no --force → exit 0 with "already initialised" message.
 *  4. mkdir -p targetRoot + subdirs (skills/, episodic/, proto/, params/).
 *  5. Write identity.json (empty {} if missing) and registry.yaml (header + empty doc).
 *  6. If ~/.msp/ exists (or --legacy-msp-path provided), copy its contents into targetRoot.
 *     - Linux/macOS: rename (atomic).
 *     - Windows: copy-then-remove (rename across volumes can EXDEV).
 *     - The source is preserved until the copy is verified (per ADR §"Migration").
 *  7. Emit summary (created / copied / skipped counts).
 *
 * Intentionally does NOT write an audit / SKILL atom — that is deferred to P5
 * wiring per BLUEPRINT §"Init script" note.
 *
 * Usage:
 *   node scripts/msp/init-brain.mjs --dry-run
 *   node scripts/msp/init-brain.mjs
 *   node scripts/msp/init-brain.mjs --force
 *   node scripts/msp/init-brain.mjs --legacy-msp-path=/some/.msp
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { dryRun: false, force: false, legacyMspPath: null };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force') out.force = true;
    else if (arg.startsWith('--legacy-msp-path=')) {
      out.legacyMspPath = arg.slice('--legacy-msp-path='.length);
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg.startsWith('--')) {
      process.stderr.write(`init-brain: unknown flag '${arg}'\n`);
      out.unknown = arg;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Global root computation (inlined from packages/msp/src/brain/global-vault.ts)
// ---------------------------------------------------------------------------

function globalRoot() {
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE;
    if (!userProfile) {
      throw new Error('globalRoot: USERPROFILE is not set on win32');
    }
    return path.join(userProfile, '.brain');
  }
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) {
    return path.join(xdg, 'brain');
  }
  return path.join(os.homedir(), '.brain');
}

function legacyMspRoot() {
  // Mirror the historical ~/.msp/ idiom (per ADR--GLOBAL-VS-WORKSPACE, superseded).
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE;
    if (!userProfile) return null;
    return path.join(userProfile, '.msp');
  }
  return path.join(os.homedir(), '.msp');
}

// ---------------------------------------------------------------------------
// FS helpers
// ---------------------------------------------------------------------------

async function pathExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p) {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

const REGISTRY_YAML_HEADER =
  '# ~/.brain/registry.yaml — known project paths + last-touched timestamps.\n' +
  '# Created by scripts/msp/init-brain.mjs.\n' +
  '# Format: { projects: [{ path: <abs>, touched_at: <ISO> }] }\n' +
  'projects: []\n';

const IDENTITY_JSON_DEFAULT = '{}\n';

const SUBDIRS = ['skills', 'episodic', 'proto', 'params'];

// ---------------------------------------------------------------------------
// Migration: copy a directory tree (recursive, preserves source until done)
// ---------------------------------------------------------------------------

async function copyTree(src, dest, stats, log, dryRun) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const sPath = path.join(src, e.name);
    const dPath = path.join(dest, e.name);
    if (e.isDirectory()) {
      if (!dryRun) await fs.mkdir(dPath, { recursive: true });
      await copyTree(sPath, dPath, stats, log, dryRun);
    } else if (e.isFile()) {
      // If destination already has a file with same name, skip — don't clobber.
      if (await pathExists(dPath)) {
        log(`skip (exists in target): ${path.relative(src, sPath) || e.name}`);
        stats.skipped++;
      } else {
        if (!dryRun) {
          await fs.mkdir(path.dirname(dPath), { recursive: true });
          await fs.copyFile(sPath, dPath);
        }
        log(`copy: ${sPath} -> ${dPath}`);
        stats.copied++;
      }
    } else if (e.isSymbolicLink()) {
      // Preserve symlinks as-is (rare in ~/.msp/ but worth handling).
      if (!dryRun) {
        const target = await fs.readlink(sPath);
        try {
          await fs.symlink(target, dPath);
        } catch (err) {
          log(`warn: failed to recreate symlink ${dPath}: ${err.message}`);
        }
      }
      log(`symlink: ${sPath} -> ${dPath}`);
      stats.copied++;
    }
  }
}

async function migrateLegacy(legacySrc, targetRoot, stats, log, dryRun) {
  if (!(await isDir(legacySrc))) {
    log(`no legacy ~/.msp/ found at ${legacySrc} — skipping migration`);
    return;
  }
  log(`legacy ~/.msp/ found at ${legacySrc} — migrating into ${targetRoot}`);

  // Always copy-then-remove. Per ADR §"Migration", we preserve the source
  // until the copy is verified. On Linux/macOS rename would be atomic, but
  // copy is safer and roughly free for typical small ~/.msp/ trees.
  try {
    await copyTree(legacySrc, targetRoot, stats, log, dryRun);
  } catch (err) {
    process.stderr.write(
      `init-brain: migration copy failed (${err.message}). ` +
        `Legacy source preserved at ${legacySrc}. ` +
        `Re-run with --force after resolving.\n`,
    );
    throw err;
  }

  // Only remove source after copy completed without throwing.
  if (!dryRun) {
    try {
      await fs.rm(legacySrc, { recursive: true, force: true });
      log(`removed legacy source: ${legacySrc}`);
    } catch (err) {
      // Non-fatal: keep the source on Windows if files are locked.
      process.stderr.write(
        `init-brain: warning — failed to remove legacy source ${legacySrc}: ${err.message}\n`,
      );
    }
  } else {
    log(`would remove legacy source: ${legacySrc}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(
      'Usage: node scripts/msp/init-brain.mjs [--dry-run] [--force] [--legacy-msp-path=<path>]\n',
    );
    return;
  }

  const stats = { created: 0, copied: 0, skipped: 0 };
  const log = (...m) =>
    process.stdout.write(`${args.dryRun ? '[dry-run]' : '[init-brain]'} ${m.join(' ')}\n`);

  const targetRoot = globalRoot();
  log(`target root: ${targetRoot}`);

  const targetExists = await pathExists(targetRoot);
  if (targetExists && !args.force) {
    process.stdout.write(
      `init-brain: ${targetRoot} already initialised. Re-run with --force to migrate anew.\n`,
    );
    process.exitCode = 0;
    return;
  }

  // 1. Create targetRoot + subdirs.
  if (!targetExists) {
    if (!args.dryRun) await fs.mkdir(targetRoot, { recursive: true });
    log(`create: ${targetRoot}`);
    stats.created++;
  }
  for (const sub of SUBDIRS) {
    const subPath = path.join(targetRoot, sub);
    if (!(await pathExists(subPath))) {
      if (!args.dryRun) await fs.mkdir(subPath, { recursive: true });
      log(`create: ${subPath}`);
      stats.created++;
    } else {
      log(`skip (exists): ${subPath}`);
      stats.skipped++;
    }
  }

  // 2. Touch identity.json + registry.yaml if missing.
  const identityPath = path.join(targetRoot, 'identity.json');
  if (!(await pathExists(identityPath))) {
    if (!args.dryRun) await fs.writeFile(identityPath, IDENTITY_JSON_DEFAULT, 'utf8');
    log(`create: ${identityPath}`);
    stats.created++;
  } else {
    log(`skip (exists): ${identityPath}`);
    stats.skipped++;
  }

  const registryPath = path.join(targetRoot, 'registry.yaml');
  if (!(await pathExists(registryPath))) {
    if (!args.dryRun) await fs.writeFile(registryPath, REGISTRY_YAML_HEADER, 'utf8');
    log(`create: ${registryPath}`);
    stats.created++;
  } else {
    log(`skip (exists): ${registryPath}`);
    stats.skipped++;
  }

  // 3. Migrate ~/.msp/ if present.
  const legacySrc = args.legacyMspPath ?? legacyMspRoot();
  if (legacySrc) {
    await migrateLegacy(legacySrc, targetRoot, stats, log, args.dryRun);
  }

  // 4. Summary.
  process.stdout.write('\nSummary:\n');
  process.stdout.write(`  created: ${stats.created}\n`);
  process.stdout.write(`  copied:  ${stats.copied}\n`);
  process.stdout.write(`  skipped: ${stats.skipped}\n`);
  if (args.dryRun) {
    process.stdout.write('\n(dry-run: no filesystem changes were made)\n');
  }

  process.exitCode = 0;
}

main().catch((err) => {
  process.stderr.write(`init-brain: fatal: ${err.stack ?? err.message ?? err}\n`);
  process.exitCode = 1;
});
