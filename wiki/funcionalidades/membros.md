# Membros

> Última atualização: 2026-10-25

Membros são pessoas da família associadas a gastos e ganhos para saber quanto cada uma gastou. **Não dão acesso ao app:** não existe login multiusuário; a Ajuda diz que isso está registrado como sugestão de melhoria.

## Criar (`/member/` → "Criar membro")

| Campo | Observação |
| --- | --- |
| Nome e sobrenome (obrigatório) | o campo remove caracteres especiais ("[TESTE] Maria" vira "TESTE Maria") |
| Foto | opcional |
| Data de nascimento | dd/mm/aaaa |
| Grau de parentesco | Conhecido, Familiar, Companheiro(a), Pai/Mãe, Filho(a), Irmão/Irmã, Pet, Amigo(a), Colega de trabalho, Dependente, Outros |

Salvar: `POST /financial-core/v1/members` com `name`, `image`, `relationship` (ex.: `FAMILIAR`), `birthDate`. Resposta: `uuidMember`, `memberName`, `relationship`, `totalSpending`.

Enums de parentesco (`GET /financial-core/v1/members/relationship`): `ACQUAINTANCE`, `FAMILIAR`, `SPOUSE`, `PARENT`, `CHILD`, `SIBLING`, `PET`, `FRIEND`, `COWORKER`, `DEPENDENT`, `OTHERS`.

## Tela de membros

- Card por membro com total gasto.
- Painel à direita com navegação por mês, abas Gastos e Ganhos e últimas transações do membro.
- Botões "Editar" e "Apagar" no topo.

## Uso

- No formulário de transação: Vínculos → Membros → "Associar membro".
- Filtro "Membros" no Extrato.
- Ação "Membro" nas regras de transação.
