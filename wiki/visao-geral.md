# Visão geral

> Última atualização: 2026-10-25

O Minhas Economias é um app brasileiro de finanças pessoais. Ele junta contas, cartões, gastos, ganhos, patrimônio e metas num só lugar, com conexão automática a bancos via Open Finance ou lançamento manual.

## Onde roda

| Superfície | Endereço |
| --- | --- |
| Site institucional | `minhaseconomias.com.br` (menu "Entrar" leva ao portal) |
| Portal web | `portal.minhaseconomias.com.br` (app Flutter Web) |
| Apps móveis | existem; a exportação de planilha só funciona no portal |
| Servidor MCP | `https://mcp.minhaseconomias.com.br/mcp` (para assistentes de IA) |

## O que o usuário consegue fazer

- Registrar gastos, ganhos e transferências, à vista ou parcelados, com categoria, tags e membro da família.
- Conectar bancos por Open Finance para importar transações e investimentos.
- Ver saldo diário com projeção futura, resumo mensal, gastos por categoria e limites de gasto.
- Cadastrar recorrências (lançamentos que se repetem) e regras de categorização automática.
- Acompanhar patrimônio líquido: contas, investimentos, bens e dívidas.
- Criar objetivos financeiros e registrar depósitos neles.
- Montar painéis personalizados com componentes livres.
- Assistir cursos gratuitos de educação financeira.

## Plano gratuito x Meu Clube (pago)

O plano pago se chama **Meu Clube**. Pela tela de benefícios, ele inclui: conexões bancárias ilimitadas, importar dados das contas, conectar cartões, importar investimentos, regras de categorização, dicas para economizar e análise de evolução.

Na prática, durante os testes no plano gratuito:

- Regras de categorização funcionaram mesmo no plano gratuito.
- O layout "Padrão" do painel Início fica travado (cadeado), mas foi possível criar um painel novo.

## Relação com outras empresas

O backend usa os domínios `api/trademap/...` e o CDN `cdn-dev.valebroker.com.br`, e os cursos são da Ativa Investimentos. **(inferido)** O app pertence ao mesmo grupo da TradeMap/Vale Broker e reaproveita a infraestrutura deles.
