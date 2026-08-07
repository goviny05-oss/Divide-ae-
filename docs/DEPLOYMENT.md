# 🚀 Guia de Implantação — Divide Aê!

O Divide Aê! é uma **PWA** (Progressive Web App) construída com Vite + React — com `manifest.webmanifest`, ícones (192/512 + maskable), **service worker com cache offline** e suporte a "Adicionar à tela inicial". Ela roda na web e pode ser publicada nas lojas Android/iOS através do **Capacitor**, sem reescrever uma linha de código.

### PWA (já implementado)

- `vite-plugin-pwa` + Workbox: `dist/sw.js` com precache do app shell + runtime caching do Google Fonts.
- Ícones gerados de `public/icon.svg` via `@vite-pwa/assets-generator` (192/512, maskable, apple-touch, favicon).
- Para regenerar os ícones após alterar o SVG:
  ```bash
  npx @vite-pwa/assets-generator --preset minimal-2023 public/icon.svg
  ```

---

## 1. Publicação na Web (Vercel / Netlify / Firebase Hosting)

```bash
npm install
npm run build        # gera dist/
```

- **Vercel:** importe o repositório → *Framework Preset: Vite* → *Build: `npm run build`* → *Output: `dist`*.
- **Netlify:** *Build command: `npm run build`* → *Publish directory: `dist`*.
- **Firebase Hosting:**
  ```bash
  npm i -g firebase-tools
  firebase init hosting   # public dir: dist, SPA: sim
  firebase deploy
  ```

> ⚠️ Como o roteamento usa hash (`#/`), **não** é necessário configurar redirecionamentos SPA.

---

## 2. Publicação na Play Store (Android)

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Divide Aê" com.divideae.app --web-dir=dist
npm run build
npx cap add android
npx cap sync
npx cap open android      # abre o Android Studio
```

No Android Studio:
1. **Build → Generate Signed Bundle/APK** (crie um keystore).
2. Para QR Code + recursos de câmera, adicione no `AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.VIBRATE" />
   ```
3. Envie o `.aab` para o **Play Console** (Play App Signing recomendado).

---

## 3. Publicação na App Store (iOS)

Requer macOS + Xcode.

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios
npm run build
npx cap add ios
npx cap sync
npx cap open ios          # abre o Xcode
```

No Xcode:
1. Selecione o *Team* em **Signing & Capabilities**.
2. Adicione o uso da câmera em `Info.plist`:
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Usamos a câmera para escanear QR Codes de salas.</string>
   ```
3. Archive e envie pelo **App Store Connect**.

---

## 4. Sincronização entre dispositivos (Firebase)

A versão local sincroniza em tempo real entre **abas/janelas** do mesmo navegador (BroadcastChannel + localStorage). Para sincronizar entre **celulares diferentes**, ative o backend Firestore:

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Habilite **Firestore**, **Authentication (anônima)** e opcionalmente **Storage**.
3. Aplique as regras de segurança de `backend/firestore.rules`.
4. Instale e implemente as funções de `backend/functions`:
   ```bash
   cd backend/functions
   npm install
   npm run deploy
   ```
5. No app, crie um adaptador que implemente a interface de `src/services/sync.ts`
   (ver `backend/README.md` para o código do adaptador de referência).

---

## 5. Checklist antes do lançamento

- [ ] `npm run test` — todos os testes de unidade passando
- [ ] `npm run typecheck` — sem erros de tipo
- [ ] `npm run build` — build de produção ok
- [ ] Testar o fluxo completo em dispositivo real (criar sala → QR → dividir → fechar)
- [x] Ícone PWA + service worker offline (implementados)
- [ ] Splash screen no Capacitor (para lojas)
- [ ] Política de Privacidade (já presente no app, menu rodapé)
