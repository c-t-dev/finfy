# Desenvolvimento local e notas de versão

> Última atualização: 2026-10-27
> Status: Aceita

## Contexto

O usuário decidiu reunir funcionalidades e correções na branch de trabalho, validando localmente antes de autorizar uma publicação. Pediu histórico de funcionalidades, melhorias e correções em notas de versão.

## Decisão

- Trabalhar e testar localmente na branch atual, sem publicar cada ajuste individual.
- Manter [CHANGELOG.md](../../CHANGELOG.md) no mesmo trabalho que implementar uma mudança relevante. Registrar comportamento entregue, sem dados pessoais, segredos ou tarefas apenas planejadas.
- Acrescentar itens em **Não publicado**, nas categorias Funcionalidades, Melhorias ou Correções, conforme necessário. Não criar seções vazias.
- Não atribuir novo número de versão durante a implementação. Definir a versão para o conjunto de mudanças na publicação autorizada, seguindo a [0015](0015-tags-de-producao.md).
- Somente publicar, enviar para produção ou criar uma nova tag após autorização explícita. Quando o deploy estiver confirmado, consolidar as notas com versão e data; manter a tag no commit efetivamente publicado.
- As notas de versão resumem o que mudou. A wiki continua registrando decisões, regras e evidências de testes em suas páginas próprias.

Sem mudança no banco ou no contrato da API.
