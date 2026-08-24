import { describe, expect, test } from "bun:test";
import { normalizeAppLocale, tr } from "../../src/lib/i18n";
describe("i18n", () => {
  test("Italian translates known interface strings", () => {
    expect(tr("it-IT", "Portfolio")).toBe("Portafoglio");
    expect(tr("it-IT", "Save as draft")).toBe("Salva come bozza");
    expect(tr("it-IT", "Missing FX rate")).toBe("Tasso FX mancante");
    expect(tr("it-IT", "+ Create new account")).toBe("+ Crea nuovo conto");
    expect(tr("it-IT", "Language & format")).toBe("Lingua e formato");
    expect(tr("it-IT", "Page not found")).toBe("Pagina non trovata");
    expect(tr("it-IT", "Close")).toBe("Chiudi");
    expect(tr("it-IT", "Some positions were unvalued")).toBe(
      "Alcune posizioni non erano valorizzate",
    );
    expect(tr("it-IT", "Ascending")).toBe("Crescente");
    expect(tr("it-IT", "Descending")).toBe("Decrescente");
    expect(tr("it-IT", "Sort direction")).toBe("Direzione ordinamento");
    expect(tr("it-IT", "Goal reached")).toBe("Obiettivo raggiunto");
    expect(tr("it-IT", "Drag down to close menu")).toBe(
      "Trascina verso il basso per chiudere il menu",
    );
    expect(tr("it-IT", "Map to Existing")).toBe("Associa a esistente");
    expect(tr("it-IT", "Log Trade")).toBe("Registra trade");
    expect(tr("it-IT", "Insert into import")).toBe("Inserisci nell'importazione");
    expect(tr("it-IT", "Sell")).toBe("Vendi");
    expect(tr("it-IT", "Move")).toBe("Sposta");
    expect(tr("it-IT", "New")).toBe("Nuovo");
    expect(tr("it-IT", "No matching accounts")).toBe("Nessun conto corrispondente");
    expect(tr("it-IT", "Search ticker or symbol")).toBe("Cerca ticker o simbolo");
    expect(tr("it-IT", "Quick Add")).toBe("Aggiunta rapida");
    expect(tr("it-IT", "Syntax guide")).toBe("Guida alla sintassi");
    expect(tr("it-IT", "Collapse")).toBe("Comprimi");
  });
  test("unknown user content is never guessed", () => {
    expect(tr("it-IT", "My custom account")).toBe("My custom account");
  });
  test("unsupported locale safely falls back to English", () => {
    expect(normalizeAppLocale("fr-FR")).toBe("en-US");
    expect(tr("fr-FR", "Portfolio")).toBe("Portfolio");
  });
});
