# 0015 — Tags para versões de produção

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-26

## Contexto

A pessoa quer pontos claros para recuperar versões anteriores no Git. Aprovou usar tags por versão publicada, em vez de manter uma branch de backup.

## Decisão

- Marcar versões de produção com tags anotadas no formato `vMAJOR.MINOR.PATCH`.
- Criar a tag no commit exato do deploy confirmado como pronto na Vercel. Não marcar automaticamente o `HEAD` se ele já avançou.
- Publicar somente a tag desejada com `git push origin <tag>`. Não mover nem reutilizar uma tag publicada.
- Primeira versão marcada: `v0.1.0`, commit `d3790824ee6ef08e67f8effd52f6b9195d465ac4`, com animações, autenticação sobre a Home e término de prestações recorrentes.
- Enquanto o projeto estiver em `0.x`, usar incremento menor para funcionalidades e de correção para ajustes. Definir `1.0.0` quando houver uma decisão explícita de primeira versão estável.
- O procedimento é manual. Não foi criada automação de tags ou alterado o versionamento dos pacotes do monorepo.
- A tag preserva uma referência ao código; não guarda cópia do banco e não desfaz migrações.
- Para desfazer código na principal, criar commits de reversão com `git revert`, validar e publicar conforme autorização. Não usar envio forçado para reescrever a principal.
- Um rollback imediato na Vercel e uma reversão no Git são ações distintas; manter produção e o histórico da principal alinhados após a recuperação.

Sem mudanças no banco ou na API.
