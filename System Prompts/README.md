# System Prompts - Haumea

Documentação centralizada de todos os system prompts utilizados no Haumea.

## Arquivos

### 1. `01_Haumea_Default.md`
**Prompt Padrão da Haumea**

Utilizado em conversas normais. Define:
- Personalidade e princípios fundamentais
- Estilo de comunicação (tom, registro, formatação)
- Raciocínio e resolução de problemas
- Formatação técnica (LaTeX, código, SMILES, gráficos)
- Sistema de memórias persistentes

**Localização no código:** `haumea-functions/src/services/aiService.ts` (linhas 21-568)
**Constante:** `HAUMEA_SYSTEM_PROMPT`

---

### 2. `02_Guided_Study.md`
**Modo Estudo Guiado (Guided Study)**

Utilizado quando o usuário ativa o modo de estudo guiado. Define:
- Metodologia de ensino (Socratic method)
- Protocolo de resolução de problemas
- Gestão do ritmo do aluno
- Comunicação educacional
- Ensino de conceitos
- Calibragem e growth mindset

**Localização no código:** `haumea-functions/src/services/aiService.ts` (linhas 1348-1481)
**Ativação:** Via flag `guidedStudy: true` nas opções de streaming

---

### 3. `03_Debate_Mode.md`
**Modo Debate**

Utilizado para debates estruturados entre dois participantes. Define:
- Identidade e posição do participante
- Estrutura de participação (abertura, turnos, moderador)
- Qualidade argumentativa
- Tom e estilo retórico
- Gestão de pautas e repetição
- Técnicas de refutação
- Armadilhas cognitivas a evitar
- Protocolo de resgate de erro

**Localização no código:** `haumea-functions/src/functions/debateMode.ts` (linhas 13-554)
**Constante:** `DEBATE_SYSTEM_PROMPT`
**Placeholders:** 
- `{PARTICIPANT_NAME}` - Nome do participante
- `{POSITION}` - Posição (a_favor, contra, neutro)
- `{OPPONENT_NAME}` - Nome do oponente
- `{MODERATOR_NAME}` - Nome do moderador
- `{DEBATE_TOPIC}` - Tema do debate
- `{DEBATE_POINTS}` - Pautas em discussão

---

### 4. `04_Persona.md`
**Modo Persona (Identidade Customizada)**

Utilizado quando o usuário cria uma persona customizada. Define:
- Estrutura de uma persona
- Componentes (identidade, personalidade, expertise, diretrizes, padrões)
- Regras de incorporação
- Integração com memórias
- Exemplo completo

**Localização no código:** `haumea-functions/src/services/aiService.ts` (linhas 792-918)
**Função:** `buildPersonaSystemPrompt()`
**Ativação:** Via opção `personaConfig` nas opções de streaming

---

## Fluxo de Seleção de Prompt

O sistema seleciona qual prompt usar na seguinte ordem de prioridade:

1. **Persona** (`personaConfig`) - Se fornecido, substitui completamente o prompt padrão
2. **Custom System Prompt** (`customSystemPrompt`) - Se fornecido (ex: modo debate)
3. **Guided Study** (`guidedStudy: true`) - Se ativado
4. **Padrão** - Prompt padrão da Haumea

```
if (personaConfig) {
  // Usar persona
} else if (customSystemPrompt) {
  // Usar custom prompt (ex: debate)
} else if (guidedStudy) {
  // Usar guided study
} else {
  // Usar prompt padrão
}
```

---

## Características Comuns

### LaTeX
Todos os prompts que lidam com matemática usam:
- Delimitadores: `$...$` (inline) e `$$...$$` (display)
- Comandos LaTeX: `\alpha`, `\beta`, `\pi`, etc.
- NUNCA Unicode: α, β, π
- Valores monetários: R$ FORA do LaTeX

### Formatação de Código
- Inline: Um backtick `` `código` ``
- Blocos: Três backticks com linguagem `` ```javascript ``

### SMILES (Estruturas Químicas)
- Sempre três backticks: `` ```smiles ``
- Nunca backtick único

### Gráficos
- Sempre três backticks: `` ```graph ``
- JSON válido com tipo, dados e layout

---

## Integração com Memórias

Todos os prompts podem integrar memórias do usuário:
- **Memórias Globais:** Persistem entre conversas
- **Memórias do Chat:** Específicas de cada conversa
- Integração natural sem mencionar explicitamente

---

## Notas de Desenvolvimento

### Adicionando um Novo Prompt

1. Crie um novo arquivo em `System Prompts/` com nomenclatura clara
2. Documente em `README.md`
3. Implemente a lógica de seleção em `aiService.ts`
4. Teste com diferentes cenários

### Modificando Prompts Existentes

1. Atualize o arquivo correspondente em `System Prompts/`
2. Atualize a constante/função em `aiService.ts`
3. Teste para garantir que não quebra comportamentos existentes
4. Documente mudanças significativas

### Placeholders Dinâmicos

Alguns prompts usam placeholders que são substituídos em tempo de execução:
- Debate: `{PARTICIPANT_NAME}`, `{POSITION}`, etc.
- Persona: Pode ter placeholders customizados

Sempre use `replace()` com regex global para substituir todos os placeholders.

---

## Histórico de Versões

- **v1.0** (28/11/2025): Documentação inicial com 4 prompts principais
  - Haumea Default
  - Guided Study
  - Debate Mode
  - Persona

---

## Referências

- **Arquivo Principal:** `haumea-functions/src/services/aiService.ts`
- **Debate:** `haumea-functions/src/functions/debateMode.ts`
- **Hooks:** `hooks/useDebateMode.ts`
- **Tipos:** `types/chat.ts`
