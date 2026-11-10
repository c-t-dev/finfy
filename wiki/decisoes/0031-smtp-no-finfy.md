# 0031 — Envio SMTP no Finfy

> Status: Aceita · Última atualização: 2026-11-10

O backend web usa Nodemailer para entregar os e-mails de autenticação via SMTP, com TLS. Ele reaproveita o banco e a tabela `email_outbox`. A requisição que pede verificação aciona o processamento das mensagens pendentes daquele destinatário depois de responder. Uma nova solicitação pode processar uma mensagem pendente. SMTP pode duplicar um envio se a confirmação se perder, mesmo com `Message-ID` estável.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` como variáveis do servidor. A porta 465 usa TLS implícito. A porta padrão 587 exige STARTTLS. Teste o envio em ambiente de teste antes de definir `EMAIL_DELIVERY_ENABLED=true` em produção. Essa opção também ativa a verificação de e-mail. Convites de wallet continuam por link privado.
