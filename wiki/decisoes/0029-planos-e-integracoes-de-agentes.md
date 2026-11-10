# 0029 — Planos e integrações de agentes

> Status: Aceita para a primeira versão · Última atualização: 2026-11-10

O plano Grátis é o padrão das contas existentes e novas. O plano Pago é atribuído manualmente pelo administrador e, por enquanto, só habilita a integração de agentes. Não há cobrança, checkout, renovação nem provedor de pagamentos.

Hermes pessoal é o primeiro cliente previsto. Qualquer cliente pode usar a mesma API HTTPS a partir de um PC, VPS ou outro serviço. O agente faz conexões de saída e não precisa expor portas. O contrato está em [OpenAPI](../../apps/web/openapi.json) e o uso está descrito no [guia de integração](../finfy/agent-integrations.md).

- Uma conexão pertence a uma conta, pode autorizar várias carteiras e tem um segredo próprio, mostrado apenas na criação. Apenas o hash fica no banco.
- A conexão é de leitura ou de leitura e criação. A leitura consulta próximas faturas. A criação exige permissão para editar lançamentos e inclui receitas, despesas, transferências, compras no crédito à vista ou parceladas e recorrências de conta ou cartão. A conexão só cria lançamentos novos. Conexões antigas de escrita isolada são bloqueadas sem receber leitura.
- Em toda chamada, o servidor verifica o segredo, revogação, plano, carteira e papel vigente. A descoberta devolve apenas carteiras e escopos efetivamente disponíveis.
- As carteiras e os escopos são definidos na criação. Para mudar a autorização ou girar o segredo, revogue e crie outra conexão. O cliente escolhe carteira, cartão e categoria, inclusive quando guarda preferências.
- Cada modalidade usa o comando normal do Finfy, com a mesma auditoria e competência de fatura quando aplicável. O recibo de reenvio pertence à conexão e só é devolvido após nova autorização.
- A mudança de plano bloqueia as conexões enquanto a conta estiver no Grátis. A revogação encerra uma credencial mesmo após nova promoção a Pago.

MCP e OAuth ficam para uma versão posterior.
