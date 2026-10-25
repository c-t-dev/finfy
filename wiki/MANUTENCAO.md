# Como manter esta wiki

Qualquer agente (Claude Code, Codex, IA local) ou pessoa que descobrir algo novo sobre o app atualiza a wiki no mesmo trabalho. A wiki só serve se refletir o estado atual.

## Regras

1. **Um assunto por página.** Funcionalidade nova ganha página em `funcionalidades/` e uma linha no índice do [README.md](README.md).
2. **Fato observado, não suposição.** Escreva o que foi visto na tela ou na rede. Quando for inferência, marque com **(inferido)** e diga de onde veio.
3. **Toda escrita na API vai para [api/payloads.md](api/payloads.md)** com o corpo enviado e o que voltou. Todo endpoint novo vai para [api/endpoints.md](api/endpoints.md).
4. **Todo bug ou comportamento estranho vai para [problemas-encontrados.md](problemas-encontrados.md)**, com como reproduzir.
5. **Todo teste feito vai para [testes/historico-de-testes.md](testes/historico-de-testes.md)**, com data. Item criado na conta vai para [testes/dados-de-teste.md](testes/dados-de-teste.md); item apagado sai de lá.
6. **Atualize a data** "Última atualização" no [README.md](README.md) e no topo da página alterada.
7. **Remova o que ficou falso.** Se um teste desmentir algo, corrija a página; não deixe as duas versões.
8. **Sem dados pessoais nem segredos.** Nunca copie para cá tokens, cookies, senhas, CPF, nomes reais, e-mails nem UUIDs da conta. Use marcadores como `{uuid}`, `{uuidAccount}`.

## Formato

- Português do Brasil, frases curtas.
- Tabelas para campos, endpoints e listas comparáveis.
- Nomes de campos, rotas e enums em `código`, exatamente como aparecem na API.
- Valores de dinheiro em reais (R$) e datas no formato AAAA-MM-DD.

## Cuidados ao testar no app real

- Use só a conta de teste e marque tudo que criar com o prefixo `[TESTE]` (ou `TESTE`, onde colchetes são removidos).
- **Botões de apagar agem na hora, sem confirmação.** Não clique em "Apagar" a menos que a intenção seja apagar.
- Não conecte bancos reais, não migre dados da versão antiga e não altere senha nem conta.
