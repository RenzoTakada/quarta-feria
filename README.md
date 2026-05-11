# Quarta-feira

Assistente pessoal de IA rodando localmente. Um agente único, com memória persistente, interface no terminal e raciocínio estendido via Claude.

```
claude-opus-4-7 | think high | tokens 0/200k (0%)

 ██████╗ ██╗   ██╗ █████╗ ██████╗ ████████╗ █████╗
██╔═══██╗██║   ██║██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗
...

quarta-feira:
Olá, Renzo. O que vamos fazer hoje?

──────────────────────────────────────────────────
❯ █
```

---

## O que é

Um assistente AI pessoal que roda no seu computador, sem depender de nenhum serviço externo além da API da Anthropic. Toda a memória fica local, em um banco PostgreSQL com suporte a busca vetorial.

**Características:**
- Raciocínio estendido (extended thinking) com Claude Opus
- Memória persistente entre sessões — o agente lembra de conversas anteriores
- Cérebro em PostgreSQL + pgvector (preparado para busca semântica)
- Interface TUI no terminal com indicador de tokens e progresso
- Ao fechar, resume e salva a sessão automaticamente
- Um único comando para iniciar tudo: `quarta-feira`

---

## Arquitetura

```
TUI (Ink/React) ──WebSocket──▶ Gateway ──▶ Agent Core ──▶ Claude API
                                  │               │
                              Sessão ativa    brain.db (PostgreSQL)
                                              ├── semantic_memory
                                              ├── episodes
                                              ├── procedures
                                              └── tool_cache
```

---

## Pré-requisitos

- **Node.js** 22.16+ ou 24+
- **Docker** (para o PostgreSQL com pgvector)
- **Conta Anthropic** com créditos de API

---

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/quarta-feria
cd quarta-feria
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` e adicione sua chave da API Anthropic:

```
DATABASE_URL=postgresql://quarta:feria@localhost:5432/quarta_feria
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Você pode gerar uma chave em [console.anthropic.com](https://console.anthropic.com).

### 4. Suba o banco de dados

```bash
docker compose up -d
```

Isso inicia o PostgreSQL com a extensão pgvector no Docker. Os dados ficam persistidos no volume `brain_data`.

### 5. Instale o comando global

```bash
npm link
```

### 6. Personalize (opcional)

Edite `~/.quarta-feria/config.yaml` (criado automaticamente na primeira execução):

```yaml
agent:
  name: quarta-feira
  model: claude-opus-4-7
  effort: high        # low | medium | high

user:
  name: Renzo         # seu nome — aparece no greeting e no contexto

gateway:
  port: 18790
```

---

## Uso

```bash
quarta-feira
```

Isso é tudo. O gateway sobe em background, o TUI abre, e você começa a conversar.

**Atalhos:**
- `ctrl+c` — encerra e salva a sessão automaticamente

**Logs do gateway** (para debug):
```bash
tail -f ~/.quarta-feria/gateway.log
```

---

## Memória

O agente tem quatro tipos de memória persistente:

| Tipo | O que guarda | Exemplo |
|---|---|---|
| `semantic` | Fatos sobre você e projetos | nome, preferências, projetos ativos |
| `episodic` | Resumo de sessões anteriores | "discutimos a arquitetura do projeto X" |
| `procedural` | Padrões aprendidos | "quando pede análise de código, verificar testes primeiro" |
| `working` | Contexto da sessão ativa | estado atual da conversa |

Tudo fica em `~/.quarta-feria/brain.db` (PostgreSQL via Docker).

---

## Ferramentas disponíveis

O agente pode usar:

| Ferramenta | O que faz |
|---|---|
| `bash` | Executa comandos no terminal |
| `memory_search` | Busca memórias por texto |
| `memory_save` | Salva fatos duráveis |
| `procedure_search` | Busca padrões aprendidos |
| `procedure_save` | Salva novos padrões |

---

## Estrutura do projeto

```
src/
├── agent/
│   ├── core.ts          # loop principal + extended thinking
│   ├── personality.ts   # caráter e instruções do agente
│   ├── context.ts       # injeta memória no início de cada sessão
│   ├── tokens.ts        # rastreia uso de tokens
│   └── tools/           # bash, memory, procedures
├── brain/
│   ├── db.ts            # conexão PostgreSQL + schema
│   ├── semantic.ts      # fatos duráveis
│   ├── episodic.ts      # sessões comprimidas
│   ├── procedures.ts    # padrões aprendidos
│   └── compressor.ts    # resume sessão ao fechar
├── gateway/
│   ├── server.ts        # WebSocket daemon
│   ├── session.ts       # estado da sessão ativa
│   └── protocol.ts      # tipos de mensagem
├── tui/
│   ├── App.tsx          # componente raiz
│   └── components/      # StatusBar, Messages, Thinking, InputArea, Banner
├── config.ts            # carrega ~/.quarta-feria/config.yaml
└── start.tsx            # entry point — sobe gateway + TUI

bin/
└── quarta-feira         # comando global (via npm link)
```

---

## Roadmap

- [ ] Web search tool
- [ ] Voz (Whisper STT + TTS)
- [ ] Visão (capture_screen + capture_camera)
- [ ] App nativo macOS
- [ ] Busca vetorial com embeddings (pgvector)

---

## Licença

Código visível, uso pessoal. Para contribuições, abra uma issue.
