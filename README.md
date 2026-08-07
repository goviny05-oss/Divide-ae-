# 🥂 Divide Aê!

> **Dividir a conta nunca foi tão fácil.**

Aplicativo completo para dividir contas de restaurantes, bares, pizzarias, churrascarias e cafeterias em **tempo real**. Crie uma sala, compartilhe o código ou QR Code, todos adicionam seus pedidos e o app calcula **exatamente** quanto cada pessoa paga — sem erros de arredondamento, sem calculadora.

![Stack](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6) ![Vite](https://img.shields.io/badge/Vite-6-646cff) ![Vitest](https://img.shields.io/badge/Vitest-2-6b9e37)

---

## ✨ Funcionalidades

| Área | Recursos |
|---|---|
| **Salas** | Criar sala com código único de 6 caracteres + QR Code; entrar por código ou escaneando QR com a câmera; compartilhar por link/copy/clipboard |
| **Tempo real** | Sincronização instantânea entre abas e janelas via `BroadcastChannel` + `localStorage`; notificações de quem entrou/saiu, item adicionado/editado/excluído e conta fechada |
| **Itens** | Nome, preço, quantidade (inclusive fracionária, ex.: 1.5), observações, categoria (comida/bebida/sobremesa/outros); edição e exclusão por qualquer participante |
| **Divisão inteligente** | "Pagar sozinho" ou "Dividir" com checkbox por participante e **quantidade parcial** (ex.: batata qtd 3, João comeu 1, Maria 2) — cálculo automático com distribuição exata de centavos |
| **Taxas** | Taxa de serviço (10/13/15% ou valor personalizado), couvert artístico, desconto (% ou fixo) e cupom — tudo recalculado em tempo real |
| **Resumo individual** | Itens próprios, itens compartilhados, subtotal, taxa, couvert, desconto, cupom e total por pessoa |
| **Encerramento** | Resumo completo, quanto cada um paga, exportação em **PDF**, **imagem PNG** e **texto/link** (compartilhamento nativo) |
| **Histórico** | Contas fechadas salvas com restaurante, data, participantes, itens e totais; reabrir a qualquer momento |
| **Perfil & Config** | Foto, nome, tema claro/escuro/sistema, idioma (pt-BR/en/es), moeda (BRL/USD/EUR/GBP/MXN/ARS/PEN/COP/CLP) |
| **Extras** | Modo offline (tudo salvo localmente), feedback tátil (`navigator.vibrate`), animações suaves, glassmorphism, acessibilidade (WCAG), `prefers-reduced-motion` |

## 🔒 Regras de negócio garantidas por testes

- **Nunca perder dados** — toda mutação é persistida em `localStorage` antes de ser emitida.
- **Precisão exata** — dinheiro é sempre **inteiro em centavos** (`unitPrice`, `total`, taxas).
- **Sem erros de arredondamento** — divisão pelo método do **maior resto** (`fairSplit`): a soma das partes é *sempre* exatamente o total.
- **Soma individual = total da conta** — invariante verificada por testes de unidade (`bill.test.ts`).
- **Validação completa** — preços negativos, divisão inconsistente, participantes inexistentes, quantidades inválidas e cupons > 100% são rejeitados (`validate.ts`).

## 🧠 Arquitetura

Separação estrita entre **interface → regras de negócio → serviços**:

```
src/
├── domain/            # Regras de negócio puras (zero dependência de UI)
│   ├── money.ts       #   centavos inteiros, parse e formatação
│   ├── split.ts       #   distribuição exata (maior resto)
│   ├── bill.ts        #   cálculo completo da conta
│   ├── validate.ts    #   validações de formulários e integridade
│   ├── id.ts          #   códigos de sala e cores de avatar
│   └── __tests__/     #   testes de unidade (vitest)
├── services/          # Serviços externos/infra
│   ├── storage.ts     #   persistência local (nunca perde dados)
│   ├── sync.ts        #   tempo real (BroadcastChannel + fallback)
│   ├── qr.ts          #   geração de QR (qrcode)
│   ├── export.ts      #   PDF (print), PNG (canvas), compartilhamento
│   ├── clipboard.ts   #   cópia com fallback
│   ├── haptics.ts     #   feedback tátil
│   └── currency.ts    #   catálogo de moedas
├── store/             # Estado global reativo (perfil + preferências)
├── hooks/             # useRoom: estado da sala + sync + persistência
├── components/        # UI reutilizável (Button, Modal, Avatar, Toasts…)
├── screens/           # Telas (Home, Sala, Item, Taxas, Fechar, Histórico…)
├── i18n/              # pt-BR, en, es
├── router.tsx         # roteamento hash (PWA-friendly)
└── styles/global.css  # Design System (glassmorphism, temas, animações)
```

## 🚀 Como rodar

```bash
npm install        # instala dependências
npm run dev        # servidor de desenvolvimento (http://127.0.0.1:5173)
npm run test       # testes de unidade (vitest)
npm run typecheck  # verificação de tipos (tsc)
npm run build      # build de produção (dist/)
npm run preview    # serve o build de produção
```

> **Teste o tempo real:** abra `http://127.0.0.1:5173` em duas janelas, crie a sala em uma e entre na outra com o código — tudo sincroniza instantaneamente.

## 📱 Publicação (Play Store / App Store)

O app é uma PWA pronta para web e pode ser empacotada para Android/iOS com **Capacitor**. Veja o guia completo em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## ☁️ Backend remoto (Firebase — opcional)

A camada de sincronização (`src/services/sync.ts`) é uma **interface plugável**. A implementação local (BroadcastChannel) funciona em abas/janelas do mesmo navegador; para sincronizar **entre dispositivos**, plugue o adaptador Firestore incluído em [`backend/`](backend/README.md), junto com as regras de segurança e as Cloud Functions de referência.

## 🧪 Testes

```bash
npm run test
#  ✓ bill.test.ts   (10 testes — invariante da soma)
#  ✓ split.test.ts  ( 7 testes — distribuição exata de centavos)
#  ✓ money.test.ts  ( 8 testes — parsing e formatação)
```

## 🌍 Internacionalização

- **pt-BR** (padrão) · **English** · **Español**
- Moeda independente do idioma: BRL, USD, EUR, GBP, MXN, ARS, PEN, COP, CLP
- Formatos locais via `Intl.NumberFormat`

---

Feito com 💙 — sem mais contas na calculadora.
