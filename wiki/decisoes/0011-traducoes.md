# 0011 — Traduções: inglês e português do Brasil

> Status: Aceita · Decidido em 2026-10-25 (idioma padrão e biblioteca em aberto)

## Contexto

A pessoa quer traduções desde o início, em **inglês** e **português**. Perguntada sobre qual português, escolheu **só pt-BR**.

Antes, a [0009](0009-react-tauri-capacitor.md) e a [0001](0001-multimoeda.md) citavam pt-BR, pt-PT e en. O pt-PT sai da primeira versão.

O Wallefy já tinha pt e en com `next-intl` e categorias de sistema traduzidas por chave ([referência](../referencias/wallefy.md)).

## Decisão

### Idiomas

| Código | Idioma | Situação |
| --- | --- | --- |
| `pt-BR` | Português do Brasil | Primeira versão |
| `en` | Inglês | Primeira versão |
| `pt-PT` | Português de Portugal | Depois, como variação do `pt-BR`: só as mensagens que mudam |

A lista de idiomas fica num só lugar (`packages/shared`). Incluir um idioma novo não pode exigir mudança nas telas.

### Regras

1. **Nenhum texto fixo** nas telas, na API, nos e-mails ou nas páginas públicas. Todo texto visível vem de um arquivo de mensagens, por chave.
2. **Mensagens em formato ICU**, para plurais e variáveis (ex.: "1 transação" / "3 transações").
3. **Chaves checadas pelo TypeScript.** Chave inexistente é erro de compilação. Um script no CI confere que os dois idiomas têm as mesmas chaves.
4. **O idioma não muda a moeda.** O idioma decide o formato (`Intl.NumberFormat`, `Intl.DateTimeFormat`); a moeda vem da wallet ([0001](0001-multimoeda.md)). Exemplo: em `en`, uma wallet em BRL mostra `R$1,234.56`; em `pt-BR`, mostra `R$ 1.234,56`.
5. **A API devolve códigos, não frases.** Erros e avisos vêm como código (ex.: `wallet.forbidden`), mais os dados necessários. O cliente traduz. Isso também vale para a web e para os apps nativos.
6. **Categorias de sistema** são guardadas com `translation_key` e mostradas no idioma de quem vê. Categorias criadas pelo usuário ficam como foram digitadas. As tabelas já preveem isso ([data-model.md](../finfy/data-model.md)).
7. **E-mails** no idioma do destinatário: o `language` da conta, se ele tiver conta; senão, o idioma de quem convidou ([0003](0003-convites-por-email.md)). O idioma vai gravado em `email_outbox.locale`.

### Onde o idioma é escolhido

| Parte | Como |
| --- | --- |
| Páginas públicas | **Pelo endereço**, para SEO: `/pt-br/...` e `/en/...`, com `hreflang` e metadados por idioma. A raiz `/` redireciona pelo `Accept-Language` do navegador |
| App logado (web e nativos) | Pela preferência da conta (`users.language`), alterável nas configurações. No cadastro, começa com o idioma em que a pessoa estava navegando |
| E-mails | Pelo idioma do destinatário (regra 7) |

### Biblioteca

As telas do app logado ficam em `packages/app`, sem depender do Next.js ([0010](0010-nextjs-na-vercel.md)). Por isso a recomendação é:

- **`next-intl`** no `apps/web`, para as rotas por idioma e as páginas públicas;
- **`use-intl`**, o núcleo do `next-intl` que funciona em qualquer app React, no `packages/app`.

As duas usam as mesmas mensagens ICU, então os arquivos de tradução são os mesmos para a web e para os apps nativos. Também é o que o Wallefy já usa.

Os arquivos de mensagens ficam num pacote compartilhado (ex.: `packages/shared/messages/pt-BR.json` e `en.json`), separados por área (comum, autenticação, wallets, transações, páginas públicas, e-mails).

## Diferenças

- **Minhas Economias:** só pt-BR.
- **Wallefy:** pt e en com `next-intl`. Aqui a mesma base vale também para a API (códigos de erro) e para os e-mails.

## Perguntas em aberto

- [ ] **Idioma padrão** quando o navegador não indica nenhum dos dois: `pt-BR` ou `en`?
- [ ] Confirmar `next-intl` + `use-intl` como biblioteca.
- [ ] Quem traduz: textos escritos nos dois idiomas por quem desenvolve, ou com revisão de outra pessoa antes de publicar?
- [ ] Os endereços das páginas públicas também são traduzidos (ex.: `/pt-br/precos` e `/en/pricing`) ou só o prefixo muda?
