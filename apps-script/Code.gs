/**
 * FRAMMENTI DI SOGNI E SPERANZE — Miran Demirovski
 *
 * Bound to the lyrics spreadsheet. Every tab is one song:
 *   A1        the title
 *   B1        optional language — IT / HR / EN (or Italiano / Hrvatski /
 *             English). Leave it empty and the page detects the language.
 *   C1        optional theme — what happens behind the glass when the song
 *             is opened. One of: Fioritura, Cromatica, Petali, Sfiorire,
 *             Roseto, Vortice, Rugiada, Brace, Gelo, Dolore, Kintsugi,
 *             Inchiostro, Risonanza, Aurora, Ombra.
 *             English and Croatian names work too. Empty means nothing.
 *             Frammenti -> Metti il menu a tendina dei temi puts a
 *             dropdown in C1 of every tab so you pick instead of typing.
 *   A2 down   the lyrics, one line per row
 *   blank row a break between stanzas
 *
 * Add a tab, write the song, reload the web app. There is no sync step:
 * the sheet is read fresh on every request.
 *
 * SPEED: switch on the Google Sheets API once, in the editor:
 *   Services (+)  ->  Google Sheets API  ->  Add
 * With it the whole file is read in ONE request. Without it the page still
 * works, reading each tab once. Run checkSetup to see which way it reads
 * and how many seconds it takes.
 */

var APP_TITLE = 'Frammenti di Sogni e Speranze';

/**
 * Tabs that are not songs. MAIN holds notes and the button; it never appears
 * in the web app and the corrector refuses it. Add more names here, or start
 * a tab name with an underscore and it is skipped without editing anything.
 */
var SKIP_TABS = ['MAIN'];

/**
 * The themes, in the order they appear in the C1 dropdown. The web app also
 * accepts the English and Croatian names (love, rain, zima...), so anything
 * already typed by hand keeps working; this list is only what the dropdown
 * offers and what the menu describes.
 */
var THEME_NAMES = [
  'Fioritura', 'Cromatica', 'Petali', 'Sfiorire', 'Roseto',
  'Vortice', 'Rugiada', 'Brace', 'Gelo', 'Dolore',
  'Kintsugi', 'Inchiostro', 'Risonanza', 'Aurora', 'Ombra'
];

var THEME_NOTES = [
  'Fioritura   una rosa si apre piano, poi comincia a perdere i petali',
  'Cromatica   quattro piccole rose agli angoli, dal bianco al rosso al nero',
  'Petali      una caduta di petali, vicini e lontani',
  'Sfiorire    una rosa perde i petali, che si posano in basso',
  'Roseto      i rami salgono dal basso e aprono rose mentre crescono',
  'Vortice     petali presi in un vortice lento',
  'Rugiada     una rosa dietro il vetro, e la rugiada sul vetro',
  'Brace       una rosa che brucia, la cenere la copre piano',
  'Gelo        una rosa che gela, aghi di brina che si allargano',
  'Dolore      il vetro si rompe, le crepe corrono dal colpo',
  'Kintsugi    le stesse crepe, ricucite con l oro',
  'Inchiostro  macchie d inchiostro che si allargano nella carta',
  'Risonanza   cerchi d acqua che si allargano piano',
  'Aurora      tende di luce verde e viola che ondeggiano',
  'Ombra       l ombra di rose e spine, che scorre come la luce'
];

function isSkippedTab(name) {
  var n = String(name || '').trim().toLowerCase();
  if (!n) return true;
  if (n.charAt(0) === '_') return true;
  for (var i = 0; i < SKIP_TABS.length; i++) {
    if (String(SKIP_TABS[i]).trim().toLowerCase() === n) return true;
  }
  return false;
}

/**
 * Serves the page. Deliberately NOT a template — createHtmlOutputFromFile
 * hands the file over untouched, so nothing in the CSS or JavaScript can be
 * mistaken for a scriptlet. The page asks for the songs itself, below.
 *
 * ALLOWALL lets the page on the GitHub address hold the app in a frame,
 * which is what keeps Google's banner away from the top of the screen.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Called by the page through google.script.run. Returns a JSON string. */
function getSongsJson() {
  return JSON.stringify(getSongs());
}

/**
 * Every visible tab, in sheet order, as
 *   { t: title, l: [lines], lang: 'IT'|'HR'|'EN'|'', theme: '...' }
 * The page sorts, colours, paginates and themes them; this only reads.
 *
 * Speed is the whole job here. The first version asked the spreadsheet five
 * separate questions for every tab, about 500 round trips for a hundred
 * songs, and that is why the page took half a minute. The Google Sheets API
 * hands back every tab in ONE request. If that service is not switched on,
 * or answers with an error, the slower path still reads each tab in one call
 * instead of five.
 */
var LAST_READ = '';

function getSongs() {
  if (typeof Sheets !== 'undefined') {
    try {
      var fast = getSongsFast_();
      LAST_READ = 'veloce (Google Sheets API, una sola richiesta)';
      return fast;
    } catch (e) {
      console.warn('Sheets API non disponibile, uso la strada lenta: ' + e.message);
    }
  }
  LAST_READ = 'lenta (attiva Google Sheets API in Servizi per renderla veloce)';
  return getSongsSlow_();
}

/** The whole file in one request: names, hidden flags and what every cell shows. */
function getSongsFast_() {
  var id = SpreadsheetApp.getActiveSpreadsheet().getId();
  var res = Sheets.Spreadsheets.get(id, {
    includeGridData: true,
    fields: 'sheets(properties(title,hidden),data(rowData(values(formattedValue))))'
  });

  var out = [];
  var sheets = (res && res.sheets) || [];
  for (var n = 0; n < sheets.length; n++) {
    var p = sheets[n].properties || {};
    if (p.hidden) continue;
    if (isSkippedTab(p.title)) continue;             // MAIN and friends are not songs

    var grid = (sheets[n].data && sheets[n].data[0]) || {};
    var rowData = grid.rowData || [];
    var rows = [];
    for (var r = 0; r < rowData.length; r++) {
      var vals = (rowData[r] && rowData[r].values) || [];
      var row = [];
      for (var c = 0; c < 3; c++) {                  // A lyrics, B language, C theme
        var cell = vals[c];
        row.push(cell && cell.formattedValue != null ? cell.formattedValue : '');
      }
      rows.push(row);
    }

    var song = songFromRows_(p.title, rows);
    if (song) out.push(song);
  }
  return out;
}

/** Without the Sheets API: one read per tab, which is still five times fewer than before. */
function getSongsSlow_() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var out = [];
  for (var n = 0; n < sheets.length; n++) {
    var sh = sheets[n];
    var name = sh.getName();
    if (isSkippedTab(name)) continue;                // checked first: it costs nothing
    if (sh.isSheetHidden()) continue;

    // getDisplayValues keeps exactly what the cell shows, so nothing is
    // coerced into a number or a date on the way out.
    var song = songFromRows_(name, sh.getDataRange().getDisplayValues());
    if (song) out.push(song);
  }
  return out;
}

/**
 * One tab's rows (column A lyrics, B1 language, C1 theme) made into a song.
 * Both paths above end here, so the fast one and the slow one can never
 * disagree about what a song is.
 */
function songFromRows_(tabName, rows) {
  var lines = [];
  for (var i = 0; i < rows.length; i++) {
    var a = (rows[i] && rows[i].length) ? rows[i][0] : '';
    lines.push(String(a == null ? '' : a).trim());
  }

  while (lines.length && !lines[lines.length - 1]) lines.pop();     // trailing blanks
  if (!lines.length) return null;

  var title = lines.shift() || tabName;
  while (lines.length && !lines[0]) lines.shift();                  // blanks under the title
  if (!title || !lines.length) return null;

  // Interior blank rows are kept: they are the breaks between stanzas.

  var first = rows[0] || [];
  var lang  = String(first[1] == null ? '' : first[1]).trim();
  var theme = String(first[2] == null ? '' : first[2]).trim();

  return { t: title, l: lines, lang: lang, theme: theme };
}

/**
 * Run this from the editor (Run -> checkSetup) to see what the page will get,
 * how long the sheet took to read, and which way it was read.
 * The result appears in the execution log.
 */
function checkSetup() {
  var all = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var skipped = [];
  for (var s = 0; s < all.length; s++) {
    if (isSkippedTab(all[s].getName())) skipped.push(all[s].getName());
  }

  var t0 = Date.now();
  var songs = getSongs();
  var seconds = ((Date.now() - t0) / 1000).toFixed(1);

  Logger.log('Tabs in the file: %s', all.length);
  Logger.log('Tabs ignored: %s', skipped.length ? skipped.join(', ') : 'none');
  Logger.log('Songs found: %s', songs.length);
  Logger.log('Read in %s seconds, strada %s', seconds, LAST_READ);
  for (var i = 0; i < songs.length && i < 40; i++) {
    Logger.log('  %s  (%s lines, lingua=%s, tema=%s)',
      songs[i].t, songs[i].l.length, songs[i].lang || '-', songs[i].theme || '-');
  }
  if (!songs.length) {
    Logger.log('NOTHING FOUND. Check that A1 holds the title and the lyrics start at A2.');
  }
  return songs.length;
}

/** A small menu inside the spreadsheet itself. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Frammenti')
    .addItem('Apri la raccolta', 'showAppUrl')
    .addItem('Conta i testi', 'countSongs')
    .addItem('Temi disponibili', 'showThemes')
    .addItem('Metti il menu a tendina dei temi', 'setupThemeDropdowns')
    .addSeparator()
    .addItem('Correggi gli accenti italiani (tutti i testi)', 'fixItalianAccentsAll')
    .addItem('Correggi i segni croati', 'hrOpenPanel')
    .addToUi();
}

function showAppUrl() {
  var url = ScriptApp.getService().getUrl();
  var ui = SpreadsheetApp.getUi();
  if (!url) {
    ui.alert('Non ancora pubblicata',
      'Distribuisci lo script come applicazione web, poi riprova.\n\n' +
      'Distribuisci  ->  Nuova distribuzione  ->  Applicazione web',
      ui.ButtonSet.OK);
    return;
  }
  var html = HtmlService.createHtmlOutput(
      '<p style="font:14px/1.6 system-ui;padding:6px 2px">' +
      '<a href="' + url + '" target="_blank" rel="noopener">Apri la raccolta</a></p>')
    .setWidth(320).setHeight(90);
  ui.showModalDialog(html, APP_TITLE);
}

function countSongs() {
  var songs = getSongs();
  var withLang = 0, withTheme = 0, byTheme = {};
  for (var i = 0; i < songs.length; i++) {
    if (songs[i].lang) withLang++;
    var th = String(songs[i].theme || '').trim();
    if (th) { withTheme++; byTheme[th] = (byTheme[th] || 0) + 1; }
  }
  var lines = [];
  for (var k in byTheme) lines.push('   ' + k + ': ' + byTheme[k]);

  SpreadsheetApp.getUi().alert(
    songs.length + (songs.length === 1 ? ' testo' : ' testi') +
    '\n\nLingua indicata in B1: ' + withLang +
    '\nLingua rilevata dal testo: ' + (songs.length - withLang) +
    '\n\nTema indicato in C1: ' + withTheme +
    '\nSenza tema: ' + (songs.length - withTheme) +
    (lines.length ? '\n\n' + lines.join('\n') : ''));
}

/** The theme names you can put in C1. */
function showThemes() {
  var ui = SpreadsheetApp.getUi();
  ui.alert('Temi disponibili (cella C1)',
    THEME_NOTES.join('\n') + '\n\n' +
    'Lascia C1 vuoto per nessun effetto.\n' +
    'Funzionano anche i nomi in inglese e in croato (love, rain, zima...).\n\n' +
    'Frammenti  ->  Metti il menu a tendina dei temi\n' +
    'mette la tendina in C1 di ogni scheda, cosi lo scegli invece di scriverlo.',
    ui.ButtonSet.OK);
}

/**
 * Puts a dropdown of the theme names in C1 of every song tab, so the theme
 * is chosen from a list and never mistyped. Safe to run again whenever new
 * tabs are added: existing choices are left exactly as they are.
 */
function setupThemeDropdowns() {
  var ui = SpreadsheetApp.getUi();
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(THEME_NAMES, true)
    .setAllowInvalid(true)          /* names in English or Croatian still pass */
    .setHelpText('Scegli un tema, oppure lascia vuoto per nessun effetto.')
    .build();

  var done = 0, skipped = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (isSkippedTab(sh.getName())) { skipped.push(sh.getName()); continue; }
    sh.getRange(1, 3).setDataValidation(rule);
    done++;
  }

  ui.alert('Tendina dei temi',
    'Messa in C1 di ' + done + (done === 1 ? ' scheda.' : ' schede.') +
    (skipped.length ? '\nIgnorate: ' + skipped.join(', ') : '') +
    '\n\nClicca C1 in una scheda e scegli il tema.\n' +
    'Rilancia questa voce dopo aver aggiunto nuove schede.',
    ui.ButtonSet.OK);
}
/* ------------------------------------------------- Italian accents, all at once */

/**
 * Frammenti -> Correggi gli accenti italiani (tutti i testi)
 *
 * Every Italian song at once: wherever an apostrophe stands in for an accent
 * at the end of a word, the accent goes in and the apostrophe goes away.
 *   piu' -> più    e' -> è    E' -> È    perche' -> perché    citta' -> città
 *   ANDRO' -> ANDRÒ    li' -> lì    caffe' -> caffè
 *
 * What is never touched:
 *   - an apostrophe followed by a letter, which is an elision: l'amore, c'è
 *   - a word ending in a consonant: L' anima, quell' universo
 *   - the words where the apostrophe is the right spelling: po' mo' va' fa'
 *     da' di' sta' to' be' ca' pie'
 *   - tabs that are not Italian (B1, or the words themselves, decide), so an
 *     English "lovin'" or a Croatian line is safe
 *   - cells with a formula, numbers and dates
 *
 * Nothing is written until you have seen the list and said yes. Undo, if ever
 * needed: File -> Version history.
 */
var IT_APOS_KEEP = ['po', 'mo', 'va', 'fa', 'da', 'di', 'sta', 'to', 'be', 'ca', 'pie'];

/** The accented form of one word written with an apostrophe, or null to leave it. */
function itAccentWord_(word) {
  var bare = word.slice(0, -1);
  var low = bare.toLowerCase();
  if (IT_APOS_KEEP.indexOf(low) >= 0) return null;
  if (/[àèéìòùáíóú]/i.test(bare)) return bare;          // accent already there: drop the apostrophe

  var last = bare.charAt(bare.length - 1);
  var v = last.toLowerCase();
  var caps = last !== v;
  var stem = bare.slice(0, -1);
  var grave = { a: 'à', i: 'ì', o: 'ò', u: 'ù', e: 'è' };
  if (!grave[v]) return null;                            // ends in a consonant: an elision, leave it

  if (v === 'e' && (/(?:ch|tr)e$/.test(low) || low === 'ne' || low === 'se')) {
    return stem + (caps ? 'É' : 'é');                    // perché, finché, ventitré, né, sé
  }
  var out = grave[v];
  return stem + (caps ? out.toUpperCase() : out);
}

/** One line with every accent put in; `found` collects what changed. */
function itAccentLine_(text, found) {
  var re = /[A-Za-zÀ-ɏ]+['’´](?![A-Za-zÀ-ɏ])/g;
  return String(text).replace(re, function (w) {
    var to = itAccentWord_(w);
    if (to === null) return w;
    var key = w.replace(/[’´]$/, "'") + '  ->  ' + to;
    found[key] = (found[key] || 0) + 1;
    return to;
  });
}

/** Is this tab Italian? B1 first, then the words, using the corrector's own judge. */
function itIsItalianTab_(b1, words) {
  if (typeof hrLangOf === 'function') return hrLangOf(b1, words) === 'it';
  return /^(it|ita|italiano|italian)$/i.test(String(b1 || '').trim());
}

function fixItalianAccentsAll() {
  var ui = SpreadsheetApp.getUi();
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var plan = [], found = {}, words = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (isSkippedTab(sh.getName())) continue;
    var last = sh.getLastRow();
    if (last < 1) continue;

    var range = sh.getRange(1, 1, last, 1);
    var values = range.getValues();
    var formulas = range.getFormulas();
    var b1 = sh.getLastColumn() >= 2 ? sh.getRange(1, 2).getDisplayValue() : '';

    var text = [];
    for (var r = 0; r < values.length; r++) if (typeof values[r][0] === 'string') text.push(values[r][0]);
    if (!itIsItalianTab_(b1, text.join(' '))) continue;

    var changed = false, here = {};
    for (var r2 = 0; r2 < values.length; r2++) {
      var v = values[r2][0];
      if (typeof v !== 'string' || formulas[r2][0]) continue;
      var fixed = itAccentLine_(v, here);
      if (fixed !== v) { values[r2][0] = fixed; changed = true; }
    }
    if (!changed) continue;

    for (var k in here) { found[k] = (found[k] || 0) + here[k]; words += here[k]; }
    plan.push({ sheet: sh, range: range, values: values });
  }

  if (!plan.length) {
    ui.alert('Accenti italiani', 'Nessun accento da correggere: i testi italiani sono già a posto.', ui.ButtonSet.OK);
    return;
  }

  var list = Object.keys(found).sort(function (a, b) { return found[b] - found[a]; });
  var shown = list.slice(0, 18).map(function (k) { return '   ' + k + (found[k] > 1 ? '   (' + found[k] + ')' : ''); });
  if (list.length > 18) shown.push('   … e altre ' + (list.length - 18));

  var names = plan.map(function (p) { return p.sheet.getName(); });
  var answer = ui.alert('Accenti italiani',
    words + (words === 1 ? ' parola' : ' parole') + ' in ' + plan.length +
    (plan.length === 1 ? ' testo' : ' testi') + ':\n\n' + shown.join('\n') +
    '\n\nTesti: ' + names.join(', ') +
    '\n\nCorreggo tutto adesso?\n(Si può sempre tornare indietro da File -> Cronologia versioni.)',
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  for (var p = 0; p < plan.length; p++) plan[p].range.setValues(plan[p].values);
  ui.alert('Accenti italiani', 'Fatto: ' + words + (words === 1 ? ' parola corretta' : ' parole corrette') +
    ' in ' + plan.length + (plan.length === 1 ? ' testo.' : ' testi.') +
    '\nRicarica la raccolta per vederli.', ui.ButtonSet.OK);
}
