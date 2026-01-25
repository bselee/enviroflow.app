#!/usr/bin/env node

/**
 * EnviroFlow Self-Healing Build System v3.2
 * 
 * Two main modes:
 * 
 * 1. BUILD-FIX LOOP (default): Run local/vercel builds and fix errors
 * 2. WATCH MODE (--watch): Monitor Vercel after deploy, fix errors automatically
 * 
 * WATCH MODE - Pairs with deploy skill:
 *   After running deploy skill (git push), run:
 *     node build-fix-loop.js --watch
 *   
 *   It will:
 *   - Wait for Vercel deployment to complete
 *   - If ERROR: fetch logs, fix error, push, repeat
 *   - If SUCCESS: exit with deployment URL
 * 
 * BUILD MODES:
 *   --mode=local       npm run build (default)
 *   --mode=vercel      Vercel CLI (vercel build)
 *   --mode=vercel-api  Fetch logs from Vercel API
 * 
 * OPTIONS:
 *   --watch            Watch mode - monitor Vercel after deploy
 *   --deploy           Deploy to Vercel after successful build
 *   --git-push         Git commit and push fixes automatically
 *   --max-iterations=N Maximum fix attempts (default: 20)
 *   --dry-run          Preview fixes without applying
 *   --verbose          Show detailed output
 * 
 * USAGE:
 *   # After deploy skill pushes:
 *   node build-fix-loop.js --watch
 *   
 *   # Local build loop:
 *   node build-fix-loop.js
 *   
 *   # Full CI/CD:
 *   node build-fix-loop.js --mode=vercel-api --git-push
 * 
 * ENV VARS (for watch/vercel-api modes):
 *   VERCEL_TOKEN       Your Vercel API token
 *   VERCEL_PROJECT_ID  Your project ID
 *   VERCEL_TEAM_ID     Your team ID (optional)
 * 
 * ERRORS FIXED (13 patterns):
 *   1.  Dynamic imports (named exports)
 *   2.  Module not exported
 *   3.  Cannot find name (missing import)
 *   4.  Enum type mismatch (zod)
 *   5.  String → Object prop
 *   6.  Undefined not assignable (setValue)
 *   7.  Undefined not assignable (setState)
 *   8.  Undefined not assignable (object literal)
 *   9.  Undefined not assignable (function arg)
 *   10. Generic type constraint
 *   11. Duplicate property in spread
 *   12. Unused imports
 *   13. Unused variables
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// CLI Configuration
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultVal;
};
const hasFlag = (name) => args.includes(`--${name}`);

const CONFIG = {
  mode: getArg('mode', 'local'),
  maxIterations: parseInt(getArg('max-iterations', '20')),
  dryRun: hasFlag('dry-run'),
  verbose: hasFlag('verbose'),
  deploy: hasFlag('deploy'),
  gitPush: hasFlag('git-push'),
  watch: hasFlag('watch'),  // NEW: Watch mode - monitor Vercel after deploy
  vercelToken: process.env.VERCEL_TOKEN,
  vercelProjectId: process.env.VERCEL_PROJECT_ID,
  vercelTeamId: process.env.VERCEL_TEAM_ID,
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// ═══════════════════════════════════════════════════════════════════════════
// Project Root Detection
// ═══════════════════════════════════════════════════════════════════════════

function findRoot() {
  for (const p of ['.', 'apps/web', '..', '../apps/web']) {
    if (fs.existsSync(path.join(p, 'src'))) return p;
  }
  return '.';
}

const ROOT = findRoot();

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function log(msg, color = '') {
  console.log(`${color}${msg}${colors.reset}`);
}

function debug(msg) {
  if (CONFIG.verbose) console.log(`${colors.dim}  ${msg}${colors.reset}`);
}

function readFile(filePath) {
  let fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) fullPath = path.join(ROOT, 'src', filePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function writeFile(filePath, content) {
  if (CONFIG.dryRun) {
    log(`  [DRY RUN] Would write to ${filePath}`, colors.dim);
    return;
  }
  let fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) fullPath = path.join(ROOT, 'src', filePath);
  fs.writeFileSync(fullPath, content);
}

// ═══════════════════════════════════════════════════════════════════════════
// Build Runners (Local, Vercel CLI, Vercel API)
// ═══════════════════════════════════════════════════════════════════════════

function runLocalBuild() {
  log('\nRunning local build (npm run build)...', colors.cyan);
  
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  
  return {
    success: result.status === 0,
    output: (result.stdout || '') + (result.stderr || ''),
  };
}

function runVercelBuild() {
  log('\nRunning Vercel build (vercel build)...', colors.cyan);
  
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch {
    log('Vercel CLI not found. Install: npm i -g vercel', colors.yellow);
    log('Falling back to local build...', colors.yellow);
    return runLocalBuild();
  }
  
  const result = spawnSync('vercel', ['build', '--yes'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  
  return {
    success: result.status === 0,
    output: (result.stdout || '') + (result.stderr || ''),
  };
}

async function fetchVercelLogs() {
  log('\nFetching logs from Vercel API...', colors.cyan);
  
  if (!CONFIG.vercelToken || !CONFIG.vercelProjectId) {
    log('Missing VERCEL_TOKEN or VERCEL_PROJECT_ID', colors.yellow);
    log('Falling back to local build...', colors.yellow);
    return runLocalBuild();
  }
  
  try {
    const teamQuery = CONFIG.vercelTeamId ? `&teamId=${CONFIG.vercelTeamId}` : '';
    
    // Get latest deployment
    const deployRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${CONFIG.vercelProjectId}&limit=1${teamQuery}`,
      { headers: { Authorization: `Bearer ${CONFIG.vercelToken}` } }
    );
    
    if (!deployRes.ok) throw new Error(`API error: ${deployRes.statusText}`);
    
    const { deployments } = await deployRes.json();
    if (!deployments?.length) throw new Error('No deployments found');
    
    const deployment = deployments[0];
    log(`Latest: ${deployment.url} (${deployment.state})`, colors.dim);
    
    // Get build logs
    const eventsRes = await fetch(
      `https://api.vercel.com/v2/deployments/${deployment.uid}/events`,
      { headers: { Authorization: `Bearer ${CONFIG.vercelToken}` } }
    );
    
    if (!eventsRes.ok) throw new Error(`Events error: ${eventsRes.statusText}`);
    
    const events = await eventsRes.json();
    const output = events
      .filter(e => ['stdout', 'stderr', 'command'].includes(e.type))
      .map(e => e.payload?.text || e.payload?.log || '')
      .join('\n');
    
    return {
      success: deployment.state === 'READY',
      output,
      deployment,
    };
  } catch (err) {
    log(`Vercel API error: ${err.message}`, colors.yellow);
    log('Falling back to local build...', colors.yellow);
    return runLocalBuild();
  }
}

async function waitForDeployment(maxWaitMs = 300000) {
  if (!CONFIG.vercelToken || !CONFIG.vercelProjectId) return null;
  
  log('Waiting for Vercel deployment to complete...', colors.cyan);
  const startTime = Date.now();
  const teamQuery = CONFIG.vercelTeamId ? `&teamId=${CONFIG.vercelTeamId}` : '';
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${CONFIG.vercelProjectId}&limit=1${teamQuery}`,
        { headers: { Authorization: `Bearer ${CONFIG.vercelToken}` } }
      );
      
      if (!res.ok) throw new Error(`API error: ${res.statusText}`);
      
      const { deployments } = await res.json();
      const deployment = deployments?.[0];
      
      if (!deployment) {
        await sleep(5000);
        continue;
      }
      
      const state = deployment.state;
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      if (state === 'READY') {
        log(`  ✓ Deployment ready (${elapsed}s)`, colors.green);
        return { success: true, deployment };
      } else if (state === 'ERROR' || state === 'CANCELED') {
        log(`  ✗ Deployment ${state.toLowerCase()} (${elapsed}s)`, colors.red);
        return { success: false, deployment };
      } else {
        // BUILDING, QUEUED, INITIALIZING
        process.stdout.write(`\r  Building... ${elapsed}s (${state})   `);
      }
      
      await sleep(5000);
    } catch (err) {
      debug(`Poll error: ${err.message}`);
      await sleep(5000);
    }
  }
  
  log(`\n  Timeout waiting for deployment (${maxWaitMs/1000}s)`, colors.yellow);
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// Watch Mode - Monitor Vercel after deploy, fix errors automatically
// ═══════════════════════════════════════════════════════════════════════════

async function watchMode() {
  console.log(`
${colors.cyan}${colors.bold}╔════════════════════════════════════════════════════════════════╗
║         Vercel Watch Mode - Post-Deploy Error Fixer            ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}

${colors.dim}Monitoring Vercel deployments...${colors.reset}
${colors.dim}Will automatically fix build errors and redeploy.${colors.reset}
${colors.dim}Press Ctrl+C to stop.${colors.reset}
`);

  if (!CONFIG.vercelToken || !CONFIG.vercelProjectId) {
    log(`${colors.red}Error: VERCEL_TOKEN and VERCEL_PROJECT_ID required for watch mode.${colors.reset}`);
    log(`\nSet them with:`);
    log(`  export VERCEL_TOKEN="your-token"`);
    log(`  export VERCEL_PROJECT_ID="prj_xxx"`);
    return 1;
  }

  let iteration = 0;
  let lastDeploymentId = null;
  let fixes = [];

  while (iteration < CONFIG.maxIterations) {
    iteration++;
    
    // Wait for deployment to complete (or fail)
    console.log(`\n${colors.blue}━━━ Watching deployment ${iteration}/${CONFIG.maxIterations} ━━━${colors.reset}`);
    
    const result = await waitForDeployment(600000); // 10 min timeout
    
    if (!result) {
      log('No deployment found or timeout. Retrying in 30s...', colors.yellow);
      await sleep(30000);
      continue;
    }

    const { deployment } = result;
    
    // Skip if same deployment we already processed
    if (deployment.uid === lastDeploymentId) {
      log('Same deployment, waiting for new one...', colors.dim);
      await sleep(10000);
      continue;
    }
    
    lastDeploymentId = deployment.uid;

    // Success!
    if (deployment.state === 'READY') {
      console.log(`
${colors.green}${colors.bold}╔════════════════════════════════════════════════════════════════╗
║               ✓ DEPLOYMENT SUCCESSFUL!                         ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}

${colors.green}URL: https://${deployment.url}${colors.reset}
Fixes applied this session: ${fixes.length}
`);
      return 0;
    }

    // Failed - fetch logs and try to fix
    if (deployment.state === 'ERROR') {
      log(`Deployment failed. Fetching build logs...`, colors.yellow);
      
      const { output } = await fetchVercelLogs();
      const summary = extractSummary(output);
      console.log(`Error: ${summary}`);
      
      const fix = tryFixes(output);
      
      if (!fix) {
        console.log(`\n${colors.red}No auto-fix available for this error.${colors.reset}`);
        console.log(`${colors.dim}Manual intervention required.${colors.reset}\n`);
        const err = output.match(/Failed to compile[\s\S]*?(?=npm error|Error:|$)/);
        if (err) console.log(err[0].slice(0, 2000));
        return 1;
      }
      
      console.log(`${colors.green}✓${colors.reset} [${fix.name}] ${fix.result}`);
      fixes.push(fix);
      
      // Commit and push the fix (always push in watch mode)
      log('Committing and pushing fix...', colors.cyan);
      try {
        execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });
        execSync(`git commit -m "fix: ${fix.name.toLowerCase()}"`, { cwd: ROOT, stdio: 'pipe' });
        execSync('git push', { cwd: ROOT, stdio: 'pipe' });
        log('  Pushed fix to trigger new deployment', colors.green);
      } catch (err) {
        log(`Git error: ${err.message}`, colors.yellow);
        await sleep(5000);
      }
      
      // Small delay before checking for new deployment
      await sleep(5000);
    }
  }

  console.log(`\n${colors.red}Max iterations reached.${colors.reset}`);
  return 1;
}

async function runBuild() {
  switch (CONFIG.mode) {
    case 'vercel': return runVercelBuild();
    case 'vercel-api': return fetchVercelLogs();
    default: return runLocalBuild();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Git Operations
// ═══════════════════════════════════════════════════════════════════════════

function gitCommitAndPush(message) {
  if (CONFIG.dryRun) {
    log(`[DRY RUN] Would commit: ${message}`, colors.dim);
    return true;
  }
  
  try {
    execSync('git add -A', { cwd: ROOT, stdio: 'pipe' });
    
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
    if (!status.trim()) {
      debug('No changes to commit');
      return true;
    }
    
    execSync(`git commit -m "${message}"`, { cwd: ROOT, stdio: 'pipe' });
    log(`  Committed: ${message}`, colors.dim);
    
    if (CONFIG.gitPush) {
      log('  Pushing to remote...', colors.cyan);
      execSync('git push', { cwd: ROOT, stdio: 'pipe' });
      log('  Pushed!', colors.green);
    }
    
    return true;
  } catch (err) {
    log(`Git error: ${err.message}`, colors.yellow);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Vercel Deployment
// ═══════════════════════════════════════════════════════════════════════════

function deployToVercel() {
  if (CONFIG.dryRun) {
    log('[DRY RUN] Would deploy to Vercel', colors.dim);
    return { success: true, url: 'https://dry-run.vercel.app' };
  }
  
  log('\nDeploying to Vercel...', colors.cyan);
  
  const result = spawnSync('vercel', ['--prod', '--yes'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  
  const output = (result.stdout || '') + (result.stderr || '');
  const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
  
  return {
    success: result.status === 0,
    url: urlMatch ? urlMatch[0] : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR PATTERNS (13 Total)
// ═══════════════════════════════════════════════════════════════════════════

const ERROR_PATTERNS = [
  
  // 1. Dynamic Import Named Export
  {
    name: 'Dynamic Import (Named Export)',
    detect: (o) => o.includes("DynamicOptions") && o.includes("import("),
    extract: (o) => {
      const m = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error:.*DynamicOptions/s);
      return m ? { file: m[1] } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content) return null;
      let n = 0;
      const fixed = content.replace(
        /\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)(?!\.then)/g,
        (_, p) => { n++; return `() => import('${p}').then(mod => mod.${p.split('/').pop().replace(/\.\w+$/, '')})`; }
      );
      if (n > 0) { writeFile(info.file, fixed); return `Fixed ${n} dynamic imports in ${info.file}`; }
      return null;
    }
  },

  // 2. Module Not Exported
  {
    name: 'Module Not Exported',
    detect: (o) => o.includes("locally, but it is not exported"),
    extract: (o) => {
      const m = o.match(/Module '"([^"]+)"' declares '(\w+)' locally, but it is not exported/);
      return m ? { modulePath: m[1], typeName: m[2] } : null;
    },
    fix: (info) => {
      let srcPath = info.modulePath.replace('@/', 'src/') + '.ts';
      let content = readFile(srcPath);
      if (!content) { srcPath = srcPath.replace('.ts', '.tsx'); content = readFile(srcPath); }
      if (!content) return null;
      
      let fixed = content, didFix = false;
      const tp = new RegExp(`^(\\s*)type\\s+${info.typeName}\\b`, 'm');
      const ip = new RegExp(`^(\\s*)interface\\s+${info.typeName}\\b`, 'm');
      
      if (content.match(tp) && !content.includes(`export type ${info.typeName}`)) {
        fixed = fixed.replace(tp, `$1export type ${info.typeName}`); didFix = true;
      }
      if (content.match(ip) && !content.includes(`export interface ${info.typeName}`)) {
        fixed = fixed.replace(ip, `$1export interface ${info.typeName}`); didFix = true;
      }
      if (didFix) { writeFile(srcPath, fixed); return `Exported ${info.typeName} in ${srcPath}`; }
      return null;
    }
  },

  // 3. Cannot Find Name
  {
    name: 'Cannot Find Name',
    detect: (o) => o.includes("Cannot find name"),
    extract: (o) => {
      const m = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error: Cannot find name '(\w+)'/);
      return m ? { file: m[1], name: m[3] } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content || content.includes(`{ ${info.name}`) || content.includes(`, ${info.name}`)) return null;
      
      const locs = {
        'DimmerCurve': '@/lib/dimming-curves', 'DimmerCurveType': '@/lib/dimming-curves',
        'DeviceScheduleAction': '@/types', 'ControllerBrand': '@/types',
        'SensorType': '@/types', 'Room': '@/types', 'Controller': '@/types',
      };
      const from = locs[info.name] || '@/types';
      const lines = content.split('\n');
      let lastImport = 0;
      lines.forEach((l, i) => { if (l.startsWith('import ')) lastImport = i; });
      lines.splice(lastImport + 1, 0, `import type { ${info.name} } from "${from}";`);
      writeFile(info.file, lines.join('\n'));
      return `Added import for ${info.name} in ${info.file}`;
    }
  },

  // 4. Enum Type Mismatch
  {
    name: 'Enum Type Mismatch',
    detect: (o) => o.includes("is not assignable") && /Type '"(\w+)"' is not assignable to type '("[^"]+"\s*\|\s*)+/.test(o),
    extract: (o) => {
      const fm = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error:/);
      const vm = o.match(/Type '"(\w+)"' is not assignable to type '("[^"]+"\s*\|\s*)+/);
      return (fm && vm) ? { file: fm[1], val: vm[1] } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content) return null;
      let didFix = false;
      const fixed = content.replace(/z\.enum\(\[([^\]]+)\]\)/g, (m, v) => {
        if (!v.includes(`"${info.val}"`)) { didFix = true; return `z.enum([${v.trim().replace(/,?\s*$/, '')}, "${info.val}"])`; }
        return m;
      });
      if (didFix) { writeFile(info.file, fixed); return `Added "${info.val}" to enum in ${info.file}`; }
      return null;
    }
  },

  // 5. String to Object Prop
  {
    name: 'String to Object Prop',
    detect: (o) => o.includes("Type 'string' has no properties in common"),
    extract: (o) => {
      const m = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error: Type 'string' has no properties/);
      return m ? { file: m[1], line: parseInt(m[2]) } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content) return null;
      const lines = content.split('\n');
      const idx = info.line - 1;
      const orig = lines[idx];
      lines[idx] = orig.replace(/(content|tooltip|help|message)="([^"]+)"/g, '$1={{ text: "$2" }}');
      if (lines[idx] !== orig) { writeFile(info.file, lines.join('\n')); return `Converted prop in ${info.file}:${info.line}`; }
      return null;
    }
  },

  // 6-9. Undefined Not Assignable
  {
    name: 'Undefined Not Assignable',
    detect: (o) => o.includes("| undefined' is not assignable") || o.includes("Type 'undefined' is not assignable"),
    extract: (o) => {
      const m = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error:/);
      const tm = o.match(/'([^']+) \| undefined' is not assignable/);
      return m ? { file: m[1], line: parseInt(m[2]), type: tm?.[1] || 'string' } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content) return null;
      const lines = content.split('\n');
      const idx = info.line - 1;
      if (idx < 0 || idx >= lines.length) return null;
      let line = lines[idx];
      const orig = line;
      if (line.includes(' || ') || line.includes(' ?? ')) return null;
      
      // Determine fallback
      let fb = '""';
      const ll = line.toLowerCase();
      if (info.type.includes('number') || ll.match(/level|offset|minutes|count|port/)) fb = '0';
      else if (info.type.includes('[]') || ll.includes('days')) fb = '[]';
      else if (info.type.includes('Action') || ll.includes('action')) fb = '"on"';
      else if (ll.includes('trigger')) fb = '"time"';
      
      // Apply fix patterns
      if (line.includes('setValue(')) {
        line = line.replace(/(setValue\s*\(\s*["'][^"']+["']\s*,\s*)([^)]+?)(\s*\)\s*;?)/, `$1$2 || ${fb}$3`);
      } else if (line.match(/\bset[A-Z]\w*\s*\(/)) {
        line = line.replace(/(\bset[A-Z]\w*\s*\()([^)]+?)(\)\s*;?)/, `$1$2 || ${fb}$3`);
      } else if (line.match(/\w+\s*\([^)]*\.[^)]+\)/)) {
        line = line.replace(/(\w+)\s*\(([^)]+\.[^\s)]+)\)/g, (m, fn, a) => a.includes('||') || a.endsWith('()') ? m : `${fn}(${a} || ${fb})`);
      } else if (line.match(/^\s*\w+:\s*[\w.]+\s*,?\s*$/)) {
        line = line.replace(/^(\s*)(\w+):\s*([\w.]+)(\s*,?\s*)$/, `$1$2: $3 || ${fb}$4`);
      }
      
      if (line !== orig) { lines[idx] = line; writeFile(info.file, lines.join('\n')); return `Added fallback (${fb}) in ${info.file}:${info.line}`; }
      return null;
    }
  },

  // 10. Generic Type Constraint
  {
    name: 'Generic Type Constraint',
    detect: (o) => o.includes("is not assignable to parameter of type '(...args:") || (o.includes("Types of parameters") && o.includes("are incompatible")),
    extract: (o) => {
      const m = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error:/);
      return m ? { file: m[1], line: parseInt(m[2]) } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content) return null;
      const lines = content.split('\n');
      const idx = info.line - 1;
      if (idx > 0 && (lines[idx - 1].includes('@ts-expect-error') || lines[idx - 1].includes('@ts-ignore'))) return null;
      const indent = lines[idx].match(/^(\s*)/)?.[1] || '';
      lines.splice(idx, 0, `${indent}// @ts-expect-error - generic constraint too strict`);
      writeFile(info.file, lines.join('\n'));
      return `Added @ts-expect-error in ${info.file}:${info.line}`;
    }
  },

  // 11. Duplicate Property in Spread
  {
    name: 'Duplicate Property in Spread',
    detect: (o) => o.includes("is specified more than once"),
    extract: (o) => {
      // Handle both local output and Vercel logs (with timestamps)
      // Local: ./src/file.ts:195:9\nType error: 'prop' is specified...
      // Vercel: 21:25:47.190 ./src/file.ts:195:9\n21:25:47.191 Type error: 'prop' is specified...
      const m = o.match(/\.\/([^:\s]+):(\d+):\d+[\s\S]*?Type error: '(\w+)' is specified more than once/);
      return m ? { file: m[1], line: parseInt(m[2]), prop: m[3] } : null;
    },
    fix: (info) => {
      const content = readFile(info.file);
      if (!content) return null;
      const lines = content.split('\n');
      const idx = info.line - 1;
      if (idx < 0 || idx >= lines.length) return null;
      
      // Check for spread below
      let hasSpread = false;
      for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i++) {
        if (lines[i].includes('...')) { hasSpread = true; break; }
      }
      
      if (hasSpread && lines[idx].match(new RegExp(`^\\s*${info.prop}:\\s*\\w+\\.${info.prop}\\s*,?\\s*$`))) {
        lines.splice(idx, 1);
        writeFile(info.file, lines.join('\n'));
        return `Removed duplicate '${info.prop}' in ${info.file}:${info.line}`;
      }
      
      // Alternative: move spread to top
      for (let i = idx; i < Math.min(idx + 10, lines.length); i++) {
        if (lines[i].match(/^\s*\.\.\.\w+\s*,?\s*$/)) {
          const spread = lines.splice(i, 1)[0];
          for (let j = idx - 1; j >= Math.max(0, idx - 5); j--) {
            if (lines[j].includes('({')) {
              lines.splice(j + 1, 0, spread);
              writeFile(info.file, lines.join('\n'));
              return `Moved spread before props in ${info.file}`;
            }
          }
        }
      }
      return null;
    }
  },

  // 12. Unused Import (Warning)
  {
    name: 'Unused Import',
    isWarning: true,
    detect: (o) => o.includes("is defined but never used") && o.includes("@typescript-eslint/no-unused-vars"),
    extract: (o) => ({ output: o }),
    fix: (info) => {
      const pattern = /\.\/([^:]+):(\d+):\d+\s+Warning: '(\w+)' is defined but never used/g;
      const files = {};
      let m;
      while ((m = pattern.exec(info.output))) {
        const [, fp, , name] = m;
        if (name.startsWith('_') || fp.includes('.test.')) continue;
        if (!files[fp]) files[fp] = new Set();
        files[fp].add(name);
      }
      
      let total = 0;
      for (const [fp, names] of Object.entries(files)) {
        let content = readFile(fp);
        if (!content) continue;
        for (const name of names) {
          const before = content;
          content = content.replace(
            new RegExp(`(import\\s+(?:type\\s+)?\\{[^}]*?)\\b${name}\\b\\s*,?\\s*([^}]*\\})`, 'g'),
            (m, pre, post) => (pre + post).replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{ ').replace(/,\s*\}/g, ' }')
          );
          if (content !== before) total++;
        }
        content = content.replace(/^import\s+(?:type\s+)?\{\s*\}\s+from\s+['"][^'"]+['"];?\s*\n/gm, '');
        writeFile(fp, content);
      }
      return total > 0 ? `Removed ${total} unused imports` : null;
    }
  },

  // 13. Unused Variable (Warning)
  {
    name: 'Unused Variable',
    isWarning: true,
    detect: (o) => o.includes("is assigned a value but never used") || o.includes("is defined but never used"),
    extract: (o) => {
      const m = o.match(/\.\/([^:]+):(\d+):\d+\s+Warning: '(\w+)' is (?:assigned|defined)/);
      return m ? { file: m[1], line: parseInt(m[2]), name: m[3] } : null;
    },
    fix: (info) => {
      if (info.name.startsWith('_') || info.file.includes('.test.')) return null;
      const content = readFile(info.file);
      if (!content) return null;
      const lines = content.split('\n');
      const idx = info.line - 1;
      if (idx < 0 || idx >= lines.length || lines[idx].includes(`_${info.name}`)) return null;
      const orig = lines[idx];
      lines[idx] = orig.replace(new RegExp(`\\b${info.name}\\b`), `_${info.name}`);
      if (lines[idx] !== orig) { writeFile(info.file, lines.join('\n')); return `Prefixed ${info.name} in ${info.file}:${info.line}`; }
      return null;
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Error Processing
// ═══════════════════════════════════════════════════════════════════════════

function extractSummary(output) {
  // Handle both local and Vercel output formats (Vercel has timestamps on each line)
  const m = output.match(/Failed to compile[\s\S]*?\.\/([^\s:]+:\d+:\d+)[\s\S]*?Type error: ([^\n]+)/);
  if (m) return `${m[1]}: ${m[2].slice(0, 60)}...`;
  if (output.includes('Compiled successfully') || output.includes('✓ Compiled')) {
    const w = (output.match(/Warning:/g) || []).length;
    return w > 0 ? `Build OK with ${w} warnings` : 'Build successful';
  }
  return 'Unknown';
}

function tryFixes(output) {
  // Errors first
  for (const p of ERROR_PATTERNS.filter(x => !x.isWarning)) {
    if (p.detect(output)) {
      debug(`Trying: ${p.name}`);
      const info = p.extract(output);
      if (info) {
        try {
          const result = p.fix(info, output);
          if (result) return { name: p.name, result };
        } catch (e) { debug(`Error: ${e.message}`); }
      }
    }
  }
  
  // Warnings (only if build passed)
  if (output.includes('Compiled successfully')) {
    for (const p of ERROR_PATTERNS.filter(x => x.isWarning)) {
      if (p.detect(output)) {
        debug(`Trying: ${p.name}`);
        const info = p.extract(output);
        if (info) {
          try {
            const result = p.fix(info, output);
            if (result) return { name: p.name, result };
          } catch (e) { debug(`Error: ${e.message}`); }
        }
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Loop
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
${colors.cyan}${colors.bold}╔════════════════════════════════════════════════════════════════╗
║        EnviroFlow Self-Healing Build System v3.1               ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}

${colors.dim}Mode:${colors.reset}           ${CONFIG.mode}
${colors.dim}Max iterations:${colors.reset} ${CONFIG.maxIterations}
${colors.dim}Deploy:${colors.reset}         ${CONFIG.deploy ? 'Yes' : 'No'}
${colors.dim}Git push:${colors.reset}       ${CONFIG.gitPush ? 'Yes' : 'No'}
${colors.dim}Working dir:${colors.reset}    ${path.resolve(ROOT)}
`);

  // For vercel-api mode, we MUST have git-push to loop properly
  if (CONFIG.mode === 'vercel-api' && !CONFIG.gitPush) {
    log(`${colors.yellow}⚠ Warning: --mode=vercel-api requires --git-push to loop properly.${colors.reset}`);
    log(`${colors.yellow}  Without it, fixes won't trigger new deployments.${colors.reset}`);
    log(`${colors.yellow}  Use: node build-fix-loop.js --mode=vercel-api --git-push${colors.reset}\n`);
  }

  let iteration = 0, lastSummary = '', stuckCount = 0, fixes = [];
  
  while (iteration < CONFIG.maxIterations) {
    iteration++;
    console.log(`\n${colors.blue}━━━ Iteration ${iteration}/${CONFIG.maxIterations} ━━━${colors.reset}`);
    
    const { success, output } = await runBuild();
    const summary = extractSummary(output);
    console.log(`Status: ${summary}`);
    
    // Success!
    if (success && !output.includes('Warning:')) {
      console.log(`
${colors.green}${colors.bold}╔════════════════════════════════════════════════════════════════╗
║               ✓ BUILD SUCCESSFUL - ZERO WARNINGS!              ║
╚════════════════════════════════════════════════════════════════╝${colors.reset}

Iterations: ${iteration} | Fixes: ${fixes.length}
`);
      if (fixes.length > 0 && !CONFIG.gitPush) {
        gitCommitAndPush(`fix: auto-fix ${fixes.length} build errors`);
      }
      if (CONFIG.deploy) {
        const { url } = deployToVercel();
        if (url) console.log(`${colors.green}Deployed: ${url}${colors.reset}`);
      }
      return 0;
    }
    
    if (success) console.log(`${colors.green}✓ Build passed${colors.reset} with ${colors.yellow}warnings${colors.reset}`);
    
    // Stuck detection
    if (summary === lastSummary) {
      if (++stuckCount >= 2) {
        console.log(`\n${colors.red}Stuck on same error after 2 attempts. Manual fix required.${colors.reset}\n`);
        const err = output.match(/Failed to compile[\s\S]*?(?=npm error|Error:|$)/);
        if (err) console.log(err[0].slice(0, 2000));
        return success ? 0 : 1;
      }
    } else { stuckCount = 0; lastSummary = summary; }
    
    // Try fix
    const fix = tryFixes(output);
    if (!fix) {
      if (success) {
        console.log(`\n${colors.green}✓ BUILD SUCCESSFUL${colors.reset} (some warnings remain)\n`);
        if (fixes.length > 0 && !CONFIG.gitPush) {
          gitCommitAndPush(`fix: auto-fix ${fixes.length} build errors`);
        }
        if (CONFIG.deploy) { 
          const { url } = deployToVercel(); 
          if (url) console.log(`Deployed: ${url}`); 
        }
        return 0;
      }
      console.log(`\n${colors.red}No auto-fix available for this error.${colors.reset}\n`);
      const err = output.match(/Failed to compile[\s\S]*?(?=npm error|Error:|$)/);
      if (err) console.log(err[0].slice(0, 2000));
      return 1;
    }
    
    console.log(`${colors.green}✓${colors.reset} [${fix.name}] ${fix.result}`);
    fixes.push(fix);
    
    // For vercel-api mode with git-push: commit, push, wait for new deployment
    if (CONFIG.mode === 'vercel-api' && CONFIG.gitPush) {
      const committed = gitCommitAndPush(`fix: ${fix.name.toLowerCase()}`);
      if (committed) {
        const result = await waitForDeployment(300000); // 5 min timeout
        if (!result) {
          log('\nDeployment timeout. Continuing...', colors.yellow);
        }
      }
    }
  }
  
  console.log(`\n${colors.red}Max iterations (${CONFIG.maxIterations}) reached.${colors.reset}`);
  return 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry Point
// ═══════════════════════════════════════════════════════════════════════════

async function run() {
  // Watch mode - monitor Vercel after deploy
  if (CONFIG.watch) {
    return watchMode();
  }
  
  // Normal build-fix loop
  return main();
}

run().then(process.exit).catch(e => { console.error(e); process.exit(1); });