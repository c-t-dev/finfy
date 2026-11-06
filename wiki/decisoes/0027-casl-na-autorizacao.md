# 0027 — CASL na autorização compartilhada

> Status: Aceita · Última atualização: 2026-11-06

## Contexto

O usuário pediu usar CASL no módulo compartilhado que centraliza as autorizações do monorepo.

## Decisão

- Usar @casl/ability em packages/shared/src/roles.ts para avaliar as permissões por papel.
- Preservar a matriz da 0002 e as funções públicas can, canInvite, canChangeRole e canRemoveMember, incluindo restrições de hierarquia e ações sobre o próprio membro.
- Criar abilities tipadas com ações explícitas sobre Wallet. Ações desconhecidas são negadas; não conceder manage/all.
- Manter as instâncias compartilhadas privadas; createWalletAbility entrega uma instância nova, sem permitir que o consumidor altere permissões globais.
- Sessão, associação ativa à wallet e papel atual continuam sendo verificados no servidor a cada pedido. CASL não substitui esses controles nem corrige automaticamente caminhos que deixam de executá-los.

Sem mudança de esquema, API ou regras de produto. A auditoria dos caminhos de autorização continua separadamente.

## Esclarecimento sobre convites

Na revisão de segurança de 2026-11-06, o usuário confirmou que um ADMIN pode substituir um convite pendente emitido pelo dono por um de papel inferior, invalidando o link anterior. Esse caso é comportamento autorizado, não vulnerabilidade nem promoção de privilégios. Essa confirmação trata desse cenário de convite; não altera a regra que reserva ao OWNER conceder ADMIN ou alterar membros ADMIN ativos.
