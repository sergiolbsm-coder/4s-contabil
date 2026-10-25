# 4S Contábil

Sistema de operação da 4S Contábil. Plano completo em `docs/SPRINT-0.md`.

## Sprint 1 (feito)
Auth por sessão (bcrypt + cookie httpOnly), papéis, clientes (CRUD), contatos, contratos, validade do certificado digital, auditoria.

## Rodar
1. Criar um projeto **novo** no Neon e copiar a connection string.
2. `cp .env.example .env.local` e preencher `DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
3. `npm run db:migrate && npm run db:seed && npm run dev`

## Sprint 1.5 (feito)
Menu lateral, logins de equipe e de cliente (senha provisória + troca no 1º acesso), entregas mensais (guia/demonstrativo por link do Drive) com registro de envio por e-mail, WhatsApp e visualização no portal do cliente.

E-mail usa Resend (`RESEND_API_KEY`, `EMAIL_FROM`); sem isso o resto funciona e o envio mostra aviso. `npm run db:migrate` aplica só as migrações que faltam.
