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

## Bug conhecido: canvas irresponsivo (não corrigido)

O canvas **renderiza mas ignora todo input** (zoom, pan, atalhos) quando a abertura
do IndexedDB fica pendurada — tipicamente **com duas abas do builder abertas**.

Cadeia: `Canvas.svelte` faz `await initialize()` no `onMount` e só depois chama
`setupEventListeners()`. `initialize()` começa com `await initDB()`. Se o `open` não
resolve porque outra aba segura a conexão, o await nunca retorna e **os listeners
nunca são registrados**. O markup é estático, então a tela parece normal e o console
fica limpo.

Contribui: o handler `onversionchange` em `event-store.ts` fecha a conexão da aba
antiga quando uma nova abre. Foi escrito para corrigir "database connection is
closing" e, com duas abas, produz este bug.

`initDB()` não tem `onblocked` nem timeout; nem `onMount` nem `initialize()` têm
try/catch.

**Contorno:** manter uma aba só do builder.
**Fix real:** `onblocked` + timeout em `initDB()`, try/catch no `onMount`.
A branch `fix/canvas-unresponsive` foi criada para isso em dez/2025 e está **vazia**
— o fix nunca foi escrito.

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

## Limpeza pendente

- **43 branches locais** com 0 commits exclusivos vs `main` — histórico absorvido,
  seguras para deletar.
- **Worktrees `worktrees/docs` e `worktrees/engine`** apontam para um commit já
  mergeado, sem alterações. Remover com `git worktree remove`.
- **`feat/groupid-based-groups`** (4 commits) — abordagem `groupId` abandonada em
  favor de `parentGroupId`. O "fix crítico de data loss" dela **não é mais
  relevante**: o bug de escopo de `designState` não existe no código atual.
- **`fix/selection-ui-nested-rotation`** (5 commits, nov/2025) — rotação aninhada na
  selection UI, nunca mergeada. **Revisar antes de descartar**, pode ainda ser útil.

---

## Roadmap

Fase 1 em ~56%, milestones 1–5 completos, milestone 6 (Page Builder UI) em ~60%.
Faltam: janelas de Layers/Blocks/Tokens, publishing, gestão de páginas, preview mode,
export estático. Ver `docs/planning/roadmap.md`.
