# Pendências

> Última atualização: 2026-10-25

O que ainda não foi testado ou documentado. Ao testar um item, mova o resultado para a página da funcionalidade e tire-o daqui.

## Dá para testar com a conta de teste

- [ ] Gasto pago com cartão de crédito e o ciclo da fatura (fechamento, vencimento, pagamento).
- [ ] Recorrências com outras frequências (semanal com `frequencyWeekdays`, anual com `frequencyAnnualMonths`) e de ganho.
- [ ] Editar recorrência com escopo "Todas".
- [ ] Regra com outras condições (CPF/CNPJ, faixa de valor, dias, meses, conta) e ações (descrição, membro), para ver os nomes na API.
- [ ] Editar membro, bem, conta, cartão e objetivo.
- [ ] Arquivar conta.
- [ ] Ordenar objetivos e o menu ⋮ do detalhe do objetivo.
- [ ] Depósito em objetivo a partir de uma transação existente.
- [ ] "Ver ganhos" e Resumo do Mês com dados de vários meses.
- [ ] Exportar planilha de novo e confirmar se o arquivo é baixado; documentar as colunas.
- [ ] Redimensionar e maximizar componentes de um painel; renomear painel.
- [ ] Quanto tempo leva o processamento assíncrono de edições de recorrência e regra.

## Exclusões (precisam de quem tenha autorização para apagar)

- [ ] Excluir recorrência, regra, categoria, subcategoria, tag, conta, cartão, bem, objetivo, membro, limite e painel, capturando o pedido de cada um.
- [ ] Apagar parcela e transferência: ver os outros valores de `deleteType`.

## Fora de escopo nos testes (dados reais ou irreversível)

- Conectar banco por Open Finance.
- Migrar dados da versão antiga (pede e-mail e senha antigos).
- Conector MCP com um assistente de IA.
- Alterar senha e deletar conta.
- Convidar amigos.
- Assinar o Meu Clube.
