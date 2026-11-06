#!/usr/bin/env node
/**
 * Translation helpers for the React app (run via `make i18n*`, inside the node container).
 *
 *   extract --domain <d> --out <file.pot>
 *       Collect __(), _x(), _n(), _nx() calls (+ translator comments) from src/**\/*.ts(x)
 *       using the TypeScript parser. WP-CLI's make-pot can't read TypeScript, so its
 *       output is merged into the plugin POT with `wp i18n make-pot --merge`.
 *
 *   json --domain <d> --handle <h> --dir <languages>
 *       For every <d>-<locale>.po, write <d>-<locale>-<h>.json (Jed format) holding
 *       only the strings used by the app. WordPress' load_script_textdomain() looks
 *       for this handle-based file name first, so hashed build file names don't matter.
 *
 *   add --domain <d> --locale <ll_CC> --dir <languages>
 *       Start a new translation from the POT.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gettextParser from 'gettext-parser';
import ts from 'typescript';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');

/* --------------------------------------------------------------------------------- */

function args() {
  const [command, ...rest] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, '')] = rest[i + 1];
  return { command, options };
}

function required(options, ...keys) {
  for (const key of keys) {
    if (!options[key]) {
      console.error(`Missing --${key}`);
      process.exit(1);
    }
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/* ---- extract ---------------------------------------------------------------------- */

/** Argument positions per function: [msgid, plural, context, domain]. */
const FUNCTIONS = {
  __: { msgid: 0, domain: 1 },
  _x: { msgid: 0, context: 1, domain: 2 },
  _n: { msgid: 0, plural: 1, domain: 3 },
  _nx: { msgid: 0, plural: 1, context: 3, domain: 4 },
};

function stringArg(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

function translatorComment(node, text) {
  // Look at the call and a few enclosing nodes, like WP-CLI does for PHP/JS.
  for (let current = node, depth = 0; current && depth < 4; current = current.parent, depth++) {
    const ranges = ts.getLeadingCommentRanges(text, current.getFullStart()) ?? [];
    for (const range of ranges.reverse()) {
      const raw = text.slice(range.pos, range.end);
      const body = raw
        .replace(/^\/\*+|\*+\/$|^\/\//g, '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*?\s?/, '').trim())
        .join(' ')
        .trim();
      if (/^translators:/i.test(body)) return body;
    }
    if (ts.isExpressionStatement(current) || ts.isVariableStatement(current)) break;
  }
  return undefined;
}

function extract({ domain, out }) {
  const entries = new Map();
  let count = 0;

  for (const file of walk(path.join(appRoot, 'src'))) {
    const text = fs.readFileSync(file, 'utf8');
    const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const reference = path.relative(repoRoot, file).split(path.sep).join('/');

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ts.isIdentifier(node.expression)
            ? node.expression.text
            : undefined;
        const spec = callee && FUNCTIONS[callee];

        if (spec) {
          const a = node.arguments;
          const msgid = stringArg(a[spec.msgid]);
          if (msgid && stringArg(a[spec.domain]) === domain) {
            const context = spec.context !== undefined ? stringArg(a[spec.context]) : undefined;
            const plural = spec.plural !== undefined ? stringArg(a[spec.plural]) : undefined;
            const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const key = `${context ?? ''}\u0004${msgid}`;
            const entry = entries.get(key) ?? { msgid, context, plural, refs: [], comments: [] };
            entry.refs.push(`${reference}:${line}`);
            const comment = translatorComment(node, text);
            if (comment && !entry.comments.includes(comment)) entry.comments.push(comment);
            entries.set(key, entry);
            count++;
          } else if (msgid && stringArg(a[spec.domain]) === undefined) {
            console.warn(`⚠ ${reference}: ${callee}('${msgid}') has no text domain — skipped`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  const quote = (s) =>
    `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;

  let pot =
    'msgid ""\nmsgstr ""\n' +
    '"Content-Type: text/plain; charset=UTF-8\\n"\n' +
    `"X-Domain: ${domain}\\n"\n`;

  for (const e of entries.values()) {
    pot += '\n';
    for (const c of e.comments) pot += `#. ${c}\n`;
    pot += `#: ${e.refs.join(' ')}\n`;
    if (e.context) pot += `msgctxt ${quote(e.context)}\n`;
    pot += `msgid ${quote(e.msgid)}\n`;
    if (e.plural) pot += `msgid_plural ${quote(e.plural)}\nmsgstr[0] ""\nmsgstr[1] ""\n`;
    else pot += 'msgstr ""\n';
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pot);
  console.log(
    `✓ ${entries.size} strings (${count} calls) from admin-client → ${path.relative(process.cwd(), out)}`,
  );
}

/* ---- json ------------------------------------------------------------------------- */

const isAppReference = (ref) => /\.(tsx?|jsx?)(:\d+)?$/.test(ref);

function json({ domain, handle, dir }) {
  const poFiles = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${domain}-`) && f.endsWith('.po'));

  if (poFiles.length === 0) console.log('No .po files found.');

  for (const file of poFiles) {
    const locale = file.slice(domain.length + 1, -3);
    const po = gettextParser.po.parse(fs.readFileSync(path.join(dir, file)));
    const messages = {
      '': {
        domain: 'messages',
        lang: po.headers.Language || locale,
        'plural-forms': po.headers['Plural-Forms'] || 'nplurals=2; plural=(n != 1);',
      },
    };

    let count = 0;
    for (const [context, group] of Object.entries(po.translations)) {
      for (const [msgid, entry] of Object.entries(group)) {
        if (!msgid || entry.comments?.flag?.includes('fuzzy')) continue;
        const refs = (entry.comments?.reference ?? '').split(/\s+/).filter(Boolean);
        if (!refs.some(isAppReference)) continue;
        if (!entry.msgstr.some(Boolean)) continue;
        messages[context ? `${context}\u0004${msgid}` : msgid] = entry.msgstr;
        count++;
      }
    }

    const target = path.join(dir, `${domain}-${locale}-${handle}.json`);
    const jed = {
      'translation-revision-date': po.headers['PO-Revision-Date'] || '',
      generator: 'admin-client/scripts/i18n.mjs',
      domain: 'messages',
      locale_data: { messages },
    };
    fs.writeFileSync(target, `${JSON.stringify(jed)}\n`);
    console.log(`✓ ${locale}: ${count} strings → ${path.relative(process.cwd(), target)}`);
  }
}

/* ---- add -------------------------------------------------------------------------- */

/** A few common plural rules; anything else → edit the header in Poedit. */
const PLURAL_FORMS = {
  fa: 'nplurals=2; plural=(n > 1);',
  fr: 'nplurals=2; plural=(n > 1);',
  tr: 'nplurals=2; plural=(n > 1);',
  ar: 'nplurals=6; plural=(n == 0 ? 0 : n == 1 ? 1 : n == 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 && n % 100 <= 99 ? 4 : 5);',
  ru: 'nplurals=3; plural=(n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2);',
  ja: 'nplurals=1; plural=0;',
  zh: 'nplurals=1; plural=0;',
  ko: 'nplurals=1; plural=0;',
};

function add({ domain, locale, dir }) {
  if (!/^[a-z]{2,3}(_[A-Z]{2})?(_[a-z0-9]+)?$/.test(locale)) {
    console.error(`Invalid locale "${locale}" (expected e.g. de_DE, fr_FR, ja)`);
    process.exit(1);
  }
  const potFile = path.join(dir, `${domain}.pot`);
  const poFile = path.join(dir, `${domain}-${locale}.po`);
  if (fs.existsSync(poFile)) {
    console.error(`${path.relative(process.cwd(), poFile)} already exists.`);
    process.exit(1);
  }
  const lang = locale.split('_')[0];
  let po = fs.readFileSync(potFile, 'utf8');
  po = po.replace(/^"Language: .*\\n"\n/m, '');
  po = po.replace(/^"Plural-Forms: .*\\n"\n/m, '');
  po = po.replace(
    /^(msgstr ""\n(?:".*"\n)*?)("X-Domain:)/m,
    `$1"Language: ${locale}\\n"\n"Plural-Forms: ${PLURAL_FORMS[lang] ?? 'nplurals=2; plural=(n != 1);'}\\n"\n$2`,
  );
  fs.writeFileSync(poFile, po);
  console.log(
    `✓ Created ${path.relative(process.cwd(), poFile)} — translate it (e.g. with Poedit), then run: make i18n-compile`,
  );
}

/* ---------------------------------------------------------------------------------- */

const { command, options } = args();
switch (command) {
  case 'extract':
    required(options, 'domain', 'out');
    extract(options);
    break;
  case 'json':
    required(options, 'domain', 'handle', 'dir');
    json(options);
    break;
  case 'add':
    required(options, 'domain', 'locale', 'dir');
    add(options);
    break;
  default:
    console.error('Usage: node scripts/i18n.mjs <extract|json|add> [options]');
    process.exit(1);
}
