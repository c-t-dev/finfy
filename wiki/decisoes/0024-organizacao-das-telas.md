# Organização das informações nas telas

> Última atualização: 2026-10-27
> Status: Aceita para avaliação local

## Contexto

O usuário pediu revisar a distribuição das informações porque as telas estavam confusas. Após avaliar a primeira revisão, o usuário aprovou Bens e dívidas como sexto destino principal, logo após Contas e cartões.

## Decisão

| Tela | Objetivo e conteúdo |
| --- | --- |
| Início | Visão rápida do mês e saldo confirmado das contas. Resumo e categorias incluem pendentes para acompanhar o mesmo escopo do Extrato. |
| Extrato | Conferir lançamentos, filtros, pendências e projeção acumulada até o fim do mês. |
| Contas e cartões | Saldos e próximas faturas realizadas; previsões separadas, conforme 0023. |
| Planejamento | Limites mensais e metas em abas, cada uma com explicação do escopo. |
| Bens e dívidas | Visão de bens e obrigações com acesso direto no menu, após Contas e cartões. |
| Configurações | Grupos separados para carteira/compartilhamento, organização, acesso pessoal e administração. Arquivar carteira fica ao final. |

Adicionar contexto curto junto aos títulos. Não duplicar patrimônio no Início nem criar novos totais financeiros. A Home passa a apresentar pendências no total mensal e nas categorias, usando as consultas existentes; o saldo continua confirmado. Nenhuma alteração de armazenamento ou registros.

## Validação

Revisão de componentes React, títulos, grupos semânticos, responsividade e traduções en/pt-BR. Testes de carregamento independente mantidos, com expectativa da Home incluindo pendentes.

Nome final aprovado na revisão: Bens e dívidas no menu e título. Patrimônio líquido identifica apenas o resumo calculado. A rota existente permanece para preservar links.
