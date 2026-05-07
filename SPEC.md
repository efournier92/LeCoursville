---
name: Security Package Upgrade Process
description: Upgrade npm packages one at a time with security vulnerability focus, smoke testing after each
type: project
---

# Security Package Upgrade ADS

## Context

This is a legacy Angular 15 frontend project (`/Users/e/mnt/bnk/cs/lecoursville`) with multiple high-severity security vulnerabilities. The goal is to upgrade packages **one at a time** to isolate breaking changes and enable close monitoring.

## Current State Snapshot

**Angular Version**: 15.0.4
**Package Manager**: npm
**node_modules**: present (not committed)

### Critical Security Vulnerabilities (High Severity)

**NOTE**: These vulnerabilities require Angular 16+ to fix. Staying on Angular 15 means accepting these risks until blocking packages are replaced.

| Package | Current | Vulnerable To | Severity |
|---------|---------|---------------|----------|
| @angular/core | ~15.0.4 | XSS via SVG script attributes (GHSA-jrmj-c5cx-3cw6) | HIGH |
| @angular/core | ~15.0.4 | i18n XSS (GHSA-prjf-86w9-mfqv) | HIGH |
| @angular/compiler | ~15.0.4 | XSS via SVG/MathML (GHSA-v4hv-rgfq-gp49) | HIGH |
| @angular/compiler | ~15.0.4 | XSS via unsanitized SVG (GHSA-jrmj-c5cx-3cw6) | HIGH |
| @angular/common | ~15.0.4 | XSRF token leakage (GHSA-58c5-g7wp-6w37) | HIGH |
| @angular/fire | ^7.5.0 | Multiple transitive deps | HIGH |
| @angular/cdk | ^15.0.3 | Multiple transitive deps | HIGH |
| @angular/cli | ^15.0.4 | Multiple transitive deps | HIGH |

### Packages Upgradable Within Angular 15

| Package | Current | Latest (Angular 15 Compatible) | Type |
|---------|---------|--------------------------------|------|
| rxjs | 7.8.0 | 7.8.2 | PATCH (DONE) |
| date-fns | 2.30.0 | 4.1.0 | MAJOR (DONE) |
| jspdf | 2.5.2 | 4.2.1 | MAJOR (DONE) |
| tslib | 2.4.1 | 2.8.1 | PATCH (DONE) |
| file-saver | 2.0.5 | latest | Check |
| html2canvas | 1.4.1 | latest | Check |
| bootstrap | 5.2.3 | latest | Check |
| font-awesome | 4.7.0 | latest | Check |
| jquery | 3.7.1 | 3.7.1 | Major update available |
| firebase | 9.23.0 | Check firebase 9.x range | Check |
| firebaseui | 6.0.2 | Check compatibility | Check |

**Note**: Angular upgrade paths are blocked by ngx-* packages. We will not upgrade Angular core.

## Upgrade Strategy

### Decision: Stay on Angular 15

After analyzing package compatibility, upgrading to Angular 16+ would break 3 critical packages:
- **ngx-extended-pdf-viewer**: Only supports Angular up to 15.x
- **ngx-audio-player**: Only supports Angular up to 12.x
- **angular-calendar**: Jumped from Angular 15 support to Angular 20 in 0.32.x

Therefore, we will upgrade all packages that are compatible with Angular 15.

### Approach: One-at-a-time with isolation

1. **Start with non-Angular dependencies** first (leaf nodes, fewer breaking changes)
2. **Save state before each upgrade** (`package.json`, `package-lock.json`)
3. **Smoke test after each upgrade** (app loads, basic navigation works)
4. **Revert if issues arise** before proceeding

### Proposed Order (Safest First)

1. **Non-breaking leaf deps** (DONE): `rxjs`, `date-fns`, `jspdf`, `tslib`
2. **Remaining leaf deps**: `file-saver`, `html2canvas`, `bootstrap`, `font-awesome`, `jquery`
3. **Angular-compatible libs within v15**: `@fortawesome/*`, `angular-calendar@0.31.x`, `ngx-infinite-scroll@15.x`, `ngx-filter-pipe`
4. **ngx packages with Angular 15 support**: `ngx-filesaver`, `aws-amplify-angular`
5. **Dev dependencies**: `rxjs` (dev only updates), `@types/*`

### Blockers (Cannot Upgrade)

These packages do not have versions compatible with Angular 16+:
- ngx-extended-pdf-viewer (max v15)
- ngx-audio-player (max v12)
- @videogular/ngx-videogular (check compatibility)
- firebaseui-angular (check compatibility)

### Smoke Test Criteria

After each upgrade, verify:
- `npm start` launches without console errors
- Home page renders
- Login flow works (if applicable)
- At least one navigation transition works

## Process Steps

### Step 1: Identify Current Angular Version
```bash
ng version 2>/dev/null || npm list @angular/core
```

### Step 2: Run Audit and Save Baseline
```bash
npm audit --json > audit-$(date +%Y%m%d).json
```

### Step 3: For Each Package Upgrade

1. **Identify target version** from `npm outdated <package>` or npm registry
2. **Backup state**: commit or stash current `package.json` and `package-lock.json`
3. **Update single package**: `npm install <package>@<target-version> --save`
4. **Install**: `npm install`
5. **Build**: `ng build 2>&1 | head -50` (capture first errors)
6. **Smoke test**: `npm start` (if dev server starts successfully)
7. **Decision**: Proceed, revert, or investigate

### Step 4: Log Results

Maintain a simple log:
```
| Date | Package | From | To | Status | Notes |
|------|---------|------|----|--------|-------|
| 2026-05-07 | date-fns | 2.29.3 | 3.x.x | PASS/FAIL | ... |
```

## Smoke Test Implementation

### Manual Smoke Test (Primary)
1. Run `npm start`
2. Open browser to localhost:4200 (or configured port)
3. Verify home page loads
4. Navigate to at least one other route
5. Check browser console for errors

### Automated Smoke Test (Optional Enhancement)
A simple script that:
- Starts `ng serve` in background
- Uses curl or playwright to check HTTP 200
- Captures console errors
- Shuts down server

## Key Risks

1. **Security vulnerabilities remain**: Angular 15.x has known XSS vulnerabilities that are only fixed in 19.2.16+
2. **Blocking packages**: Cannot upgrade Angular without breaking ngx-extended-pdf-viewer, ngx-audio-player, or angular-calendar
3. **Peer dependency conflicts**: Angular 15 + Material 13 creates conflicts with newer packages
4. **Zone.js version**: Angular 15 uses zone.js ~0.12.0, check compatibility before upgrading

## Completed Upgrades

| Date | Package | From | To | Status | Notes |
|------|---------|------|----|--------|-------|
| 2026-05-07 | rxjs | 7.8.0 | 7.8.2 | PASS | Patch update |
| 2026-05-07 | date-fns | 2.30.0 | 4.1.0 | PASS | Build succeeds |
| 2026-05-07 | jspdf | 2.5.2 | 4.2.1 | PASS | Build succeeds |
| 2026-05-07 | tslib | 2.4.1 | 2.8.1 | PASS | Build succeeds |
| 2026-05-07 | bootstrap | 5.2.3 | 5.3.8 | PASS | Minor update |
| 2026-05-07 | lightgallery | 2.7.0 | 2.9.0 | PASS | Minor update |
| 2026-05-07 | firebaseui | 6.0.2 | 6.1.0 | PASS | Minor update |
| 2026-05-07 | aws-amplify-angular | 6.0.26 | 6.0.60 | PASS | Minor update |

## Cannot Upgrade

| Package | Reason |
|---------|--------|
| file-saver | Already at latest (2.0.5) |
| html2canvas | Already at latest (1.4.1) |
| @fortawesome/angular-fontawesome | Next version requires Angular 21 |
| @fortawesome/fontawesome-svg-core | Already at latest 6.x (7.x available but 4.0.0 requires Angular 21) |
| jquery | 4.x is a major breaking change |
| firebase | Major version jump (9.x -> 12.x) would break API |
| zone.js | Major version jump may break Angular 15 |
| typescript | 4.9.x breaks Angular 15 (requires <4.9.0) |

## When to Stop and Ask

- Any package that requires updating 3+ other packages simultaneously to resolve peer deps
- Any package where `npm install` produces unresolved conflicts
- Angular core upgrades (these will trigger cascading changes)
- Firebase upgrades (API changed significantly)

## User Prompts During Process

At each significant decision point, I will:
1. Show you the current package and proposed version
2. Note any peer dependency conflicts
3. Ask if you want to proceed, skip, or defer

## Out of Scope

- Backend Ruby/Rails upgrades
- Adding new features
- Refactoring existing code
- Performance optimization

## Success Criteria

- App remains functional throughout
- All upgrades stay within Angular 15 compatibility
- Each upgrade is isolated and reversible
- User has visibility and control at each step
- Note: Angular core XSS vulnerabilities cannot be fixed without Angular 16+