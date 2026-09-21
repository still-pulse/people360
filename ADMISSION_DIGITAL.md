# Admissão Digital BHCL

O módulo pertence ao People360 e reutiliza NextAuth, Prisma/PostgreSQL, unidades, usuários, candidatos, vagas, o shell autenticado e o armazenamento privado da aplicação.

## Rotas

| Protótipo | People360 |
| --- | --- |
| Visão geral | `/admissao-digital` |
| Admissões | `/admissao-digital/admissoes` |
| Nova admissão | `/admissao-digital/admissoes/nova` |
| Detalhes | `/admissao-digital/admissoes/:id` |
| Pendências | `/admissao-digital/pendencias` |
| Revisão | `/admissao-digital/revisao` |
| Modelos | `/admissao-digital/modelos` |
| Configurações | `/admissao-digital/configuracoes` |
| Auditoria | `/admissao-digital/auditoria` |
| Portal do candidato | `/admissao/:token` e subetapas |
| Validação pública | `/validar-documento/:token` |

O portal inclui as subetapas `dados`, `endereco`, `dados-bancarios`, `dependentes`, `vale-transporte`, `documentos`, `foto`, `validacao-facial`, `revisao`, `assinatura` e `conclusao`.

## Ambiente local

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:seed:admissao
npm run dev
```

Defina `ADMISSION_SEED_DEMO=true` antes do seed de admissão para gerar um processo demonstrativo; o comando imprime o link público aleatório. Os providers de face, assinatura, ERPNext e notificações usam `mock` por padrão. Produção exige providers reais, textos aprovados pelo Jurídico/DPO e storage privado durável.

Arquivos ficam em `storage/admissions` (fora de `public`) e só são lidos por endpoints autorizados. Tokens públicos são aleatórios; apenas SHA-256 é persistido.

## Configuração

- `ADMISSION_STORAGE_PATH`: diretório privado e persistente dos anexos.
- `ADMISSION_MAX_FILE_SIZE`: limite por arquivo em bytes (15 MB por padrão).
- `ADMISSION_RETENTION_DAYS`: parâmetro para a política de retenção da BHCL.
- `ADMISSION_DATA_PEPPER`: segredo usado na cifra de campos sensíveis e no índice de busca por CPF.
- `FACE_VERIFICATION_PROVIDER`, `SIGNATURE_PROVIDER`, `ADMISSION_ERPNEXT_PROVIDER` e `ADMISSION_NOTIFICATION_PROVIDER`: `mock` no ambiente local.
- `MOCK_FACE_RESULT`: `approve` ou `reject` para simular a validação facial.
- `VT_DECLARATION_VERSION`: versão do consentimento de vale-transporte.

Em produção, `ADMISSION_DATA_PEPPER` deve ser longo, aleatório, diferente de `NEXTAUTH_SECRET` e mantido fora do repositório.

## Verificações

```bash
npm run test:admissao
npx tsc --noEmit
npm run lint
npm run build
```

O arquivo `prisma/migrations/20260920230000_admissao_digital/rollback.sql` documenta a reversão manual. Ele remove todo o domínio de admissão e, por isso, nunca deve ser executado sem backup e janela de manutenção.

## Fluxo manual local

1. Entre com `admin@bhcl.com.br` / `admin123` ou `analista@bhcl.com.br` / `analista123`, credenciais criadas exclusivamente pelo seed local.
2. Abra `/admissao-digital/admissoes/nova`, conclua as cinco etapas e copie o link exibido uma única vez.
3. Abra o link em uma janela anônima, preencha os dados, dependentes e vale-transporte, e envie PDF/JPG/PNG.
4. Volte a `/admissao-digital/revisao`, aprove os documentos e prossiga no portal com foto, face mock, geração de PDF e assinatura mock.
5. Use a ação de ERPNext nos detalhes; acompanhe eventos em `/admissao-digital/auditoria` e valide o QR em `/validar-documento/:token`.

O teste automatizado `flow.e2e.test.ts` cobre o contrato completo dos providers e da máquina de estados. O E2E HTTP/Prisma requer PostgreSQL iniciado e a migração aplicada.
