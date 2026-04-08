# CARBONCHIP BI — PWA Hosting Guide

## Files in this package
```
carbonchip-pwa/
├── index.html       ← Main app (React + all logic)
├── manifest.json    ← PWA install config
├── sw.js            ← Service Worker (offline support)
├── icon-192.png     ← App icon (Android home screen)
├── icon-512.png     ← App icon (splash screen)
└── README.md        ← This file
```

---

## 🚀 Option A — Netlify Drop (EASIEST, FREE, 2 minutes)

1. Go to https://app.netlify.com/drop
2. Drag the entire `carbonchip-pwa` folder onto the page
3. Netlify gives you a URL like: `https://amazing-turing-123abc.netlify.app`
4. Done ✅ — Share that URL with your team

**To get a custom domain** (e.g. `app.carbonchip.com.au`):
- Sign up for Netlify free account
- Go to Site Settings → Domain Management → Add Custom Domain

---

## 🚀 Option B — Vercel (Also FREE, also 2 minutes)

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New Project" → "Deploy from CLI" or drag & drop
4. Done ✅

---

## 📱 Installing on Android (Chrome)

1. Open the app URL in Chrome
2. Tap the **⋮ menu** (three dots, top right)
3. Tap **"Add to Home Screen"**
4. Name it "CarbonChip" → tap **Add**
5. Icon appears on your home screen — opens full screen like a native app ✅

Alternatively: Chrome will show an **"Install App"** banner automatically at the bottom of the screen.

---

## 📱 Installing on iPhone (Safari)

1. Open the app URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share button** (box with arrow, bottom of screen)
3. Scroll down → tap **"Add to Home Screen"**
4. Name it "CarbonChip" → tap **Add**
5. Icon appears on your home screen ✅

**Note:** iOS requires Safari for PWA installation. Chrome on iPhone will not show the install option.

---

## 🔒 Security Note

The app stores all data **locally on each device** using the browser's localStorage.
Data does not leave the device. Each device maintains its own data.

**Dashboard password:** Mooseville26

---

## 🌐 Offline Use

Once installed and opened at least once, the app works **fully offline**.
The service worker caches all app files on first load.
Data entry works without internet — data is saved locally.
Charts and dashboards work offline from local data.

---

## ⚙️ Technical Notes

- Built with React 18 (CDN), Recharts (CDN), Babel Standalone
- AI photo analysis (Planter tab) requires internet connection (calls Anthropic API)
- All other features work offline
- Tested on: Chrome Android, Safari iOS, Chrome Desktop, Firefox

---

## 🆙 Updating the App

When you update `index.html`, update the cache version in `sw.js`:
Change `carbonchip-v1.0` to `carbonchip-v1.1` (or any new name)
This forces all devices to download the new version.
