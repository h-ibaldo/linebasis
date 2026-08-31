# Estado do Projeto

**Atualizado:** 29 de agosto de 2026
**Branch de trabalho:** `feat/groups-inside-divs` (worktree `worktrees/canvas`)
**Servidor:** `npm run dev -- --port 5174` — uma aba só (ver bug do IndexedDB abaixo)

---

## Onde estamos

O trabalho vivo está **inteiro** em `feat/groups-inside-divs`: 25 commits à frente
do `main`, cobrindo dez/2025 → fev/2026, mais um fix de ago/2026. Está publicada no
GitHub.

Tema da linha: **grupos dentro de containers auto-layout**.

- dez/2025 — ungroup aninhado, multi-seleção arrastável, drill-down estilo Figma
  (`isolationStack`, lógica testada em `src/lib/utils/drill-down-figma-logic.ts`)
- fev/2026 — resize proporcional dos filhos, preview ao vivo, paste de
  group-of-groups, wrapper transparente ao usuário, `Cmd+Shift+G` descascando um
  nível por vez, três fixes de `parentGroupId` circular (stack overflow)
- ago/2026 — travessia completa da ancestralidade para achar o filho direto do AL
  no drag (`6813e5e`)

**Avaliação atual:** utilizável para seguir trabalhando. Grupos dentro de auto-layout
ainda precisam de trabalho — é a frente aberta.

---

## Frente aberta: grupos em auto-layout

Não há diagnóstico registrado ainda; o que existe é a avaliação de que "precisa de
trabalho". Ao retomar, vale caracterizar o sintoma exato antes de mexer no código:
arraste/reordenação, resize do wrapper, `Cmd+Shift+G`, paste, ou seleção do alvo
errado no clique.

---

## Canvas irresponsivo — CORRIGIDO (29/ago/2026, commit 7e1bcc6)

O canvas renderizava mas ignorava todo input (zoom, pan, atalhos) quando a abertura
do IndexedDB ficava pendurada — tipicamente **com duas abas do builder abertas**,
que é uso normal.

Cadeia: `Canvas.svelte` fazia `await initialize()` no `onMount` e só depois chamava
`setupEventListeners()`. `initialize()` começa com `await initDB()`. Com outra aba
segurando a conexão, `indexedDB.open()` dispara `onblocked` e nunca resolve — o await
não retornava e **os listeners nunca eram registrados**. O markup é estático, então a
tela parecia normal e o console ficava limpo.

Correção:
- `initDB()` trata `onblocked` e tem deadline de 5s — um open travado rejeita em vez
  de pendurar quem espera
- `onMount` envolve `initialize()` em try/catch, então `setupEventListeners()` roda de
  qualquer jeito: falha de carregamento nunca mais custa o input do usuário
- A falha aparece na UI em vez de mostrar canvas vazio como se estivesse tudo bem

Cobertura em `src/lib/stores/event-store-init.test.ts` (4 testes): caminho bloqueado,
caminho que nunca resolve, sucesso normal, e sucesso sem rejeição tardia do timer. Os
dois primeiros travam até o timeout do vitest sem o fix.

Era o bug para o qual a branch vazia `fix/canvas-unresponsive` foi criada em dez/2025.

---

## Outros pontos

- **1 teste falhando** (pré-existente, não relacionado ao trabalho de grupos):
  `sanitize.test.ts` — "should remove inline styles". `sanitizeTextContent` não está
  removendo `style=`. 52/53 passam.
- **`prisma/dev.db` está trackeado** apesar de `*.db` no `.gitignore` — foi commitado
  antes da regra. Suja o `git status` a cada uso do app. Resolver com
  `git rm --cached prisma/dev.db`.
- **Push por SSH não funciona** (chaves não aceitas pelo GitHub). Usar a credencial
  do `gh` CLI via HTTPS.

---

## Limpeza — feita (30/ago/2026)

- 48 branches locais deletadas (43 já absorvidas no `main` + 5 snapshots redundantes
  já contidos em `feat/groups-inside-divs`). De ~50 para 9.
- Worktrees fantasma `worktrees/docs` e `worktrees/engine` removidos.
- `worktrees/` estava commitado como gitlinks modo 160000 sem `.gitmodules` — eram
  worktrees locais, não submodules. Destrackeado e adicionado ao `.gitignore`; era
  a origem do `git status` sujo que persistia há meses.

### Branches vivas

- **`feat/groups-inside-divs`** — a linha de trabalho (worktree `worktrees/canvas`)
- **`main`**
- **`fix/selection-ui-nested-rotation`** (5 commits, nov/2025) — rotação aninhada na
  selection UI, nunca mergeada. **Revisar antes de descartar.**
- **`feat/groupid-based-groups`** (4 commits) — abordagem `groupId` abandonada. O
  "fix crítico de data loss" dela não é mais relevante: o bug de escopo de
  `designState` não existe no código atual. Descartável.
- 4 branches `phase-1/*` e `feat/canvas-improvements-*` com 1 commit exploratório
  cada ("testing stuff", "test 2") — provavelmente descartáveis, não revisadas.

---

## Roadmap

Fase 1 em ~56%, milestones 1–5 completos, milestone 6 (Page Builder UI) em ~60%.
Faltam: janelas de Layers/Blocks/Tokens, publishing, gestão de páginas, preview mode,
export estático. Ver `docs/planning/roadmap.md`.
