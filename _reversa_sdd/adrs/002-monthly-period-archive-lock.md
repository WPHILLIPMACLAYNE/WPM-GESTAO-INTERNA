# ADR 002 — Período Mensal com Fechamento e Bloqueio

Status: Aceito retroativamente
Data inferida: commit `feat: finalize assisted migration and monthly close flow`
Confiança: 🟢 **CONFIRMADO**.

## Contexto

A operação é mensal: atendimento, pendências, NPS, escala, eventos e addons são apurados por período `YYYY-MM`.

## Decisão

Ao fechar um mês, gerar arquivo JSON de fechamento, arquivar o período e bloquear edição posterior. O próximo mês é criado limpo ou preservado caso já tenha dados.

## Alternativas Consideradas

- Permitir edição livre de meses fechados.
- Manter apenas histórico visual sem trava.
- Fechar mês somente no backend remoto.

## Consequências

- Reduz risco de alteração retroativa acidental.
- Exige fluxo explícito de backup/reset.
- A UI precisa desabilitar muitos controles quando o período está fechado.
