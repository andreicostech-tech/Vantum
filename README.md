# vantumit.ro

Site static (Vercel) + panou de control la **vantumit.ro/admin**.
Conținutul stă în fișiere din repo, deci se poate modifica **din panou sau direct din cod**.

## Structură

```
index.html, styles.css, script.js, blob.js   ← site-ul (design, animații, formular)
i18n.js                ← limbile site-ului; textele vin din content/i18n.json
content/
  i18n.json            ← toate textele, în 6 limbi (+ proiectele din „Our Work”, la cheia `cases`)
  blog/*.md            ← articolele (un fișier = un articol, adresa /blog/<nume-fișier>/)
assets/uploads/        ← imaginile încărcate din panou
src/blog.js            ← șabloanele paginilor de blog (header/footer luate din index.html)
blog.js                ← limba și meniul pe paginile de blog
admin/                 ← panoul de control (interfața)
server/admin-api.js    ← logica panoului: login + citire/scriere fișiere
api/admin.js           ← aceeași logică, ca funcție Vercel
build.mjs              ← construiește site-ul în dist/ (rulat de Vercel la fiecare commit)
dev.mjs                ← server local
```

## Lucru local

```bash
npm install
npm run dev
```

- Site: http://localhost:4321
- Panou: http://localhost:4321/admin/ (utilizator `admin`, parolă `admin`; scrie direct în fișiere)

## Modificări din cod

- **Texte**: `content/i18n.json`. Fiecare limbă are aceleași chei; proiectele sunt în `cases`,
  în aceeași ordine în toate limbile.
- **Articol nou**: `content/blog/titlul-meu.md`:

  ```md
  ---
  title: "Titlul articolului"
  date: "2026-10-12"
  excerpt: "Rezumat scurt, apare în listă și în Google."
  cover: "/assets/uploads/imagine.jpg"
  tags: ["AI", "UX"]
  author: "Echipa Vantum"
  lang: "ro"
  draft: false
  ---

  Textul în **Markdown**.
  ```

  Linkul „Blog” din meniu apare automat după primul articol publicat.
- **Design / structură**: `index.html`, `styles.css`, `script.js` (ca înainte).

Commit + push pe `main` → Vercel publică automat.

## Panoul online

Setările sunt în Vercel → proiectul **vantum** → *Settings → Environment Variables*:

| Variabilă        | Ce este                                                        |
|------------------|----------------------------------------------------------------|
| `ADMIN_USER`     | utilizatorul panoului                                          |
| `ADMIN_PASSWORD` | parola panoului (se schimbă de aici, fără cod; apoi Redeploy)  |
| `ADMIN_SECRET`   | cheie aleatorie pentru sesiuni                                 |
| `GITHUB_TOKEN`   | token GitHub cu acces doar la acest repo (Contents: Read and write) |
| `GITHUB_REPO`    | `andreicostech-tech/Vantum`                                    |

Fiecare salvare din panou devine un commit în repo, iar site-ul se actualizează în ~1 minut.
