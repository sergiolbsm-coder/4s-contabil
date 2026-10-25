# 4S Contábil

Sistema de operação da 4S Contábil. Plano completo em `docs/SPRINT-0.md`.

## Sprint 1 (feito)
Auth por sessão (bcrypt + cookie httpOnly), papéis, clientes (CRUD), contatos, contratos, validade do certificado digital, auditoria.

## Rodar
1. Criar um projeto **novo** no Neon e copiar a connection string.
2. `cp .env.example .env.local` e preencher `DATABASE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
3. `npm run db:migrate && npm run db:seed && npm run dev`
