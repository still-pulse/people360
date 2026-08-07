# API de Treinamentos — BHCL Treinamentos

Endpoints para integração com o sistema de gestão de RH. Expõe dados de horas de treinamento, participação e breakdown por unidade.

---

## Autenticação

Todas as requisições devem incluir o header:

```
x-api-key: bhcl_sk_<chave>
```

A chave é gerada no painel admin do sistema de treinamento em **Configurações → API & Integrações**. Chaves inativas ou expiradas retornam `401 Unauthorized`.

---

## Base URL

```
https://<dominio-treinamentos>/api/v1
```

---

## Endpoints

### 1. `GET /api/v1/treinamentos`

Retorna o resumo geral, breakdown por unidade e tabela de registros mensais. Alimenta:

- Card de **Treinamento e Desenvolvimento** (horas totais, média por colaborador, taxa de participação + comparativo com período anterior)
- Cards por unidade
- Tabela de **Registros** anual

#### Query Parameters

| Parâmetro   | Tipo    | Padrão       | Descrição                                    |
|-------------|---------|--------------|----------------------------------------------|
| `ano`       | integer | ano atual    | Ano de referência                            |
| `mes`       | integer | —            | Mês (1–12). Se omitido, retorna o ano todo   |
| `unidadeId` | string  | —            | Filtra por unidade específica (ID interno)   |

#### Exemplo de requisição

```http
GET /api/v1/treinamentos?ano=2026
x-api-key: bhcl_sk_...
```

```http
GET /api/v1/treinamentos?ano=2026&mes=6
x-api-key: bhcl_sk_...
```

#### Resposta `200 OK`

```json
{
  "periodo": {
    "ano": 2026,
    "mes": null
  },
  "resumo": {
    "totalHoras": 120.5,
    "totalParticipantes": 234,
    "totalColaboradores": 518,
    "mediaPorColaborador": 0.23,
    "taxaParticipacao": 45.17,
    "anterior": {
      "totalHoras": 95.0,
      "totalParticipantes": 198,
      "mediaPorColaborador": 0.18,
      "taxaParticipacao": 38.22
    }
  },
  "porUnidade": [
    {
      "id": "clx1abc123",
      "nome": "GRU - HMCA",
      "codigo": "GRU-HMCA",
      "totalHoras": 45.5,
      "participantes": 32,
      "colaboradores": 120,
      "mediaPorColaborador": 0.38,
      "taxaParticipacao": 26.67
    }
  ],
  "registros": [
    {
      "unidadeId": "clx1abc123",
      "unidade": "GRU - HMCA",
      "periodo": "Jan/2026",
      "mes": 1,
      "ano": 2026,
      "totalHoras": 20.5,
      "participantes": 15,
      "colaboradores": 120,
      "mediaPorColaborador": 0.17,
      "taxaParticipacao": 12.5
    }
  ]
}
```

#### Campos — `resumo`

| Campo                      | Tipo    | Descrição                                                        |
|----------------------------|---------|------------------------------------------------------------------|
| `totalHoras`               | float   | Soma das cargas horárias dos treinamentos concluídos no período  |
| `totalParticipantes`       | integer | Colaboradores únicos que fizeram matrícula no período            |
| `totalColaboradores`       | integer | Total de colaboradores ativos em todas as unidades               |
| `mediaPorColaborador`      | float   | `totalHoras / totalColaboradores`                                |
| `taxaParticipacao`         | float   | `(totalParticipantes / totalColaboradores) × 100` (%)           |
| `anterior`                 | object  | Mesmos campos para o período equivalente do ano anterior        |

> **Comparativo:** Quando `mes` é informado, `anterior` refere-se ao mesmo mês do ano anterior. Quando apenas `ano` é informado, `anterior` é o ano anterior completo.

#### Campos — `porUnidade[]`

| Campo                 | Tipo    | Descrição                                               |
|-----------------------|---------|---------------------------------------------------------|
| `id`                  | string  | ID da unidade                                           |
| `nome`                | string  | Nome da unidade (ex: `"GRU - HMCA"`)                   |
| `codigo`              | string  | Código curto (ex: `"GRU-HMCA"`)                        |
| `totalHoras`          | float   | Horas de treinamentos concluídos por colaboradores desta unidade |
| `participantes`       | integer | Colaboradores desta unidade que fizeram matrícula       |
| `colaboradores`       | integer | Total de colaboradores ativos na unidade                |
| `mediaPorColaborador` | float   | `totalHoras / colaboradores`                            |
| `taxaParticipacao`    | float   | `(participantes / colaboradores) × 100` (%)            |

#### Campos — `registros[]`

Breakdown mensal do ano inteiro (independente do filtro `mes`). Meses sem nenhuma atividade são omitidos.

| Campo                 | Tipo    | Descrição                                        |
|-----------------------|---------|--------------------------------------------------|
| `unidadeId`           | string  | ID da unidade                                    |
| `unidade`             | string  | Nome da unidade                                  |
| `periodo`             | string  | Label do mês, ex: `"Jan/2026"`                   |
| `mes`                 | integer | Número do mês (1–12)                             |
| `ano`                 | integer | Ano                                              |
| `totalHoras`          | float   | Horas concluídas no mês nesta unidade            |
| `participantes`       | integer | Colaboradores únicos matriculados no mês         |
| `colaboradores`       | integer | Total de colaboradores ativos na unidade         |
| `mediaPorColaborador` | float   | `totalHoras / colaboradores`                     |
| `taxaParticipacao`    | float   | `(participantes / colaboradores) × 100` (%)     |

---

### 2. `GET /api/v1/treinamentos/historico`

Retorna a série temporal mensal por unidade. Alimenta:

- Gráfico **"Horas de Treinamento — Últimos 6 meses"** (linha por unidade)
- Gráfico **"Horas Totais — Mês Atual"** (use `meses=1`)

#### Query Parameters

| Parâmetro   | Tipo    | Padrão | Descrição                                          |
|-------------|---------|--------|----------------------------------------------------|
| `meses`     | integer | `6`    | Quantidade de meses retroativos (mínimo 1, máximo 24) |
| `unidadeId` | string  | —      | Filtra por unidade específica                      |

#### Exemplo de requisição

```http
GET /api/v1/treinamentos/historico?meses=6
x-api-key: bhcl_sk_...
```

```http
GET /api/v1/treinamentos/historico?meses=1
x-api-key: bhcl_sk_...
```

#### Resposta `200 OK`

```json
{
  "meses": ["Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26"],
  "series": [
    {
      "unidadeId": "clx1abc123",
      "unidade": "GRU - HMCA",
      "dados": [12.5, 8.3, 0.0, 15.2, 4.1, 6.0]
    },
    {
      "unidadeId": "clx2def456",
      "unidade": "GRU - PA Maria Dirce",
      "dados": [0.0, 4.0, 2.5, 0.0, 8.0, 3.5]
    }
  ],
  "totais": [45.2, 38.1, 12.0, 67.5, 22.3, 18.0]
}
```

#### Campos

| Campo           | Tipo     | Descrição                                                          |
|-----------------|----------|--------------------------------------------------------------------|
| `meses`         | string[] | Labels dos meses em ordem cronológica, ex: `["Jan/26", "Fev/26"]` |
| `series`        | object[] | Uma entrada por unidade                                            |
| `series[].unidadeId` | string | ID da unidade                                               |
| `series[].unidade`   | string | Nome da unidade                                             |
| `series[].dados`     | float[]| Horas por mês, alinhado ao array `meses` (índice a índice)  |
| `totais`        | float[]  | Soma de todas as unidades por mês, alinhado ao array `meses`      |

> **Alinhamento:** `series[i].dados[j]` corresponde ao mês `meses[j]`. Meses sem conclusões retornam `0.0`.

---

## Erros

| Status | Corpo                        | Causa                            |
|--------|------------------------------|----------------------------------|
| `401`  | `{ "error": "Unauthorized" }` | Chave ausente, inválida ou expirada |
| `500`  | `{ "error": "..." }`         | Erro interno                     |

---

## Guia de implementação — Como usar cada campo

### Card "Treinamento e Desenvolvimento" (resumo mensal)

```
GET /api/v1/treinamentos?ano=2026&mes=6

resumo.totalHoras          → "Horas de Treinamento"
resumo.mediaPorColaborador → "Média de Horas por Colaborador"
resumo.taxaParticipacao    → "Taxa de Participação"

Comparativo "vs. anterior":
  delta = resumo.totalHoras - resumo.anterior.totalHoras
```

### Cards por unidade

```
GET /api/v1/treinamentos?ano=2026

porUnidade[i].nome          → título do card
porUnidade[i].totalHoras    → horas exibidas no card
```

### Gráfico "Horas de Treinamento — Últimos 6 meses"

```
GET /api/v1/treinamentos/historico?meses=6

meses            → eixo X
series[i].dados  → série de cada unidade (uma linha por unidade)
```

### Gráfico "Horas Totais — Mês Atual"

```
GET /api/v1/treinamentos/historico?meses=1

meses[0]         → label do mês atual
series[i].unidade + series[i].dados[0] → uma barra por unidade
```

### Tabela "Registros — 2026"

```
GET /api/v1/treinamentos?ano=2026

registros[i].unidade           → coluna UNIDADE
registros[i].periodo           → coluna PERÍODO
registros[i].totalHoras        → coluna TOTAL DE HORAS
registros[i].participantes     → coluna PARTICIPANTES
registros[i].colaboradores     → coluna COLABORADORES
registros[i].mediaPorColaborador → coluna MÉDIA H/COLAB.
registros[i].taxaParticipacao  → coluna TAXA PARTICIPAÇÃO
```

---

## Notas técnicas

- **Horas de treinamento** são calculadas a partir da **carga horária oficial** (`workload`, em minutos) de cada treinamento concluído — não pelo tempo real gasto pelo colaborador.
- Um treinamento é contado no período em que foi **concluído** (`completedAt`), não em que foi iniciado.
- **Participantes** são colaboradores únicos que fizeram ao menos uma **matrícula** no período (qualquer status).
- **Colaboradores** são usuários ativos na unidade no momento da consulta.
- Meses sem nenhuma atividade são omitidos no array `registros`, mas retornam `0.0` no array `dados` do histórico.
- Todos os valores `float` são arredondados a 2 casas decimais.
