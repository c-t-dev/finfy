# Conexões bancárias

> Última atualização: 2026-10-25

O app conecta bancos via Open Finance para importar transações, cartões e investimentos automaticamente. **Nada disso foi testado com um banco real**; esta página descreve o que aparece até o botão "Quero conectar".

## Onde aparece o catálogo

O mesmo catálogo ("Selecione seu Banco ou Cartão — Para trazer suas transações automaticamente") abre em: Extrato → "Fazer conexão", Início → Contas → "Adicionar", Meus investimentos → "Adicionar" / "Conectar banco", e Avatar → Gerenciar Conexões → "Conectar banco".

## Instituições

40 instituições, todas com `typeConnection: OPEN_FINANCE` e `connectorType: LINA` (agregador de Open Finance). 22 pedem só CPF; 18 aceitam CPF ou CNPJ (contas PJ). Tipos: `PERSONAL_BANK` (32), `BOTH_BANK` (7), `LEGAL_BANK` (1).

Lista: Nubank, Itaú, Santander, Mercado Pago, Banco do Brasil, Bradesco, Banco Inter, CAIXA, Banco XP, C6 Bank, PicPay, Sicoob, Sicredi, Rico, BTG Banking, Bradescard, 99 Pay, Porto Bank, Unicred, BTG Empresas, Banco do Nordeste, Neon, PagBank, Banco PAN, Carrefour, Banco Digio, BV Pessoa Física App, RecargaPay, Banco Mercantil, Banrisul, Clear Corretora, Méliuz, Banco Sofisa, EQI, Banco Bmg, InfinitePay, CAIXA Tem, Investimentos BB, Necton, Stone.

API: `GET /financial-core/v1/connection/financial-institutions` e `/v2/connection/financial-institutions`.

## Fluxo

1. Escolher o banco.
2. Tela "Conectar <banco>": conexão garantida pelo Banco Central, "Ambiente 100% seguro", três passos (autenticar no banco, confirmar consentimento, aguardar).
3. "Quero conectar" → autenticação no app do banco → consentimento.
4. Retorno ao portal com `?action=CONEXAO_CONCLUIDA`, que fecha a aba de retorno.

Conexões ativas: `GET /financial-core/v2/connections`; gerenciadas em Avatar → Gerenciar Conexões. Contas conectadas têm `lastSyncedAt` e `connectionDeletion` (estado de remoção).

## Migração da versão antiga

O último item do catálogo, "Importar dados", pede e-mail e senha da conta da experiência antiga do Minhas Economias e migra os dados ("Começar migração de dados", "Saber mais", "Vou depois"). Transações migradas caem na categoria "Antiga experiência".

## Alternativas citadas pela Ajuda

Não existe importação de arquivo (planilha, CSV, OFX); está registrada como pedido de melhoria. A Ajuda indica Open Finance, o conector MCP com uma IA ou lançamento manual.
