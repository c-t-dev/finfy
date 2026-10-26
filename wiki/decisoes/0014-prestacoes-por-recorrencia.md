# 0014 — Registrar só as prestações por recorrência

> Status: Aceita · Decidido em 2026-10-26 · Última atualização: 2026-10-26

## Contexto

A pessoa quer registrar apenas o valor da prestação de casa, carro ou outro compromisso, sem cadastrar o bem, o saldo devedor ou os juros. Precisa informar vencimento e quando termina.

## Decisão

- Usar a recorrência existente para esses pagamentos. Não é um cadastro completo de financiamento e não altera automaticamente dívidas no patrimônio.
- No lançamento de gasto com repetição, o valor é o de cada parcela. A data é o primeiro vencimento a registrar.
- Na repetição mensal, o dia desse primeiro vencimento determina os seguintes. Nos meses sem esse dia, usar o último dia do mês; os meses posteriores retomam o dia original.
- Oferecer término sem prazo, por data ou por quantidade de pagamentos. A quantidade inclui o primeiro vencimento informado: para um contrato já em andamento, informar somente os pagamentos restantes.
- Calcular a data final pela mesma função de calendário usada no servidor, com índice quantidade menos um. Enviar a data final inclusiva em `endDate`, já suportada pela API. Não há coluna nova para a quantidade.
- Mostrar a data do último vencimento calculado. Quantidade deve ser inteira e positiva; data final não pode ser anterior à inicial.
- O limite de geração permanece em 90 dias à frente. As demais ocorrências são geradas pelos próximos refreshes, respeitando a data final. Quantidade não significa criar toda a série imediatamente.
- O controle também se aplica às outras frequências e a ganhos recorrentes. Em ganhos, o rótulo é quantidade de lançamentos.
- Na edição de um lançamento que ainda não pertence a uma recorrência, o mesmo controle pode criar a série a partir dele. A edição da própria recorrência continua mostrando sua data final; quantidade é uma conveniência de criação, não um dado persistido.

Sem mudanças no esquema, nas rotas ou no contrato da API. O financiamento completo e sua ligação ao bem continuam pendentes.
