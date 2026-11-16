/**
 * Per-asset license ledger for the dev seed (UI-008). Rendered by the plan
 * mode after it resolves every asset, so a human can sign off each source URL
 * and identifier before the first dev run. The output is a human-run artifact
 * and is never produced by the e2e gate.
 */

function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

export function buildPerAssetLedger(assets, generatedAt = new Date().toISOString()) {
  const lines = [
    '# Dev Seed Per Asset License Ledger',
    '',
    `Generated: ${generatedAt}`,
    '',
    'Sign-off status: PENDING HUMAN SIGN-OFF.',
    '',
    'Review every row before the first dev seed run. The e2e gate never generates this file.',
    '',
  ];
  for (const [className, entries] of Object.entries(assets)) {
    lines.push(`## ${className}`, '');
    lines.push('| Identifier | Title | Source Url | License | Attribution | Bytes | Sha 256 |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const asset of entries) {
      lines.push(
        `| ${cell(asset.identifier)} | ${cell(asset.title)} | ${cell(asset.sourceUrl)} `
          + `| ${cell(asset.license)} | ${cell(asset.attribution)} | ${asset.bytes} `
          + `| ${cell(asset.sha256)} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
