# Discovery técnico — Job Requisition (ERPNext) → People360 (`Vaga`)

**Data:** 2026-08-10  
**Autor discovery:** assistente (sessão Grok Build)  
**Escopo:** mapear DocType, workflow e API no ambiente de **dev** BHCL; **não** implementar sync no People.  
**Produção (referência, não usada para testes destrutivos):** `https://sistema.ossbhcl.org.br/app/job-requisition`

---

## 1. Resumo executivo

1. O DocType oficial é **`Job Requisition`** (módulo HR / HRMS). No Desk em pt-BR aparece como “Requisição de Pessoal”.
2. Naming series real (Property Setter BHCL): **`RP-.YYYY.-`** → documentos como `RP-2026-00117` (bate com `requisicaoNextId` no People).
3. Há **Workflow ativo**: **`Requisição de Pessoal - Fluxo Padrao`**, campo `workflow_state`.
4. Estados de workflow: **`Pending` → Approve → `Approved`** | **`Pending` → Reject → `Rejected`** | **`Rejected` → Reaberto → `Pending`**.
5. O workflow **atualiza o campo `status`** automaticamente: Pending / **Open & Approved** / Rejected.
6. Aprovação via API **validada**: `POST /api/method/frappe.model.workflow.apply_workflow` com `action: "Approve"` ou `"Reject"` (nomes em **inglês**).
7. **Não** cria Job Opening automaticamente na aprovação; `Job Opening.job_requisition` existe e é preenchido **depois**, em outro passo operacional.
8. Custom BHCL relevantes: `custom_motivo_da_requisicao`, `custom_turno`, `custom_colaboradores_substituidos`, `custom_aprovado_por`, `custom_horario_aprovacao`.
9. No snapshot do dev **não havia JR com `status=Pending`** (fila zerada); total ~131 docs (maioria já aprovada/preenchida/rejeitada).
10. Integração v1 recomendada: **polling** de `status=Pending` (+ `workflow_state=Pending`), idempotência por `name` → `requisicaoNextId`, write-back com `apply_workflow` + `Comment` para motivo de rejeição.

---

## 2. Ambiente

| Item | Valor |
|------|--------|
| **URL base usada** | `http://69.62.97.9:8081` |
| **Identidade do ambiente** | Dokploy **`gregory-dev`** / site bench `frontend` (backup/restore de homolog) |
| **Outros hosts** | Homolog tipicamente `sys-dev` / `sys-homolog.ossbhcl.org.br`; prod `https://sistema.ossbhcl.org.br` |
| **Auth usada no discovery** | Sessão `Administrator` (cookie via `/api/method/login`) |
| **Idioma / TZ** | `pt-BR` / `America/Sao_Paulo` |

### Versões (`frappe.utils.change_log.get_versions`)

| App | Versão |
|-----|--------|
| frappe | **15.113.4** |
| erpnext | **15.115.0** |
| hrms | **15.62.1** |
| integracoes_customizadas | 1.1.3 |
| rh_brasil | 0.3.1 |
| busca_cnpj | 1.1.0 |
| bhcl_theme | 0.1.0 |
| contratos | 0.1.0 |
| managepulse | 0.4.0 |
| gestao_contratos | 0.3.0 |

### DocType real

| Propriedade | Valor |
|-------------|--------|
| name | `Job Requisition` |
| module | `HR` |
| custom | `0` (padrão HRMS + custom fields) |
| is_submittable | **0** (não usa submit/cancel de docstatus) |
| track_changes | **0** |
| autoname | `naming_series:` |
| title_field | `designation` |
| Form Desk | `/app/job-requisition/{name}` |

### Naming series (efetivo no site)

| Origem | Valor |
|--------|--------|
| DocType JSON (HRMS) | `HR-HIREQ-` |
| **Property Setter BHCL** | **`RP-.YYYY.-`** (default, hidden, read_only) |
| Exemplos reais | `RP-2026-00117`, `RP-2025-00019` |
| Contador observado | últimos criados no discovery: `RP-2026-00119`, `RP-2026-00120` |

### Distribuição de dados no momento do discovery (n=131)

| status | qtd |
|--------|-----|
| Open & Approved | 65 |
| Filled | 46 |
| Rejected | 20 |
| **Pending** | **0** |

| workflow_state | qtd |
|----------------|-----|
| Approved | 90 |
| Pending | 21 |
| Rejected | 20 |

**Inconsistência legada:** 21 docs com `workflow_state=Pending` mas `status=Filled` (históricos).  
**Filtro correto para fila de aprovação RH:** `status = "Pending"` **e** `workflow_state = "Pending"` (ou só `status=Pending`, que no fluxo normal é setado pelo workflow).

---

## 3. Campos

### 3.1 Campos padrão HRMS (meta DocType + labels Desk BHCL)

| fieldname | label Desk (PS) | fieldtype | options / fetch | reqd | read_only | hidden* | in_list_view |
|-----------|-----------------|-----------|-----------------|------|-----------|---------|--------------|
| naming_series | Naming Series | Select | **`RP-.YYYY.-`** (PS) | 0 | **1** (PS) | **1** (PS) | 0 |
| designation | **Cargo** | Link → Designation | | **1** | 0 | 0 | 1 |
| department | Department | Link → Department | | 0 | 0 | 0 | 0 |
| no_of_positions | **Qnt. de Vagas** | Int | | **1** | 0 | 0 | 1 |
| expected_compensation | **Salário previsto** | Currency | Company currency | **1** | 0 | 0 | 1 |
| company | Company | Link → Company | | **1** | 0 | 0 | 0 |
| status | Status | Select | ver §3.3 | **1** | 0 | **1** (PS) | 1 |
| requested_by | **Solicitante (ID)** | Link → Employee | | **1** | 0 | 0 | 0 |
| requested_by_name | **Solicitante (Nome)** | Data | fetch `requested_by.employee_name` | 0 | 1 | 0 | 1 |
| requested_by_dept | Department | Link → Department | fetch `requested_by.department` | 0 | 1 | 0 | 0 |
| requested_by_designation | Designation | Link → Designation | fetch `requested_by.designation` | 0 | 1 | 0 | 0 |
| posting_date | Posting Date | Date | default Today | **1** | 0 | 0 | 0 |
| completed_on | Completed On | Date | depends status=Filled | 0 | 0 | 0 | 0 |
| expected_by | **Desejável até** | Date | | 0 | 0 | 0 | 1 |
| time_to_fill | Time to Fill | Duration | | 0 | 1 | 0 | 0 |
| description | Job Description | Text Editor | fetch designation (PS: `designation.custom_descrição_detalhada_das_atividades`); **read_only=1** (PS) | **1** | **1** | 0 | 0 |
| reason_for_requesting | **Justificativa da Requisição** | Small Text (PS) | depends_on: motivo = Ampliação de Quadro | 0 | 0 | 0 | 0 |

\*hidden efetivo via Property Setter quando indicado.

Layout breaks (sem dado de negócio): `column_break_*`, `section_break_*`, `*_tab`.

### 3.2 Custom fields BHCL (`Custom Field` dt=Job Requisition)

| fieldname | label | fieldtype | options | reqd | notas |
|-----------|-------|-----------|---------|------|-------|
| workflow_state | Workflow State | Link → Workflow State | | 0 | **hidden**; controlado pelo Workflow |
| custom_turno | Turno | Select | `Diurno` / `Noturno` | 0 | após salário |
| custom_motivo_da_requisicao | Motivo da Requisicao | Select | `Reposição de Funcionário` / `Ampliação de Quadro` | 0 | |
| custom_colaboradores_substituidos | Colaboradores Substituidos | **Table MultiSelect** | child `Colaboradores Link` | 0 | quando reposição |
| custom_aprovado_por | Aprovado por | Link → User | | 0 | **quase nunca preenchido** (client script quebrado — ver §3.5) |
| custom_horario_aprovacao | Horário aprovação | Datetime | | 0 | idem |
| custom_section_break_* / custom_column_break_* | — | layout | | 0 | |

### 3.3 Child table `Colaboradores Link`

| fieldname | label | fieldtype | options | reqd |
|-----------|-------|-----------|---------|------|
| colaboradores | Colaboradores | Link | Employee | 1 |
| nome_colaborador | Nome do colaborador | Data | | 0 |

Na prática, o Link `colaboradores` às vezes guarda o **nome** do employee (quando naming do Employee = nome), não só `HR-COLAB-#####`.

### 3.4 Campo `status` (valores reais)

```
Pending
Open & Approved
Rejected
Filled
On Hold
Cancelled
```

Default (PS): `Pending`. Campo **oculto** no form (UI de status = workflow).

### 3.5 Scripts / automações no site

| Tipo | Nome | Efeito |
|------|------|--------|
| Workflow | Requisição de Pessoal - Fluxo Padrao | Estados + update de `status` |
| Client Script | Atualização do aprovador de requisições | Tenta setar `custom_aprovado_por` se action === **`Aprovado`** — **bug**: action real é **`Approve`** → campos de aprovação ficam vazios |
| Client Script | Bloqueia Requisição de Pessoal | Desabilita form se `workflow_state !== "Pendente"` — **bug**: estado real é **`Pending`** (inglês) → bloqueio pode não funcionar como esperado |
| Client Script | Libera RP duplicada | Alerta de duplicidade no form (designation + requested_by) |
| Server Script | Libera RP duplicada | `doc.validate_duplicates = lambda ...` (desliga validação HRMS de duplicata) |
| Notification | Nova RP / Requisição de Pessoal para aprovação | e-mail on New/Save |
| Webhook | Informa nova RP | `after_insert` → **ntfy** (notificação push; **não** é webhook para People) |

**HRMS controller** (`hrms.hr.doctype.job_requisition`): `validate_duplicates()` — impede 2ª JR aberta para mesmo `designation` + `requested_by` (status not in Cancelled/Closed/Filled). Mensagem de erro cita URL de homolog no template do site.

**Server Scripts no gregory-dev:** flag bench `server_script_enabled` estava **desligada** no momento do teste. Com o Server Script “Libera RP duplicada” **enabled** no DocType, **create/save de JR falha** com:

> `ServerScriptNotEnabled: Os scripts do servidor estão desativados...`

Isso é **risco de ambiente de dev**, não necessariamente de produção. Para criar JR de teste no gregory-dev foi necessário **desabilitar temporariamente** o Server Script e reabilitar ao final (registrado em §8).

### 3.6 Permissions (Custom DocPerm + DocPerm)

| Role | read | write | create | delete | notes |
|------|------|-------|--------|--------|-------|
| System Manager | 1 | 1 | 1 | 1 | full |
| HR Manager | 1 | 1 | 1 | 0 | **pode aplicar Approve/Reject** (transições allow HR Manager) |
| HR User | 1 | 1 | 1 | 0 | cria/edita em Pending; **não** tem transição de approve |
| Gerente de Unidade | 1 | 1 | 1 | 0 | criação/edição; sem transição de approve |

**Mínimo para integração People (recomendado):**

| Operação | Role mínima |
|----------|-------------|
| Listar / GET JR | `HR User` ou role dedicada com read em Job Requisition |
| Apply workflow Approve/Reject | **`HR Manager`** (ou System Manager) |
| POST Comment | permissão de write no doc ou Comment padrão do user |

### 3.7 O que o RH BHCL preenche na operação (inferido dos docs reais)

Preenchidos de forma consistente nos exemplos:

- Cargo (`designation`), Qnt. vagas, Salário previsto, Company (unidade), Solicitante, Motivo, Turno (muitas vezes), Colaborador(es) substituído(s) se reposição, Descrição (via cargo).

Pouco usados / vazios nos samples: `expected_by`, `custom_aprovado_por`, `custom_horario_aprovacao`, `reason_for_requesting` (só se ampliação).

---

## 4. Workflow

### Nome

**`Requisição de Pessoal - Fluxo Padrao`**  
- `is_active = 1`  
- `workflow_state_field = workflow_state`  
- **Não** usa docstatus (todos os estados `doc_status = 0`)

### Diagrama textual

```
                    [criar documento]
                           |
                           v
              +------------------------+
              | workflow: Pending      |
              | status: Pending        |  allow_edit: HR User
              | e-mail: mensagem sede  |
              +-----------+------------+
                    |           |
         action: Approve    action: Reject
         role: HR Manager   role: HR Manager
                    |           |
                    v           v
    +-------------------+   +------------------+
    | Approved          |   | Rejected         |
    | status:           |   | status: Rejected |
    |  Open & Approved  |   | (optional state) |
    | allow_edit:       |   | allow_edit:      |
    |  HR Manager       |   |  HR Manager      |
    +-------------------+   +--------+---------+
                                     |
                            action: Reaberto
                            role: HR Manager
                                     |
                                     v
                              (volta Pending)
```

### Tabela de transições (nomes exatos da API)

| De | Action | Para | allowed | condição |
|----|--------|------|---------|----------|
| Pending | **`Approve`** | Approved | HR Manager | (vazio) |
| Pending | **`Reject`** | Rejected | HR Manager | (vazio) |
| Rejected | **`Reaberto`** | Pending | HR Manager | (vazio) |

### O que é “aprovado” / “rejeitado” neste site

| Conceito People | ERPNext |
|-----------------|---------|
| Aprovado (vaga pode abrir processo) | `workflow_state = "Approved"` **e** `status = "Open & Approved"` |
| Rejeitado | `workflow_state = "Rejected"` **e** `status = "Rejected"` |
| Pendente de aprovação RH sede | `status = "Pending"` / `workflow_state = "Pending"` |

Workflow Comment automático observado:

- Approve → Comment type `Workflow`, content **`Aprovado`**
- Reject → content **`Rejeitado`** (sem motivo textual no workflow)

### Job Opening após aprovação?

**Não automático.**  
Campo `Job Opening.job_requisition` (Link) existe; exemplos manuais: `VAGA-2026-11470` → `RP-2026-00108`.  
Aprovar JR **não** cria Job Opening sozinho.

### Endpoint correto de approve/reject

**Usar:**

```http
POST /api/method/frappe.model.workflow.apply_workflow
```

Body JSON:

```json
{
  "doc": { /* documento Job Requisition completo (GET) */ },
  "action": "Approve"
}
```

ou `"action": "Reject"`.

**Não usar** nomes em PT (`Aprovar`, `Aprovado`, `Rejeitar`) — retorna:

> `WorkflowTransitionError: Não é uma ação válida do fluxo de trabalho`

**Update direto de `status` / `workflow_state`:** tecnicamente funciona com System Manager (testado), mas:

- não gera o Comment de Workflow padrão da mesma forma que o botão do Desk em todos os casos de UI;
- bypassa checagem de role da transição;
- **não recomendado** para v1.

Não há Server Script API custom de aprovação.

---

## 5. API playbook

### 5.1 Auth

| Método | Status no discovery |
|--------|---------------------|
| Session cookie (`POST /api/method/login` + cookie) | **Funcionou** (Administrator) |
| `Authorization: token {api_key}:{api_secret}` | **Padrão Frappe correto**; geração de keys do Administrator **falhou** neste site (`LinkValidationError` roles `Course Creator` / `Moderator` ausentes no User) |

**Usuários com `api_key` já existente (sem secret):**

| User | Nome | Observação |
|------|------|------------|
| `api-treinamento@email.com` | API Treinamento | Role **`API Colaboradores`** → só **read Employee** (insuficiente para JR) |
| `alessandro.miranda@osscesariolange.org` | Alessandro Siqueira | tem api_key |
| `alessandro.siqueira@outlook.com` | Alessandro Miranda | tem api_key |

**Para People v1:** criar user dedicado ex. `api-people360@...` com roles **`HR Manager`** (write-back) ou no mínimo **`HR User`** (só pull) + **`HR Manager`** se for aplicar workflow. Gerar API Key no form do User (Desk).

### 5.2 Listar pendentes de aprovação RH

```http
GET {BASE}/api/resource/Job%20Requisition?fields=["name","designation","department","company","status","workflow_state","no_of_positions","expected_compensation","requested_by","requested_by_name","requested_by_dept","posting_date","expected_by","custom_turno","custom_motivo_da_requisicao","modified"]&filters=[["status","=","Pending"],["workflow_state","=","Pending"]]&order_by=modified desc&limit_page_length=50
```

**Resposta no momento do discovery:** `data: []` (nenhuma pendente).

Exemplo de shape (de lista geral, anonimizado):

```json
{
  "data": [
    {
      "name": "RP-2026-00117",
      "designation": "RECEPCIONISTA",
      "status": "Open & Approved",
      "workflow_state": "Approved",
      "no_of_positions": 1,
      "requested_by_name": "B*** G***",
      "posting_date": "2026-07-06",
      "custom_motivo_da_requisicao": "Reposição de Funcionário",
      "custom_turno": "Diurno"
    }
  ]
}
```

### 5.3 GET documento completo

```http
GET {BASE}/api/resource/Job%20Requisition/RP-2026-00117
```

Campos de negócio retornados (além de auditoria `owner`/`creation`/`modified`):

`name`, `naming_series`, `designation`, `department`, `no_of_positions`, `expected_compensation`, `custom_turno`, `company`, `status`, `workflow_state`, `requested_by`, `requested_by_name`, `requested_by_dept`, `requested_by_designation`, `custom_motivo_da_requisicao`, `posting_date`, `description`, `custom_colaboradores_substituidos[]`, …

### 5.4 Aprovar (validado — doc de teste `RP-2026-00119`)

```http
POST {BASE}/api/method/frappe.model.workflow.apply_workflow
Content-Type: application/json
Cookie: sid=***   # ou Authorization: token key:secret

{
  "doc": { /* objeto retornado pelo GET */ },
  "action": "Approve"
}
```

**Resultado:**

| Campo | Antes | Depois |
|-------|-------|--------|
| workflow_state | Pending | **Approved** |
| status | Pending | **Open & Approved** |

Comment Workflow: `"Aprovado"`.

### 5.5 Rejeitar (validado — doc de teste `RP-2026-00120`)

```json
{ "doc": { ... }, "action": "Reject" }
```

**Resultado:** `workflow_state=Rejected`, `status=Rejected`.

### 5.6 Motivo de rejeição / comentários

Não há campo dedicado “motivo da rejeição” no DocType.

**Padrão recomendado:**

```http
POST {BASE}/api/resource/Comment
Content-Type: application/json

{
  "comment_type": "Comment",
  "reference_doctype": "Job Requisition",
  "reference_name": "RP-2026-00120",
  "content": "Motivo da rejeição: ..."
}
```

Validado: Comment `tgrldagbdq` criado com sucesso.

Opcional: espelhar também em `reason_for_requesting` (semântica diferente — justificativa de **ampliação**, não de rejeição).

### 5.7 cURL templates (placeholders)

```bash
BASE="http://69.62.97.9:8081"   # ou URL canônica do ambiente alvo
# Auth: preferir token de user de integração
AUTH="Authorization: token API_KEY:***"

# 1) List pending
curl -sS -H "$AUTH" \
  "$BASE/api/resource/Job%20Requisition?fields=%5B%22name%22%2C%22designation%22%2C%22status%22%2C%22workflow_state%22%2C%22modified%22%5D&filters=%5B%5B%22status%22%2C%22%3D%22%2C%22Pending%22%5D%5D&limit_page_length=50"

# 2) Get one
curl -sS -H "$AUTH" "$BASE/api/resource/Job%20Requisition/RP-2026-00117"

# 3) Approve
DOC=$(curl -sS -H "$AUTH" "$BASE/api/resource/Job%20Requisition/RP-XXXX")
# extrair .data e montar:
curl -sS -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"doc":{...},"action":"Approve"}' \
  "$BASE/api/method/frappe.model.workflow.apply_workflow"

# 4) Reject + comment
curl -sS -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"doc":{...},"action":"Reject"}' \
  "$BASE/api/method/frappe.model.workflow.apply_workflow"

curl -sS -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"comment_type":"Comment","reference_doctype":"Job Requisition","reference_name":"RP-XXXX","content":"Motivo: ..."}' \
  "$BASE/api/resource/Comment"
```

### 5.8 Erros úteis capturados

| Situação | HTTP / tipo | Mensagem |
|----------|-------------|----------|
| Action PT `Aprovar` | 417 / WorkflowTransitionError | Não é uma ação válida do fluxo de trabalho |
| Create com Server Script enabled + scripts off | 403 / ServerScriptNotEnabled | Os scripts do servidor estão desativados… |
| Duplicata designation+requested_by aberta | 417 / ValidationError | Uma Requisição de Pessoal para **X** solicitada por **Y** já existe: RP-… |
| generate_keys Administrator | 417 / LinkValidationError | Função Course Creator / Moderator não encontrada |

---

## 6. Mapa ERPNext → People `Vaga`

Legenda: **1:1** | **derivado** | **sem equivalente** | **custom BHCL sem campo People**

| ERPNext fieldname | Tipo ERP | People `Vaga` | Tipo map | Notas / transformação |
|-------------------|----------|---------------|----------|------------------------|
| `name` | Data | `requisicaoNextId` | **1:1** | Chave de idempotência (`RP-2026-#####`). Unique no People recomendado. |
| `designation` | Link | `cargo` + `cargoId` | **derivado** | `cargo` = nome Designation; `cargoId` = lookup `Position` no People (alias/nome). |
| `no_of_positions` | Int | `quantidade` | **1:1** | |
| `expected_compensation` | Currency | `salarioMin` (e opcionalmente `salarioMax`) | **1:1** / parcial | JR tem um valor único; People tem min/max. Sugerir min=max=valor ou só min. |
| `company` | Link | `unidadeId` | **derivado** | Mapear Company ERP ↔ Unit People (tabela de de-para). Company exemplo: `UPA CENTRO - Beneficência…` |
| `department` | Link | `setor` | **1:1** (texto) | Ex.: `ADM - Administrativo - UPA Centro` |
| `requested_by_name` | Data | `gestorRequisitante` | **1:1** | Nome do solicitante |
| `requested_by_dept` | Link | `setorRequisitante` | **1:1** (texto) | |
| `custom_motivo_da_requisicao` | Select | `tipoRequisicao` | **derivado** | `Reposição de Funcionário` → `SUBSTITUICAO`; `Ampliação de Quadro` → `AUMENTO_QUADRO` |
| `custom_turno` | Select | `periodoTrabalho` | **derivado** | `Diurno`→`DIURNO`; `Noturno`→`NOTURNO` |
| `custom_colaboradores_substituidos[].nome_colaborador` | child | `nomeColaboradorSaiu` | **derivado** | Concatenar se múltiplos; 1º nome se só um |
| `posting_date` | Date | `dataAbertura` | **1:1** | |
| `expected_by` | Date | `dataPrevistaFechamento` | **1:1** | frequentemente vazio |
| `description` | Text Editor (HTML) | `observacoes` (parcial) | **derivado** | Strip HTML; ou manter só no ERP e não poluir observações |
| `reason_for_requesting` | Text | `observacoes` (append) | **derivado** | Só ampliação de quadro |
| `status` + `workflow_state` | Select | `status` | **derivado** | Pending→`PENDENTE_APROVACAO`; Rejected→`REJEITADA`; Open & Approved→`ABERTA` (após approve no People) |
| `modified` | Datetime | (controle sync) | — | cursor de polling |
| — | | `titulo` | **derivado** | Ex. `{designation} - {company abbr}` ou `{name} · {designation}` |
| — | | `tipoVaga` | **sem equivalente** | Default `EFETIVO`; Designation tem `custom_forma_de_contratação` (ex. CLT) — não mapeia 1:1 para enum People |
| — | | `tipoContrato` | **sem equivalente** | Não existe na JR |
| — | | `tipoRecrutamento` | **sem equivalente** | Não existe na JR |
| — | | `cargaHoraria` / `horarioTrabalho` / `escala` | **sem equivalente** | Não existem na JR |
| — | | `municipio` | **derivado** fraco | Inferir da Unit/Company se cadastrado no People |
| — | | `vagaPcd` | **sem equivalente** | Não está na JR (às vezes no Job Opening title) |
| — | | `disponibilidadeHorario` | **sem equivalente** | |
| `custom_aprovado_por` | Link User | — | **custom BHCL s/ People** | hoje vazio na prática |
| `custom_horario_aprovacao` | Datetime | — | **custom BHCL s/ People** | idem |
| `completed_on` / `time_to_fill` | Date/Duration | — | **sem equivalente** (pós-processo) | ciclo de vida ERP após abertura |
| `naming_series` | Select | — | ignorar | sempre `RP-.YYYY.-` |

### Designation (lookup auxiliar)

Custom fields úteis no cargo (não na JR):

- `custom_descrição_detalhada_das_atividades` → já flui para `description` da JR  
- `custom_cbo`, `custom_forma_de_contratação`, `custom_área`, etc. — candidatos a evolução People/Position

### Companies no site (14) — base para de-para de unidade

ALPHAVILLE, HMCA, MATRIZ, MOGI, PA MARIA DIRCE, PSI RENÉ APRÍGIO, TABOÃO, UPA AKIRA, UPA CENTRO, UPA CONCEIÇÃO, UPA CUMBICA, UPA MENCK, UPA SÃO JOÃO, UPAS GUARULHOS (nomes oficiais com sufixo “Beneficência Hospitalar de Cesário Lange”).

---

## 7. Recomendação de implementação v1

### 7.1 Escopo

1. **Pull:** importar JR `status=Pending` → criar/atualizar `Vaga` com `status=PENDENTE_APROVACAO` e `requisicaoNextId=name`.
2. **UI:** manter fluxo atual People (`APROVAR` / `REJEITAR` / `SOLICITAR_INFO`).
3. **Write-back:** no `POST /api/vagas/[id]/aprovacao` quando `requisicaoNextId` preenchido:
   - APROVAR → `apply_workflow` action **`Approve`**
   - REJEITAR → `apply_workflow` action **`Reject`** + `Comment` com mensagem

`SOLICITAR_INFO` **não** tem estado no ERP — ficar só no People (comentários internos).

### 7.2 Sync rules

| Tema | Recomendação |
|------|----------------|
| O que importar | v1: só **Pending**. Opcional v1.1: também Open & Approved sem Vaga (backfill). |
| Polling | Cron 1–5 min; filtro `modified > last_sync` **ou** sempre listar Pending (volume baixo). |
| Webhook ERP→People | **Não há** webhook útil para People hoje (só ntfy). Criar Webhook Frappe `after_insert`/`on_update` no ERP seria v2. |
| Idempotência | `Vaga.requisicaoNextId` unique = `Job Requisition.name`. Upsert por esse campo. |
| Cursor | Persistir `lastModified` / `lastName` no People (settings). |
| Conflitos | Se Vaga já `ABERTA` e ERP ainda Pending → não rebaixar; se ERP Rejected e People pendente → alinhar. |

### 7.3 Sequência write-back (Approve)

```
1. GET /api/resource/Job%20Requisition/{requisicaoNextId}
2. Assert workflow_state == "Pending" (senão log + skip/erro amigável)
3. POST apply_workflow { doc, action: "Approve" }
4. (opcional) PUT campos custom_aprovado_por / custom_horario_aprovacao
5. Atualizar Vaga local: status ABERTA + histórico
```

### 7.4 Sequência write-back (Reject)

```
1. GET doc
2. Assert Pending
3. POST apply_workflow { doc, action: "Reject" }
4. POST Comment com motivo (mensagem obrigatória no People)
5. Vaga local: REJEITADA
```

### 7.5 Preferência polling vs webhook (v1)

| | Polling | Webhook |
|--|---------|---------|
| v1 | **Preferido** — simples, sem abrir People na internet para o ERP | exige endpoint autenticado no People + Webhook DocType no ERP |
| Já existe | — | Webhook “Informa nova RP” → ntfy apenas |
| Risco | atraso 1–5 min | rede, retries, auth |

**Decisão sugerida:** polling v1 (espelhar padrão `trainingApi.ts` com env `ERPNEXT_BASE_URL` + `ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET`).

### 7.6 Riscos

| Risco | Mitigação |
|-------|-----------|
| Role sem HR Manager no apply_workflow | User integração com HR Manager |
| Server Scripts disabled no dev | validar `server_script_enabled` no ambiente alvo antes de go-live |
| Duplicata HRMS validate | não recriar JR; People só consome |
| Client scripts PT vs EN | não depender de custom_aprovado_por |
| Salário sensível | não logar `expected_compensation` em plain text no People audit se política exigir |
| Fila Pending=0 no restore | testar criando JR de homolog/dev |
| Status Filled + workflow Pending legado | filtrar por `status=Pending` |
| Token Administrator quebrado | user limpo só com roles necessários |
| Job Opening / processo seletivo | **fora** da v1 de aprovação |

### 7.7 Env sugerido (People)

```env
ERPNEXT_BASE_URL=https://sistema.ossbhcl.org.br   # ou dev
ERPNEXT_API_KEY=***
ERPNEXT_API_SECRET=***
ERPNEXT_JR_SYNC_ENABLED=true
```

Padrão de client: análogo a `src/lib/trainingApi.ts` (mas header `Authorization: token …` em vez de `x-api-key`).

---

## 8. Pendências / o que não conseguiu validar

| Item | Status |
|------|--------|
| Token API end-to-end com user de integração | Não: generate_keys Administrator falhou; user `api-treinamento` sem perm JR |
| Ambiente **produção** `sistema.ossbhcl.org.br` | Não testado (proposital); meta deve ser igual se imagem/apps alinhados |
| `sys-dev.ossbhcl.org.br` conteúdo JR | Host sobe (200); login/API não exercitada nesta sessão |
| 2FA / IP allowlist no gregory-dev | Não exigiu 2FA no login API; allowlist não observada do host do agente |
| Webhook outbound para People | Não existe |
| Auto Job Opening | Confirmado que **não** roda no approve |
| Preenchimento real de `custom_aprovado_por` em operação | Confirmado vazio nos samples recentes |
| Permissões role “Gerente de Unidade” em workflow | Transições só **HR Manager** — gerente **não** aprova via workflow |

### Alterações feitas no ambiente de dev (registradas)

1. Server Script **`Libera RP duplicada`**: `disabled=1` temporário → restore `disabled=0`.
2. Criados docs de teste:
   - **`RP-2026-00119`** — Approve → `Open & Approved` / `Approved` (pode apagar)
   - **`RP-2026-00120`** — Reject → Reaberto → Reject + Comment (pode apagar)
3. Tentativa falha de `generate_keys` no User Administrator (nenhuma key persistida com sucesso).

**Nenhuma alteração em produção.**

---

## 9. Anexo — JSON de exemplo (anonimizado)

### 9.1 Documento real (estrutura), dados mascarados

```json
{
  "name": "RP-2026-00117",
  "naming_series": "RP-.YYYY.-",
  "designation": "RECEPCIONISTA",
  "department": "ADM - Administrativo - UPA Centro",
  "no_of_positions": 1,
  "expected_compensation": 1855.0,
  "custom_turno": "Diurno",
  "company": "UPA CENTRO - Beneficência Hospitalar de Cesário Lange",
  "status": "Open & Approved",
  "workflow_state": "Approved",
  "requested_by": "[EMPLOYEE_NAME]",
  "requested_by_name": "[EMPLOYEE_NAME]",
  "requested_by_dept": "COAD - Coordenação Administrativa - UPA Centro",
  "requested_by_designation": "COORDENADOR ADMINISTRATIVO",
  "custom_motivo_da_requisicao": "Reposição de Funcionário",
  "posting_date": "2026-07-06",
  "expected_by": null,
  "custom_aprovado_por": null,
  "custom_horario_aprovacao": null,
  "description": "<div>...atividades do cargo (HTML)...</div>",
  "custom_colaboradores_substituidos": [
    {
      "colaboradores": "[EMPLOYEE_NAME_OR_ID]",
      "nome_colaborador": "[EMPLOYEE_NAME]",
      "parent": "RP-2026-00117",
      "parentfield": "custom_colaboradores_substituidos",
      "parenttype": "Job Requisition",
      "doctype": "Colaboradores Link"
    }
  ],
  "doctype": "Job Requisition",
  "docstatus": 0
}
```

### 9.2 Resposta apply_workflow (Approve) — teste

```json
{
  "message": {
    "name": "RP-2026-00119",
    "workflow_state": "Approved",
    "status": "Open & Approved",
    "designation": "RECEPCIONISTA",
    "no_of_positions": 1,
    "custom_turno": "Diurno",
    "custom_motivo_da_requisicao": "Ampliação de Quadro",
    "doctype": "Job Requisition"
  }
}
```

### 9.3 Links úteis

| Uso | Path |
|-----|------|
| Lista Desk | `/app/job-requisition` |
| Form | `/app/job-requisition/RP-2026-00117` |
| Job Opening ligado | `/app/job-opening/{name}` (campo `job_requisition`) |
| Workflow | Desk → Workflow → `Requisição de Pessoal - Fluxo Padrao` |

### 9.4 Dependências

| DocType | Papel na JR |
|---------|-------------|
| Designation | Cargo; descrição detalhada custom |
| Department | Setor da vaga / do solicitante |
| Employee | Solicitante + substituídos |
| Company | Unidade operacional (14 empresas) |
| Job Opening | Downstream opcional (`job_requisition`) |
| User | Aprovador (quando client script funcionar) |

### 9.5 Apps custom e impacto em Job Requisition

| App | Impacto |
|-----|---------|
| **hrms** | DocType + `validate_duplicates` |
| **Custom Field / Property Setter / Workflow** (site) | RP series, labels, workflow, customs |
| **integracoes_customizadas** | **não** altera Job Requisition (foco jurídico/provas etc.) |
| **rh_brasil** | **não** encontrado hook/DocType JR; atua em outros RH BR |
| Client/Server Scripts site | duplicidade UI, tentativa de carimbar aprovador |

---

## Checklist de criação de user API (Desk)

1. User → New → e-mail serviço `api-people360@…`
2. Roles: **HR Manager** (e se quiser separar pull-only: outro user só HR User)
3. Settings → API Access → Generate Keys  
4. Copiar **API Key** + **API Secret** uma vez → vault/env People  
5. Testar:  
   `curl -H "Authorization: token KEY:SECRET" {BASE}/api/resource/Job%20Requisition?limit_page_length=1`
6. **Não** commitar secrets; não reutilizar `api-treinamento` (escopo Employee only)

---

## Artefatos brutos desta sessão

Pasta local (não versionar secrets):  
`alessandro/_discovery_job_requisition/`  
(meta DocType, workflow JSON, samples, resultados de teste)

---

*Fim do discovery. Pronto para implementação de `erpnextClient` + sync JR → Vaga + write-back na rota de aprovação no repo `gestaorh`.*
