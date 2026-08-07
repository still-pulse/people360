-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE', 'JURIDICO');

-- CreateEnum
CREATE TYPE "ChamadoStatus" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'PENDENTE', 'RESOLVIDO', 'FECHADO');

-- CreateEnum
CREATE TYPE "ChamadoPrioridade" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoSolicitacao" AS ENUM ('BANCO_HORAS', 'FOLGA', 'AUSENCIA');

-- CreateEnum
CREATE TYPE "AprovacaoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'WAITING', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('PROCESSO_SELETIVO', 'REUNIAO', 'TREINAMENTO', 'VISITA', 'OUTRO');

-- CreateEnum
CREATE TYPE "VagaStatus" AS ENUM ('PENDENTE_APROVACAO', 'REJEITADA', 'ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO', 'ADMISSAO_EM_ANDAMENTO', 'CONTRATADA', 'FECHADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AprovacaoTipo" AS ENUM ('SOLICITACAO_INFO', 'RESPOSTA', 'APROVACAO', 'REJEICAO');

-- CreateEnum
CREATE TYPE "TipoVaga" AS ENUM ('EFETIVO', 'TEMPORARIO', 'ESTAGIO', 'PJ', 'OUTROS');

-- CreateEnum
CREATE TYPE "PeriodoTrabalho" AS ENUM ('DIURNO', 'NOTURNO', 'MISTO', 'PLANTAO');

-- CreateEnum
CREATE TYPE "TipoRequisicao" AS ENUM ('SUBSTITUICAO', 'AUMENTO_QUADRO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('DETERMINADO', 'INDETERMINADO');

-- CreateEnum
CREATE TYPE "TipoRecrutamento" AS ENUM ('INTERNO', 'EXTERNO');

-- CreateEnum
CREATE TYPE "CandidatoStatus" AS ENUM ('EM_PROCESSO', 'APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO', 'DESISTENTE', 'REPROVADO');

-- CreateEnum
CREATE TYPE "ControleCandidatoStatus" AS ENUM ('REPROVADO', 'BANCO_TALENTOS', 'CONTRATADO', 'DESISTIU');

-- CreateEnum
CREATE TYPE "DocumentoLinkStatus" AS ENUM ('ATIVO', 'EXPIRADO', 'CONCLUIDO', 'REVOGADO');

-- CreateEnum
CREATE TYPE "DocumentoItemStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'APROVADO', 'REJEITADO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ANALYST',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unitId" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#15AFA4',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "exibirIndicadores" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pauta" TEXT,
    "meetingLink" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "eventType" "EventType" NOT NULL DEFAULT 'OUTRO',
    "reminders" INTEGER[] DEFAULT ARRAY[15, 5]::INTEGER[],
    "unitId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_participants" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "calendar_event_participants_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "competencias" (
    "id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "position" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT,
    "unitId" TEXT,
    "competenciaId" TEXT,
    "chamadoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_responsibles" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "task_responsibles_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_histories" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromStatus" "TaskStatus" NOT NULL,
    "toStatus" "TaskStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pcd_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalEmployees" INTEGER NOT NULL,
    "metaPercentage" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "currentPcd" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pcd_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pcd_weekly_snapshots" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "weekDate" TIMESTAMP(3) NOT NULL,
    "totalEmployees" INTEGER NOT NULL,
    "metaPercentage" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "currentPcd" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pcd_weekly_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apprentice_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalEmployees" INTEGER NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 0,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apprentice_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnover_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "dismissals" INTEGER NOT NULL DEFAULT 0,
    "headcountStart" INTEGER NOT NULL DEFAULT 0,
    "headcountEnd" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnover_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absenteeism_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalCertificates" INTEGER NOT NULL DEFAULT 0,
    "totalDaysLost" INTEGER NOT NULL DEFAULT 0,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "workingDaysInMonth" INTEGER NOT NULL DEFAULT 22,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absenteeism_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "categoria" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_aliases" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "headcount_entries" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "headcount_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamados" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "ChamadoStatus" NOT NULL DEFAULT 'ABERTO',
    "prioridade" "ChamadoPrioridade" NOT NULL DEFAULT 'NORMAL',
    "categoria" TEXT NOT NULL DEFAULT 'Outros',
    "autorId" TEXT NOT NULL,
    "atribuidoId" TEXT,
    "unitId" TEXT,
    "resolvidoAt" TIMESTAMP(3),
    "tipoSolicitacao" "TipoSolicitacao",
    "aprovacaoStatus" "AprovacaoStatus",
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "horasSolicitadas" DOUBLE PRECISION,
    "aprovacaoJustificativa" TEXT,
    "aprovadoPorId" TEXT,
    "aprovadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chamados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamado_mensagens" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamado_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamado_anexos" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamado_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "unidadeId" TEXT,
    "municipio" TEXT,
    "cargo" TEXT NOT NULL,
    "setor" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "tipoVaga" "TipoVaga" NOT NULL DEFAULT 'EFETIVO',
    "periodoTrabalho" "PeriodoTrabalho",
    "cargaHoraria" TEXT,
    "horarioTrabalho" TEXT,
    "escala" TEXT,
    "plantaoColaboradorSaiu" TEXT,
    "salarioMin" DOUBLE PRECISION,
    "salarioMax" DOUBLE PRECISION,
    "tipoRequisicao" "TipoRequisicao",
    "tipoContrato" "TipoContrato",
    "tipoRecrutamento" "TipoRecrutamento",
    "nomeColaboradorSaiu" TEXT,
    "nomeColaborador" TEXT,
    "disponibilidadeHorario" TEXT,
    "vagaPcd" BOOLEAN NOT NULL DEFAULT false,
    "gestorRequisitante" TEXT,
    "setorRequisitante" TEXT,
    "numProcessoAdmissao" TEXT,
    "numProtocoloOnvio" TEXT,
    "requisicaoNextId" TEXT,
    "cargoId" TEXT,
    "controleCandidatoId" TEXT,
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPrevistaFechamento" TIMESTAMP(3),
    "dataFechamento" TIMESTAMP(3),
    "dataInicioIntegracao" TIMESTAMP(3),
    "status" "VagaStatus" NOT NULL DEFAULT 'ABERTA',
    "observacoes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaga_acompanhamentos" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisao" TEXT NOT NULL,
    "notas" TEXT,

    CONSTRAINT "vaga_acompanhamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatos" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "status" "CandidatoStatus" NOT NULL DEFAULT 'EM_PROCESSO',
    "observacoes" TEXT,
    "cvFileName" TEXT,
    "cvOriginalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaga_historico" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "userId" TEXT,
    "fromStatus" "VagaStatus",
    "toStatus" "VagaStatus",
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaga_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaga_aprovacao_comentarios" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "AprovacaoTipo" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaga_aprovacao_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRespondents" INTEGER NOT NULL DEFAULT 0,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nps_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "promoters" INTEGER NOT NULL DEFAULT 0,
    "neutrals" INTEGER NOT NULL DEFAULT 0,
    "detractors" INTEGER NOT NULL DEFAULT 0,
    "totalRespondents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nps_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalPayroll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring_cost_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHires" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hiring_cost_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenure_distribution_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "ate1ano" INTEGER NOT NULL DEFAULT 0,
    "de1a3" INTEGER NOT NULL DEFAULT 0,
    "de3a5" INTEGER NOT NULL DEFAULT 0,
    "de5a10" INTEGER NOT NULL DEFAULT 0,
    "acima10" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenure_distribution_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_indicators" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_units" (
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "user_units_pkey" PRIMARY KEY ("userId","unitId")
);

-- CreateTable
CREATE TABLE "pcd_evidencias" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "unitId" TEXT,
    "descricao" TEXT,
    "nomePCD" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "pcd_evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pcd_arquivos" (
    "id" TEXT NOT NULL,
    "evidenciaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "tipoDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pcd_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controle_candidatos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "funcao" TEXT NOT NULL,
    "dataProcesso" TIMESTAMP(3) NOT NULL,
    "municipio" TEXT,
    "status" "ControleCandidatoStatus" NOT NULL DEFAULT 'BANCO_TALENTOS',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controle_candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatos_month_snapshots" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "reprovado" INTEGER NOT NULL DEFAULT 0,
    "bancoTalentos" INTEGER NOT NULL DEFAULT 0,
    "contratado" INTEGER NOT NULL DEFAULT 0,
    "desistiu" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "candidatos_month_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_tipos" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "condicional" BOOLEAN NOT NULL DEFAULT false,
    "condicionalTipo" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_tipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "DocumentoLinkStatus" NOT NULL DEFAULT 'ATIVO',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "exigeConselho" BOOLEAN NOT NULL DEFAULT false,
    "temDependentes" BOOLEAN NOT NULL DEFAULT false,
    "militarAplicavel" BOOLEAN NOT NULL DEFAULT false,
    "concluidoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_link_itens" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "status" "DocumentoItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "motivoRejeicao" TEXT,
    "revisadoPorId" TEXT,
    "revisadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_link_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_arquivos" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "nomeArmazenado" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserToVaga" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ControleCandidatoToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "competencias_mes_ano_key" ON "competencias"("mes", "ano");

-- CreateIndex
CREATE INDEX "tasks_chamadoId_idx" ON "tasks"("chamadoId");

-- CreateIndex
CREATE UNIQUE INDEX "pcd_indicators_unitId_year_month_key" ON "pcd_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE INDEX "pcd_weekly_snapshots_year_month_idx" ON "pcd_weekly_snapshots"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "pcd_weekly_snapshots_unitId_weekDate_key" ON "pcd_weekly_snapshots"("unitId", "weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "apprentice_indicators_unitId_year_month_key" ON "apprentice_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "turnover_indicators_unitId_year_month_key" ON "turnover_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "absenteeism_indicators_unitId_year_month_key" ON "absenteeism_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_aliases_alias_key" ON "cargo_aliases"("alias");

-- CreateIndex
CREATE INDEX "cargo_aliases_positionId_idx" ON "cargo_aliases"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "headcount_entries_unitId_positionId_year_month_key" ON "headcount_entries"("unitId", "positionId", "year", "month");

-- CreateIndex
CREATE INDEX "chamados_autorId_idx" ON "chamados"("autorId");

-- CreateIndex
CREATE INDEX "chamados_status_idx" ON "chamados"("status");

-- CreateIndex
CREATE INDEX "chamados_tipoSolicitacao_idx" ON "chamados"("tipoSolicitacao");

-- CreateIndex
CREATE INDEX "chamados_aprovacaoStatus_idx" ON "chamados"("aprovacaoStatus");

-- CreateIndex
CREATE INDEX "chamado_mensagens_chamadoId_idx" ON "chamado_mensagens"("chamadoId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "vagas_controleCandidatoId_key" ON "vagas"("controleCandidatoId");

-- CreateIndex
CREATE INDEX "vagas_cargoId_idx" ON "vagas"("cargoId");

-- CreateIndex
CREATE INDEX "vaga_acompanhamentos_vagaId_idx" ON "vaga_acompanhamentos"("vagaId");

-- CreateIndex
CREATE INDEX "vaga_aprovacao_comentarios_vagaId_idx" ON "vaga_aprovacao_comentarios"("vagaId");

-- CreateIndex
CREATE UNIQUE INDEX "engagement_indicators_unitId_year_month_key" ON "engagement_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "nps_indicators_unitId_year_month_key" ON "nps_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_indicators_unitId_year_month_key" ON "payroll_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_cost_indicators_unitId_year_month_key" ON "hiring_cost_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "tenure_distribution_indicators_unitId_year_month_key" ON "tenure_distribution_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "training_indicators_unitId_year_month_key" ON "training_indicators"("unitId", "year", "month");

-- CreateIndex
CREATE INDEX "pcd_evidencias_categoria_year_month_idx" ON "pcd_evidencias"("categoria", "year", "month");

-- CreateIndex
CREATE INDEX "controle_candidatos_status_idx" ON "controle_candidatos"("status");

-- CreateIndex
CREATE INDEX "controle_candidatos_dataProcesso_idx" ON "controle_candidatos"("dataProcesso");

-- CreateIndex
CREATE UNIQUE INDEX "candidatos_month_snapshots_year_month_key" ON "candidatos_month_snapshots"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "documento_tipos_chave_key" ON "documento_tipos"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "documento_links_token_key" ON "documento_links"("token");

-- CreateIndex
CREATE INDEX "documento_links_candidatoId_idx" ON "documento_links"("candidatoId");

-- CreateIndex
CREATE UNIQUE INDEX "documento_link_itens_linkId_tipoId_key" ON "documento_link_itens"("linkId", "tipoId");

-- CreateIndex
CREATE UNIQUE INDEX "_UserToVaga_AB_unique" ON "_UserToVaga"("A", "B");

-- CreateIndex
CREATE INDEX "_UserToVaga_B_index" ON "_UserToVaga"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ControleCandidatoToUser_AB_unique" ON "_ControleCandidatoToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_ControleCandidatoToUser_B_index" ON "_ControleCandidatoToUser"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_participants" ADD CONSTRAINT "calendar_event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "competencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "chamados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_responsibles" ADD CONSTRAINT "task_responsibles_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_responsibles" ADD CONSTRAINT "task_responsibles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_histories" ADD CONSTRAINT "task_histories_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_histories" ADD CONSTRAINT "task_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pcd_indicators" ADD CONSTRAINT "pcd_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pcd_weekly_snapshots" ADD CONSTRAINT "pcd_weekly_snapshots_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apprentice_indicators" ADD CONSTRAINT "apprentice_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnover_indicators" ADD CONSTRAINT "turnover_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absenteeism_indicators" ADD CONSTRAINT "absenteeism_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_aliases" ADD CONSTRAINT "cargo_aliases_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "headcount_entries" ADD CONSTRAINT "headcount_entries_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "headcount_entries" ADD CONSTRAINT "headcount_entries_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_atribuidoId_fkey" FOREIGN KEY ("atribuidoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamado_mensagens" ADD CONSTRAINT "chamado_mensagens_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamado_mensagens" ADD CONSTRAINT "chamado_mensagens_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamado_anexos" ADD CONSTRAINT "chamado_anexos_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "chamado_mensagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_controleCandidatoId_fkey" FOREIGN KEY ("controleCandidatoId") REFERENCES "controle_candidatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_acompanhamentos" ADD CONSTRAINT "vaga_acompanhamentos_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_acompanhamentos" ADD CONSTRAINT "vaga_acompanhamentos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_historico" ADD CONSTRAINT "vaga_historico_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_historico" ADD CONSTRAINT "vaga_historico_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_aprovacao_comentarios" ADD CONSTRAINT "vaga_aprovacao_comentarios_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaga_aprovacao_comentarios" ADD CONSTRAINT "vaga_aprovacao_comentarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_indicators" ADD CONSTRAINT "engagement_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nps_indicators" ADD CONSTRAINT "nps_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_indicators" ADD CONSTRAINT "payroll_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring_cost_indicators" ADD CONSTRAINT "hiring_cost_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenure_distribution_indicators" ADD CONSTRAINT "tenure_distribution_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_indicators" ADD CONSTRAINT "training_indicators_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pcd_evidencias" ADD CONSTRAINT "pcd_evidencias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pcd_evidencias" ADD CONSTRAINT "pcd_evidencias_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pcd_arquivos" ADD CONSTRAINT "pcd_arquivos_evidenciaId_fkey" FOREIGN KEY ("evidenciaId") REFERENCES "pcd_evidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos_month_snapshots" ADD CONSTRAINT "candidatos_month_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_links" ADD CONSTRAINT "documento_links_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_links" ADD CONSTRAINT "documento_links_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_links" ADD CONSTRAINT "documento_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_link_itens" ADD CONSTRAINT "documento_link_itens_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "documento_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_link_itens" ADD CONSTRAINT "documento_link_itens_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "documento_tipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_link_itens" ADD CONSTRAINT "documento_link_itens_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_arquivos" ADD CONSTRAINT "documento_arquivos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "documento_link_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserToVaga" ADD CONSTRAINT "_UserToVaga_A_fkey" FOREIGN KEY ("A") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserToVaga" ADD CONSTRAINT "_UserToVaga_B_fkey" FOREIGN KEY ("B") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControleCandidatoToUser" ADD CONSTRAINT "_ControleCandidatoToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "controle_candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControleCandidatoToUser" ADD CONSTRAINT "_ControleCandidatoToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
