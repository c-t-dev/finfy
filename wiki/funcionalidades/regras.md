# Regras de transação (categorização automática)

> Última atualização: 2026-10-25

Uma regra diz: "transações que batem com estas condições recebem estas alterações". Ela não cria lançamentos; só reorganiza os que existem e os que chegarem.

## Onde fica

Avatar → Regras de transação. Abas Ganhos e Gastos, busca, lista "Minhas Regras" com alça para arrastar e mudar a prioridade (`weight`). Há um ícone de lâmpada com dicas.

## Criar

Passo 1 — "Transações com" (condições):

| Condição | Operador |
| --- | --- |
| Descrição | similar a (`SIMILARITY`) |
| CPF / CNPJ | igual a |
| Valores (R$) | entre |
| Dias | entre |
| Dias da semana | entre |
| Nos meses | entre |
| Conta / Cartão | igual a |

Os quatro últimos ficam em "Mais opções". O tipo (Ganho/Gasto) vira a condição `TRANSACTION_TYPE EQUALS`. Enquanto preenche, o app mostra "N transações identificadas" (`POST /financial-core/v1/transactions/rule/preview`).

Passo 2 — "Alterar" (ações): Categoria, Descrição, Membro. Mostra "N transações alteradas".

Salvar: `POST /financial-core/v1/transactions/rule` com `isAppliedToHistorical: true` e `status: ACTIVE`. A resposta traz `ruleUUID`, `ruleId` numérico, `scope: INVESTOR`, `weight` e `origin: USER`.

A API também sugere regras: `GET /financial-core/v1/transactions/rule/suggestions`.

## Editar

Clicar numa regra abre "Editar regra". Salvar envia `PUT /financial-core/v1/transactions/rule/{uuid}` com o objeto inteiro. Na edição o status vai como `AT` (na criação, `ACTIVE`) e os IDs das condições são recriados. O botão "Excluir regra" fica no rodapé.

## Problemas conhecidos

- **Aplicada na transação errada:** a prévia listou o gasto original, mas depois de salvar quem mudou de categoria foi a cópia gerada pela recorrência (e as projeções). O original continuou igual.
- **Edição não reaplicou:** trocar a categoria de destino com histórico ligado não mudou nenhuma transação (verificado logo após salvar).
- **Pega transferências:** a prévia incluiu a saída de uma transferência, que tem categoria interna.
- No seletor de categoria da regra aparecem categorias internas (Fatura, Interna), que não aparecem no formulário de transação.
- A tela do Meu Clube lista "regras de categorização" como benefício pago, mas funcionou no plano gratuito.

Diferença para recorrência, segundo a Ajuda do app: use recorrência quando algo vai se repetir; use regra quando o lançamento já existe e só precisa cair na categoria certa.
