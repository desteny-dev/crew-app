// Runde 8 (R8-63): Echte Fotos für den Beispielbestand — Personen, Gruppen und Find-Einträge.
//
// Jonathan: „Beispielbestand mit echten Fotos (Personen und Gruppen), aus freien Quellen mit klarer
// Lizenz, lokal im Projekt abgelegt (keine fremden Server zur Laufzeit), Herkunft dokumentiert."
//
// Die Bilder liegen in web/assets/demo/ (höchstens 256 px), die Herkunft jeder Datei — Quelle,
// Lizenz, Urheber, Größe — steht in web/assets/demo/HERKUNFT.md. Diese Liste nennt NUR Dateien, die
// wirklich im Projekt liegen: Sie wird zusammen mit den Dateien und HERKUNFT.md von
// scratch/.r8b-daten/fotos-holen.mjs geschrieben. Solange sie leer ist, zeigt der Beispielbestand
// genau, was er vorher zeigte (Zeichen-Bilder bzw. Initialen) — statt auf Bilder zu verweisen,
// die es nicht gibt.
//
// Form: { [id]: { pfad, urheber?, seite? } } — id ist eine Personen-, Gruppen-, Anfrage- oder
// Find-Id. `urheber` und `seite` tragen die Namensnennung, wo die Lizenz sie verlangt.
export const DEMO_FOTOS = {
  "p-me": {
    "pfad": "assets/demo/p-me.jpg"
  },
  "p-ayla": {
    "pfad": "assets/demo/p-ayla.jpg"
  },
  "p-mira": {
    "pfad": "assets/demo/p-mira.jpg"
  },
  "p-sam": {
    "pfad": "assets/demo/p-sam.jpg"
  },
  "p-tobi": {
    "pfad": "assets/demo/p-tobi.jpg"
  },
  "p-lena": {
    "pfad": "assets/demo/p-lena.jpg"
  },
  "p-noah": {
    "pfad": "assets/demo/p-noah.jpg"
  },
  "p-jonas": {
    "pfad": "assets/demo/p-jonas.jpg"
  },
  "p-kira": {
    "pfad": "assets/demo/p-kira.jpg"
  },
  "p-ben": {
    "pfad": "assets/demo/p-ben.jpg"
  },
  "p-elif": {
    "pfad": "assets/demo/p-elif.jpg"
  },
  "fr-pia": {
    "pfad": "assets/demo/fr-pia.jpg"
  },
  "fr-elias": {
    "pfad": "assets/demo/fr-elias.jpg"
  },
  "out-david": {
    "pfad": "assets/demo/out-david.jpg"
  },
  "dir-nina": {
    "pfad": "assets/demo/dir-nina.jpg"
  },
  "dir-felix": {
    "pfad": "assets/demo/dir-felix.jpg"
  },
  "dir-mara": {
    "pfad": "assets/demo/dir-mara.jpg"
  },
  "c-see": {
    "pfad": "assets/demo/c-see.jpg"
  },
  "c-sport": {
    "pfad": "assets/demo/c-sport.jpg"
  },
  "c-freitag": {
    "pfad": "assets/demo/c-freitag.jpg"
  },
  "f-pfaender": {
    "pfad": "assets/demo/f-pfaender.jpg",
    "urheber": "Asurnipal · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Bregenz-Pfaenderbahn-top_station-Bodensee-01ASD.jpg"
  },
  "f-kunsthaus": {
    "pfad": "assets/demo/f-kunsthaus.jpg",
    "urheber": "Feel free to use my photos, but please mention me as the author and if you want send me a message. or (rufre@lenz-nenning.at) · CC BY-SA 3.0 at",
    "seite": "https://commons.wikimedia.org/wiki/File:Kornmarktstra%C3%9Fe_3_Kunsthaus,_1.JPG"
  },
  "f-kub-gespraech": {
    "pfad": "assets/demo/f-kub-gespraech.jpg",
    "urheber": "Feel free to use my photos, but please mention me as the author and if you want send me a message. or (rufre@lenz-nenning.at) · CC BY-SA 3.0 at",
    "seite": "https://commons.wikimedia.org/wiki/File:Kornmarktstra%C3%9Fe_3_Kunsthaus,_1.JPG"
  },
  "f-rappenloch": {
    "pfad": "assets/demo/f-rappenloch.jpg",
    "urheber": "Asurnipal · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Dornbirn-Rappenlochschlucht-02ASD.jpg"
  },
  "f-oberstadt-fuehrung": {
    "pfad": "assets/demo/f-oberstadt-fuehrung.jpg",
    "urheber": "H.Helmlechner · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Blick_vom_Martinsturm_auf_Bregenz_01.jpg"
  },
  "f-theater-kornmarkt": {
    "pfad": "assets/demo/f-theater-kornmarkt.jpg",
    "urheber": "Photo: Andreas Praefcke · CC BY 3.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Bregenz_Theater_am_Kornmarkt.jpg"
  },
  "f-gebhardsberg": {
    "pfad": "assets/demo/f-gebhardsberg.jpg",
    "urheber": "Asurnipal · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Bregenz-Gebhardsberg-Hohen_Bregenz-01ASD_01.jpg"
  },
  "f-karren": {
    "pfad": "assets/demo/f-karren.jpg",
    "urheber": "Asurnipal · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Dornbirn-Karren-clouds-01ASD.jpg"
  },
  "f-kornmesser": {
    "pfad": "assets/demo/f-kornmesser.jpg",
    "urheber": "Schiffswalter · CC BY 3.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Gasthaus_Kornmesser_-_panoramio.jpg"
  },
  "f-goldener-hirschen": {
    "pfad": "assets/demo/f-goldener-hirschen.jpg",
    "urheber": "WolfD59 · Public domain",
    "seite": "https://commons.wikimedia.org/wiki/File:Bregenz_Goldener_Hirschen_Ausleger.jpg"
  },
  "f-inatura": {
    "pfad": "assets/demo/f-inatura.jpg",
    "urheber": "User:Plani / de:Benutzer:Plani · Public domain",
    "seite": "https://commons.wikimedia.org/wiki/File:Inatura_Dornbirn.jpg"
  },
  "f-poetry-slam": {
    "pfad": "assets/demo/f-poetry-slam.jpg",
    "urheber": "Asurnipal · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Spielboden-Kulturzentrum_im_Vorarlberg-01ASD.jpg"
  },
  "f-schiff-lindau": {
    "pfad": "assets/demo/f-schiff-lindau.jpg",
    "urheber": "Asurnipal · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Lake_Constance-ship_Stadt_Bregenz-02ASD.jpg"
  },
  "f-wirtshaus-am-see": {
    "pfad": "assets/demo/f-wirtshaus-am-see.jpg",
    "urheber": "böhringer friedrich · CC BY-SA 2.5",
    "seite": "https://commons.wikimedia.org/wiki/File:Wirtshaus_am_See_Bregenz.JPG"
  },
  "f-museum-abend": {
    "pfad": "assets/demo/f-museum-abend.jpg",
    "urheber": "Rendor Thuces Al'Nachkar · CC BY-SA 4.0",
    "seite": "https://commons.wikimedia.org/wiki/File:Bregenz_Vorarlberg-Museum_2024.jpg"
  },
  "f-open-air-kino": {
    "pfad": "assets/demo/f-open-air-kino.jpg",
    "urheber": "Florian Glöcklhofer · CC BY-SA 2.5",
    "seite": "https://commons.wikimedia.org/wiki/File:Bregenz_Seepromenade.jpg"
  }
};

// Der Pfad eines Fotos oder null — für die Seeds, damit keiner die Form kennen muss.
export function demoFoto(id) {
  return DEMO_FOTOS[id]?.pfad || null;
}
