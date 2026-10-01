# Herkunft der Beispielfotos (web/assets/demo/)

Runde 8, R8-63 — Jonathan: „Beispielbestand mit echten Fotos (Personen und Gruppen), aus freien
Quellen mit klarer Lizenz, lokal im Projekt abgelegt (keine fremden Server zur Laufzeit), Herkunft
dokumentiert." Geholt mit `scratch/.r8b-daten/fotos-holen.mjs`, jede Datei geprüft (JPEG, höchstens
256 px auf der längeren Seite). Welche Datei wo erscheint, steht in `web/data/seed/fotos.js`.

Lizenzen:
- **Unsplash-Lizenz** (picsum.photos): frei nutzbar, auch ohne Namensnennung — genannt wird trotzdem.
- **Wikimedia Commons**: CC0, gemeinfrei, CC BY oder CC BY-SA je Datei (Spalte Lizenz). Bei CC BY/BY-SA
  zeigt Find die Namensnennung am Bild (`bildUrheber`, `bildSeite`). Verkleinerte Fassungen von
  CC-BY-SA-Bildern stehen unter derselben Lizenz.
- **randomuser.me**: keine Standardlizenz. Die Seite sagt über ihre Porträts, sie seien „hand picked
  from the authorized section of UI Faces" — für Platzhalter freigegebene Gesichter. Sie stehen nur im
  Beispielbestand (Demo), nie bei echten Konten.

| Datei | Zeigt | Quelle | Lizenz | Urheber | Pixel | Bytes | Geholt |
|---|---|---|---|---|---|---|---|
| p-me.jpg | Jonathan (ich, Beispielkonto) | https://randomuser.me/api/portraits/men/11.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 5147 | 2026-09-19 |
| p-ayla.jpg | Ayla | https://randomuser.me/api/portraits/women/44.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 3539 | 2026-09-19 |
| p-mira.jpg | Mira | https://randomuser.me/api/portraits/women/65.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 5972 | 2026-09-19 |
| p-sam.jpg | Sam | https://randomuser.me/api/portraits/men/32.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 5242 | 2026-09-19 |
| p-tobi.jpg | Tobi | https://randomuser.me/api/portraits/men/46.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4824 | 2026-09-19 |
| p-lena.jpg | Lena | https://randomuser.me/api/portraits/women/68.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 6948 | 2026-09-19 |
| p-noah.jpg | Noah | https://randomuser.me/api/portraits/men/75.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 3615 | 2026-09-19 |
| p-jonas.jpg | Jonas | https://randomuser.me/api/portraits/men/86.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 5433 | 2026-09-19 |
| p-kira.jpg | Kira | https://randomuser.me/api/portraits/women/79.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 127 × 128 | 5270 | 2026-09-19 |
| p-ben.jpg | Ben | https://randomuser.me/api/portraits/men/22.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4752 | 2026-09-19 |
| p-elif.jpg | Elif | https://randomuser.me/api/portraits/women/90.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4035 | 2026-09-19 |
| fr-pia.jpg | Pia Brunner (Anfrage) | https://randomuser.me/api/portraits/women/12.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4067 | 2026-09-19 |
| fr-elias.jpg | Elias Wehr (Anfrage) | https://randomuser.me/api/portraits/men/52.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4344 | 2026-09-19 |
| out-david.jpg | David L. (gesendete Anfrage) | https://randomuser.me/api/portraits/men/60.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4563 | 2026-09-19 |
| dir-nina.jpg | Nina Rauch (Code) | https://randomuser.me/api/portraits/women/33.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 5160 | 2026-09-19 |
| dir-felix.jpg | Felix Egger (Code) | https://randomuser.me/api/portraits/men/41.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 4254 | 2026-09-19 |
| dir-mara.jpg | Mara Kaufmann (Code) | https://randomuser.me/api/portraits/women/21.jpg | keine Standardlizenz — randomuser.me: „hand picked from the authorized section of UI Faces" | — | 128 × 128 | 3473 | 2026-09-19 |
| c-see.jpg | See & Chill (Gruppenbild) | https://unsplash.com/photos/7BjmDICVloE (über https://picsum.photos/id/1011/256/256.jpg) | Unsplash-Lizenz (https://unsplash.com/license) | Roberto Nickson | 256 × 256 | 9699 | 2026-09-19 |
| c-sport.jpg | Sport-Gruppe (Gruppenbild) | https://unsplash.com/photos/Kt5hRENuotI (über https://picsum.photos/id/1018/256/256.jpg) | Unsplash-Lizenz (https://unsplash.com/license) | Andrew Ridley | 256 × 256 | 9956 | 2026-09-19 |
| c-freitag.jpg | Freitag-Crew (Gruppenbild) | https://unsplash.com/photos/TYIzeCiZ_60 (über https://picsum.photos/id/1060/256/256.jpg) | Unsplash-Lizenz (https://unsplash.com/license) | Karl Fredrickson | 256 × 256 | 11880 | 2026-09-19 |
| f-pfaender.jpg | Bregenz-Pfaenderbahn-top station-Bodensee-01ASD.jpg | https://commons.wikimedia.org/wiki/File:Bregenz-Pfaenderbahn-top_station-Bodensee-01ASD.jpg | CC BY-SA 4.0 | Asurnipal | 250 × 156 | 10156 | 2026-09-19 |
| f-kunsthaus.jpg | Kornmarktstraße 3 Kunsthaus, 1.JPG | https://commons.wikimedia.org/wiki/File:Kornmarktstra%C3%9Fe_3_Kunsthaus,_1.JPG | CC BY-SA 3.0 at | Feel free to use my photos, but please mention me as the author and if you want send me a message. or (rufre@lenz-nenning.at) | 250 × 175 | 23119 | 2026-09-19 |
| f-kub-gespraech.jpg | Kornmarktstraße 3 Kunsthaus, 1.JPG | https://commons.wikimedia.org/wiki/File:Kornmarktstra%C3%9Fe_3_Kunsthaus,_1.JPG | CC BY-SA 3.0 at | Feel free to use my photos, but please mention me as the author and if you want send me a message. or (rufre@lenz-nenning.at) | 250 × 175 | 23119 | 2026-09-19 |
| f-rappenloch.jpg | Dornbirn-Rappenlochschlucht-02ASD.jpg | https://commons.wikimedia.org/wiki/File:Dornbirn-Rappenlochschlucht-02ASD.jpg | CC BY-SA 4.0 | Asurnipal | 250 × 166 | 21145 | 2026-09-19 |
| f-oberstadt-fuehrung.jpg | Blick vom Martinsturm auf Bregenz 01.jpg | https://commons.wikimedia.org/wiki/File:Blick_vom_Martinsturm_auf_Bregenz_01.jpg | CC BY-SA 4.0 | H.Helmlechner | 250 × 140 | 16860 | 2026-09-19 |
| f-theater-kornmarkt.jpg | Bregenz Theater am Kornmarkt.jpg | https://commons.wikimedia.org/wiki/File:Bregenz_Theater_am_Kornmarkt.jpg | CC BY 3.0 | Photo: Andreas Praefcke | 250 × 249 | 24310 | 2026-09-19 |
| f-gebhardsberg.jpg | Bregenz-Gebhardsberg-Hohen Bregenz-01ASD 01.jpg | https://commons.wikimedia.org/wiki/File:Bregenz-Gebhardsberg-Hohen_Bregenz-01ASD_01.jpg | CC BY-SA 4.0 | Asurnipal | 250 × 166 | 11157 | 2026-09-19 |
| f-karren.jpg | Dornbirn-Karren-clouds-01ASD.jpg | https://commons.wikimedia.org/wiki/File:Dornbirn-Karren-clouds-01ASD.jpg | CC BY-SA 4.0 | Asurnipal | 250 × 187 | 4505 | 2026-09-19 |
| f-kornmesser.jpg | Gasthaus Kornmesser - panoramio.jpg | https://commons.wikimedia.org/wiki/File:Gasthaus_Kornmesser_-_panoramio.jpg | CC BY 3.0 | Schiffswalter | 250 × 187 | 17061 | 2026-09-19 |
| f-goldener-hirschen.jpg | Bregenz Goldener Hirschen Ausleger.jpg | https://commons.wikimedia.org/wiki/File:Bregenz_Goldener_Hirschen_Ausleger.jpg | Public domain | WolfD59 | 250 × 166 | 13479 | 2026-09-19 |
| f-inatura.jpg | Inatura Dornbirn.jpg | https://commons.wikimedia.org/wiki/File:Inatura_Dornbirn.jpg | Public domain | User:Plani / de:Benutzer:Plani | 250 × 187 | 27838 | 2026-09-19 |
| f-poetry-slam.jpg | Spielboden-Kulturzentrum im Vorarlberg-01ASD.jpg | https://commons.wikimedia.org/wiki/File:Spielboden-Kulturzentrum_im_Vorarlberg-01ASD.jpg | CC BY-SA 4.0 | Asurnipal | 250 × 194 | 16886 | 2026-09-19 |
| f-schiff-lindau.jpg | Lake Constance-ship Stadt Bregenz-02ASD.jpg | https://commons.wikimedia.org/wiki/File:Lake_Constance-ship_Stadt_Bregenz-02ASD.jpg | CC BY-SA 4.0 | Asurnipal | 250 × 140 | 16365 | 2026-09-19 |
| f-wirtshaus-am-see.jpg | Wirtshaus am See Bregenz.JPG | https://commons.wikimedia.org/wiki/File:Wirtshaus_am_See_Bregenz.JPG | CC BY-SA 2.5 | böhringer friedrich | 250 × 161 | 23171 | 2026-09-19 |
| f-museum-abend.jpg | Bregenz Vorarlberg-Museum 2024.jpg | https://commons.wikimedia.org/wiki/File:Bregenz_Vorarlberg-Museum_2024.jpg | CC BY-SA 4.0 | Rendor Thuces Al'Nachkar | 250 × 184 | 17015 | 2026-09-19 |
| f-open-air-kino.jpg | Bregenz Seepromenade.jpg | https://commons.wikimedia.org/wiki/File:Bregenz_Seepromenade.jpg | CC BY-SA 2.5 | Florian Glöcklhofer | 250 × 187 | 14065 | 2026-09-19 |
