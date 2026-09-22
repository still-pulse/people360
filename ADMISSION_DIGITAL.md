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
| Central de Ajuda | `/admissao-digital/ajuda` |
| Configurações | `/admissao-digital/configuracoes` |

## Notificações por e-mail e WhatsApp

O SMTP continua sendo configurado pelas variáveis `SMTP_*`. A Evolution API é configurada por um administrador em **Administração → Configurações → WhatsApp — Evolution API**. Informe a URL, o nome da instância e a `apikey`, salve e use **Gerar / atualizar QR Code** para conectar o aparelho. A chave é armazenada criptografada e não volta para o navegador.

Convites, links renovados, aprovação/reprovação/reenvio de documentos, nova foto de crachá e inconsistências da validação facial são enviados aos dois canais disponíveis do candidato. Falhas externas de notificação não revertem a decisão do RH.
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

## CompreFace

O provider `compreface` faz comparação facial 1:1 entre uma nova captura feita na etapa de validação e o documento `rg_frente` aprovado. A captura é processada em memória, não substitui a foto do crachá e não é persistida como outro arquivo. O provider não cadastra a pessoa em uma coleção do CompreFace e não trata o score isolado como prova de vida.

1. Crie no CompreFace uma aplicação e um serviço do tipo `VERIFICATION`.
2. Mantenha o serviço acessível somente pela rede privada dos containers.
3. Configure `COMPREFACE_URL` e a API key do serviço no `.env` do People360.
4. Defina `FACE_VERIFICATION_PROVIDER=compreface`.
5. Durante a homologação, mantenha `COMPREFACE_AUTO_APPROVE=false` e `COMPREFACE_AUTO_REJECT=false`; os resultados irão para revisão humana na aba “Foto e validação facial”.

A política de decisão usa três faixas configuradas somente no servidor:

- score maior ou igual a `COMPREFACE_APPROVE_THRESHOLD`: aprovação automática quando `COMPREFACE_AUTO_APPROVE=true`; caso contrário, revisão humana;
- score entre `COMPREFACE_REVIEW_THRESHOLD` e o limite de aprovação: revisão humana;
- score abaixo de `COMPREFACE_REVIEW_THRESHOLD`: nova captura quando `COMPREFACE_AUTO_REJECT=true`; caso contrário, revisão humana.

“Rejeitado” nesse fluxo significa apenas que uma nova foto deve ser capturada. Não reprova o candidato nem cancela a admissão. Erros do provider, rosto não detectado, MIME inadequado e arquivos acima do limite nunca recebem aprovação automática.

O documento de referência precisa ser JPG ou PNG e ter até 5 MB, limitação da API do CompreFace. PDF e resultados sem rosto detectado são encaminhados para revisão manual. Antes de ativar em produção, valide a licença comercial dos pesos do modelo escolhido, calibre os thresholds com amostras autorizadas e obtenha a aprovação do Jurídico/DPO.

## Central de Ajuda e tours

A rota `/admissao-digital/ajuda` apresenta tutoriais pesquisáveis e interativos. O primeiro acesso ao módulo oferece um tour de introdução. O progresso é versionado por usuário nas tabelas `admission_tour_progress` e `admission_tour_events`, permitindo continuar, repetir e medir abandono sem registrar dados do candidato.

Os tours usam seletores estáveis `data-admission-tour`; elementos indisponíveis para um perfil ou estado da tela são ignorados sem interromper o guia. Ao alterar substancialmente um tutorial, incremente sua `version` em `src/lib/admission/tours/catalog.ts`.
