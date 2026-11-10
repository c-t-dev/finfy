# 0030 — Serviço de envio de e-mail

> Status: Cancelada · Última atualização: 2026-11-10

O serviço recebe mensagens prontas e executa a entrega. O Finfy continua responsável por gerar e validar OTPs, montar os e-mails e aplicar as regras de cadastro, reenvio e convite.

## Isolamento

- Projeto separado na Vercel, com Deployment Protection em todos os ambientes.
- Trusted Sources deve autorizar apenas o projeto Finfy em produção. A API também deve validar a identidade OIDC do projeto e do ambiente antes de aceitar a mensagem.
- Banco próprio. O serviço não recebe credenciais do banco do Finfy.
- O worker é acionado por fila, sem rota pública de execução. A credencial do provedor de entrega fica no serviço.

## Contrato

O pedido de envio inclui HTML, remetente, assunto, destinatários, CC, BCC, anexos e chave de idempotência. O serviço identifica o app pela credencial e restringe remetentes e volume por app. O aceite devolve um ID após persistência durável. Para códigos de verificação, o prazo de entrega acompanha a validade do código. O corpo e os anexos ficam fora dos logs e são descartados após o processamento final.

## Provisionamento

O projeto Vercel `finfy-mail` foi criado com proteção habilitada para todos os deployments. Ainda faltam configurar Trusted Sources, provisionar o banco separado, conectar um provedor com domínio verificado e publicar o código. A entrega e a exigência de verificação dependem de validação de ponta a ponta.

## Cancelamento

O envio passa a rodar no próprio Finfy, com Nodemailer e SMTP. O projeto separado ficou sem deploy. Veja a [decisão 0031](0031-smtp-no-finfy.md).
