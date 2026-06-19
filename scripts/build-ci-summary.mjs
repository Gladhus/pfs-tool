#!/usr/bin/env node
// Builds a single Markdown PR comment summarizing lint/typecheck/unit/e2e results.
// Reads Jest-style JSON from Vitest and Playwright's json reporter, both optional
// (a job may have failed before producing one). Used by .github/workflows/pr-checks.yml.
import { readFileSync, existsSync } from 'fs';

const MARKER = '<!-- pfs-tool-ci-summary -->';

const outcomeBadge = (outcome) => {
  if (outcome === 'success') return '✅ Passed';
  if (outcome === 'skipped') return '⏭️ Skipped';
  if (!outcome) return '❔ Unknown';
  return '❌ Failed';
};

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Vitest's json reporter is Jest-compatible: testResults[].assertionResults[]. */
function flattenVitest(report) {
  if (!report) return null;
  const tests = [];
  for (const file of report.testResults ?? []) {
    const fileName = (file.name ?? '').split('/').pop();
    for (const a of file.assertionResults ?? []) {
      tests.push({
        file: fileName,
        name: [...(a.ancestorTitles ?? []), a.title].join(' > '),
        status: a.status,
        message: (a.failureMessages ?? [])[0]?.split('\n')[0],
      });
    }
  }
  return tests;
}

/** Playwright's json reporter nests describe blocks as suites; flatten recursively. */
function flattenPlaywright(report) {
  if (!report) return null;
  const tests = [];
  const walk = (suite, fileName, titlePath) => {
    for (const spec of suite.specs ?? []) {
      const status = spec.tests?.every(t => t.results?.every(r => r.status === 'passed')) ? 'passed' : 'failed';
      const failedResult = spec.tests?.flatMap(t => t.results ?? []).find(r => r.status !== 'passed');
      tests.push({
        file: fileName,
        name: [...titlePath, spec.title].join(' > '),
        status,
        message: failedResult?.error?.message?.split('\n')[0],
      });
    }
    for (const child of suite.suites ?? []) {
      walk(child, fileName, [...titlePath, child.title]);
    }
  };
  for (const fileSuite of report.suites ?? []) {
    walk(fileSuite, fileSuite.file ?? fileSuite.title, []);
  }
  return tests;
}

function testsSection(label, tests) {
  if (!tests) return `| ${label} | ❔ No results produced |\n`;
  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.length - passed;
  const badge = failed === 0 ? `✅ ${passed} passed` : `❌ ${failed} failed, ${passed} passed`;
  return `| ${label} | ${badge} |\n`;
}

function testDetails(label, tests) {
  if (!tests || tests.length === 0) return '';
  const byFile = new Map();
  for (const t of tests) {
    if (!byFile.has(t.file)) byFile.set(t.file, []);
    byFile.get(t.file).push(t);
  }
  const lines = [];
  for (const [file, fileTests] of byFile) {
    lines.push(`**${file}**`);
    for (const t of fileTests) {
      const icon = t.status === 'passed' ? '✅' : '❌';
      lines.push(`- ${icon} ${t.name}`);
    }
    lines.push('');
  }
  return `<details>\n<summary>${label} (${tests.length})</summary>\n\n${lines.join('\n')}\n</details>\n\n`;
}

function failuresSection(label, tests) {
  const failed = (tests ?? []).filter(t => t.status !== 'passed');
  if (failed.length === 0) return '';
  const lines = failed.map(t => `- **${t.file}** — ${t.name}${t.message ? `\n  > ${t.message}` : ''}`);
  return `### ❌ Failed ${label}\n\n${lines.join('\n')}\n\n`;
}

const lintOutcome = process.env.LINT_OUTCOME;
const typecheckOutcome = process.env.TYPECHECK_OUTCOME;
const vitestReport = readJson(process.env.VITEST_JSON_PATH);
const playwrightReport = readJson(process.env.PLAYWRIGHT_JSON_PATH);

const unitTests = flattenVitest(vitestReport);
const e2eTests = flattenPlaywright(playwrightReport);

let body = `${MARKER}\n## CI Summary\n\n`;
body += '| Check | Result |\n| --- | --- |\n';
body += `| Lint | ${outcomeBadge(lintOutcome)} |\n`;
body += `| Type check | ${outcomeBadge(typecheckOutcome)} |\n`;
body += testsSection('Unit tests', unitTests);
body += testsSection('E2E tests', e2eTests);
body += '\n';

body += failuresSection('unit tests', unitTests);
body += failuresSection('e2e tests', e2eTests);

body += testDetails('Unit test details', unitTests);
body += testDetails('E2E test details', e2eTests);

process.stdout.write(body);
