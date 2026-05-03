# Detective — Permissões e RBAC

Gerado em: 2026-05-02T17:42:27Z

## Papéis

| Papel | Prioridade | Significado |
|---|---:|---|
| `admin` | 1 | administra unidade, membros e operação |
| `gestor` | 2 | gerencia operação e sincronização |
| `recepcao` | 3 | opera atendimentos, addons e pendências |
| `professor` | 4 | leitura operacional e participação em escala/recados |
| `leitura` | 5 | consulta operacional |

## Matriz de Permissões

| Recurso / Ação | admin | gestor | recepcao | professor | leitura |
|---|---:|---:|---:|---:|---:|
| Ler unidade e períodos | sim | sim | sim | sim | sim |
| Gerenciar unidade | sim | não | não | não | não |
| Gerenciar membros | sim | não | não | não | não |
| Criar/editar períodos | sim | sim | não | não | não |
| Fechar/resetar período remoto | sim | sim | não | não | não |
| Editar settings/addon types/NPS/escala/eventos via RLS ampla | sim | sim | não | não | não |
| Editar atendimentos | sim | sim | sim | não | não |
| Editar vendas de addon | sim | sim | sim | não | não |
| Editar pendências | sim | sim | sim | não | não |
| Ler auditoria | sim | sim | não | não | não |
| Sincronizar store completo para Supabase | sim | sim | não | não | não |
| Usar app local sem Supabase | sim | sim | sim | sim | sim |

## Camadas de Enforcement

| Camada | Enforcement |
|---|---|
| Banco | RLS em todas as tabelas públicas principais. |
| RPC | Funções sensíveis chamam `require_unit_role(...)`. |
| UI | `isBackendReadOnlyMode()` bloqueia edição quando sessão Supabase autenticada não é gravável. |
| Store local | Período fechado bloqueia ações por `LOCKED_CURRENT_PERIOD_*`. |
| Sync remoto | `SUPABASE_WRITABLE_ROLES = admin, gestor`. |

## Regras de Modo Somente Leitura

🟢 **CONFIRMADO** — Uma sessão autenticada em Supabase com role não gravável mantém leitura remota, mas desabilita ações de edição na UI. A mensagem mostra o papel ativo.

## Lacunas

| Lacuna | Impacto |
|---|---|
| Não há autenticação local quando Supabase está ausente. | O app browser-only local depende do controle do ambiente/distribuição. |
| O papel `professor` é modelado no RBAC, mas a fronteira exata de ações futuras não está completa na UI. | Pode exigir refinamento se professores passarem a escrever escala/recados. |
