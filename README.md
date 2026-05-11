# Quarta-feira

Assistente pessoal de IA rodando localmente. Um agente único, com memória persistente, busca semântica por embeddings locais e interface no terminal.

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

Um assistente AI pessoal que roda no seu computador, sem depender de nenhum serviço externo além da API da Anthropic. Toda a memória fica local — PostgreSQL com busca vetorial real, embeddings gerados pelo Ollama na sua máquina.

**Características:**
- Raciocínio estendido (extended thinking) com Claude Opus
- Memória persistente entre sessões — o agente lembra de conversas anteriores
- **Busca semântica por similaridade vetorial** — via Ollama (nomic-embed-text, 768 dims)
- Embeddings 100% locais — nenhum texto sai da sua máquina para embeddings
- Fallback automático para busca full-text quando Ollama estiver indisponível
- Interface TUI no terminal com indicador de tokens e progresso
- Ao fechar, resume e salva a sessão automaticamente
- Um único comando para iniciar tudo: `quarta-feira`

---

## Arquitetura

```
TUI (Ink/React) ──WebSocket──▶ Gateway ──▶ Agent Core ──▶ Claude API (raciocínio)
                                  │               │
                              Sessão ativa    PostgreSQL + pgvector
                                              ├── semantic_memory  ◀── Ollama (embeddings)
                                              ├── episodes         ◀── Ollama (embeddings)
                                              ├── procedures
                                              └── tool_cache

Ollama (local) ─── nomic-embed-text ──▶ vetores 768 dims ──▶ busca por cosine similarity
```

**Separação de responsabilidades:**
- **Claude (Anthropic API)** — raciocínio, resposta, tomada de decisão
- **Ollama (local)** — apenas embeddings. Não processa chat. Roda em paralelo sem conflito.
- **PostgreSQL + pgvector** — armazena e busca vetores (índice HNSW), além de full-text search

---

## Pré-requisitos

| Requisito | Versão | Para que serve |
|---|---|---|
| **Node.js** | 22.16+ ou 24+ | rodar o projeto |
| **Docker** | qualquer | PostgreSQL com pgvector |
| **Ollama** | qualquer | embeddings locais |
| **Conta Anthropic** | — | API do Claude (raciocínio) |

---

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/RenzoTakada/quarta-feria
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

```env
DATABASE_URL=postgresql://quarta:feria@localhost:5432/quarta_feria
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Você pode gerar uma chave em [console.anthropic.com](https://console.anthropic.com).

### 4. Suba o banco de dados

```bash
docker compose up -d
```

Isso inicia o PostgreSQL 16 com a extensão pgvector. Os dados ficam persistidos no volume `brain_data` — nunca são perdidos ao reiniciar o container.

### 5. Configure o Ollama

O Ollama serve os embeddings localmente. Se ainda não tem instalado:

```bash
# macOS
brew install ollama

# ou baixe em https://ollama.com
```

Puxe o modelo de embedding:

```bash
ollama pull nomic-embed-text
```

> **Por que `nomic-embed-text`?**
> É um modelo de 274 MB otimizado para embeddings em múltiplos idiomas, produzindo vetores de 768 dimensões. Funciona bem com português e é rápido o suficiente para uso em tempo real (< 100ms por embedding num Mac M-series).

O Ollama sobe automaticamente como serviço ao instalar. Se precisar iniciá-lo manualmente:

```bash
ollama serve
```

**Nota:** Se você já usa Ollama com outros modelos (ex: llama3, mistral), não há conflito — ele serve múltiplos modelos simultaneamente. O quarta-feira usa apenas o `nomic-embed-text` para embeddings, sem interferir nos modelos de chat que você já usa.

### 6. Instale o comando global

```bash
npm link
```

### 7. Personalize (opcional)

Na primeira execução, o arquivo `~/.quarta-feria/config.yaml` é criado automaticamente. Você pode editá-lo:

```yaml
agent:
  name: quarta-feira
  model: claude-opus-4-7
  effort: high        # low | medium | high — controla o extended thinking

user:
  name: Renzo         # seu nome — aparece no greeting e no contexto do agente

gateway:
  port: 18790

ollama:
  url: http://localhost:11434   # endereço do servidor Ollama
  embedModel: nomic-embed-text  # modelo de embedding
```

Se o Ollama estiver em outra porta ou máquina, basta ajustar `ollama.url`.

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

## Memória e busca semântica

O agente tem quatro tipos de memória persistente:

| Tipo | O que guarda | Exemplo |
|---|---|---|
| `user_fact` | Fatos sobre você | nome, idioma, cargo |
| `preference` | Suas preferências | estilo de resposta, ferramentas favoritas |
| `project` | Projetos em andamento | contexto, decisões, estado atual |
| `entity` | Entidades relevantes | pessoas, tecnologias, conceitos |

### Como a busca funciona

Quando o agente precisa buscar na memória, ele usa dois métodos em sequência:

1. **Busca vetorial** (quando Ollama disponível) — gera um embedding da query e encontra memórias semanticamente próximas por cosine similarity. Retorna resultados relevantes mesmo que as palavras exatas não coincidam.
2. **Full-text search** (sempre ativo, complementa o vetorial) — busca por termos em português usando índice GIN do PostgreSQL.

Os resultados são mesclados e deduplicados. Se o Ollama estiver offline, cai automaticamente para o full-text — sem erro, sem interrupção.

### Comandos de memória no TUI

```
/memory                        lista todas as memórias salvas
/memory search <query>         busca por texto (ativa a busca semântica)
/memory delete <tipo> <chave>  remove uma memória específica
/memory health                 resumo do estado do cérebro

/sessions                      sessões anteriores resumidas
/procedures                    padrões aprendidos pelo agente
/config                        configuração atual
/tools                         ferramentas disponíveis
/safety                        regras de segurança bash
```

---

## Ferramentas disponíveis para o agente

| Ferramenta | O que faz |
|---|---|
| `bash` | Executa comandos no terminal (com lista de bloqueados e confirmação para arriscados) |
| `memory_search` | Busca semântica na memória (vetorial + full-text) |
| `memory_save` | Salva fatos duráveis sobre você ou projetos |
| `procedure_search` | Busca padrões aprendidos para tarefas recorrentes |
| `procedure_save` | Salva novos padrões comportamentais |

---

## Segurança bash

O agente pode executar comandos no terminal, mas com restrições:

**Bloqueados permanentemente** (nunca executam):
`rm -rf`, `sudo`, `cat ~/.ssh`, `cat .env`, `~/.aws`, `~/.kube`, etc.

**Arriscados** (exigem confirmação sua antes de executar):
`rm`, `git push --force`, `DROP TABLE`, `kill -9`, etc.

Digite `/safety` no TUI para ver a lista completa.

---

## Estrutura do projeto

```
src/
├── agent/
│   ├── core.ts          # loop principal + extended thinking
│   ├── personality.ts   # caráter e instruções do agente
│   ├── context.ts       # injeta memória no início de cada sessão
│   ├── tokens.ts        # rastreia uso de tokens
│   └── tools/
│       ├── bash.ts      # execução de comandos com safety check
│       ├── safety.ts    # padrões bloqueados e arriscados
│       ├── memory.ts    # memory_search + memory_save
│       ├── procedures.ts
│       └── index.ts     # dispatcher de ferramentas
├── brain/
│   ├── db.ts            # conexão PostgreSQL + schema + migração de dims
│   ├── embeddings.ts    # cliente Ollama — embed(), isAvailable(), toSql()
│   ├── semantic.ts      # fatos duráveis + busca vetorial + FTS fallback
│   ├── episodic.ts      # sessões comprimidas com embedding
│   ├── procedures.ts    # padrões aprendidos
│   └── compressor.ts    # resume sessão ao fechar (claude-haiku)
├── gateway/
│   ├── server.ts        # WebSocket daemon + shutdown handler
│   ├── session.ts       # estado da sessão ativa
│   └── protocol.ts      # tipos de mensagem client ↔ server
├── tui/
│   ├── App.tsx          # componente raiz
│   ├── commands.ts      # handler de /comandos internos
│   └── components/
│       ├── StatusBar.tsx    # modelo | tokens | conexão
│       ├── Messages.tsx     # histórico de mensagens
│       ├── Thinking.tsx     # spinner + tempo de raciocínio
│       ├── InputArea.tsx    # campo de input
│       └── Banner.tsx       # ASCII art inicial
├── config.ts            # carrega ~/.quarta-feria/config.yaml
└── start.tsx            # entry point — sobe gateway + TUI

bin/
└── quarta-feira         # comando global (via npm link)

docker-compose.yml       # PostgreSQL 16 + pgvector
```

---

## Roadmap

- [ ] Web search tool
- [ ] Voz (Whisper STT + TTS)
- [ ] Visão (capture_screen + capture_camera)
- [ ] App nativo macOS

---

## Licença

Código visível, uso pessoal. Para contribuições, abra uma issue.
