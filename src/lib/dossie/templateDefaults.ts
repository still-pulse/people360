// Textos institucionais PADRÃO dos documentos do dossiê. São gravados em `DocumentTemplate`
// (chaves `colab_*`) na primeira utilização; depois disso o banco é a fonte da verdade e o
// texto pode ser versionado sem alterar código. Nenhum componente React contém texto contratual.
//
// Marcação: `# Título` (título do documento), `## Seção`, `- item`, linha em branco separa
// parágrafos, `{{variavel}}` é substituída pelos dados, `[[tabela:nome]]` insere uma tabela.

export type TemplateDefault = { key: string; name: string; content: string }

const RODAPE_ASSINATURA = `{{localData}}.`

export const TEMPLATE_DEFAULTS: TemplateDefault[] = [
  {
    key: 'colab_contrato_experiencia',
    name: 'Contrato de Experiência',
    content: `# CONTRATO INDIVIDUAL DE TRABALHO — CONTRATO DE EXPERIÊNCIA

Pelo presente instrumento particular, {{empregadorNome}}, inscrita no CNPJ sob nº {{empregadorCnpj}}, com sede em {{empregadorEndereco}}, doravante denominada EMPREGADORA, e {{nome}}, portador(a) do CPF nº {{cpf}}, RG nº {{rg}}, PIS/PASEP nº {{pis}}, CTPS nº {{ctpsNumero}}, série {{ctpsSerie}}/{{ctpsUf}}, residente e domiciliado(a) em {{enderecoCompleto}}, doravante denominado(a) EMPREGADO(A), firmam o presente contrato de trabalho por prazo determinado, em caráter de experiência, nos termos do artigo 443, § 2º, alínea "c", da Consolidação das Leis do Trabalho (CLT), mediante as cláusulas seguintes:

## CLÁUSULA 1ª — DA FUNÇÃO
O(A) EMPREGADO(A) trabalhará para a EMPREGADORA na função de {{funcao}}, no setor {{setor}}, executando também as atividades compatíveis com a sua condição pessoal e determinadas pela EMPREGADORA.

## CLÁUSULA 2ª — DO LOCAL DE TRABALHO
O local principal de trabalho será a unidade {{unidade}}. A transferência temporária ou definitiva observará as hipóteses e condições previstas na legislação trabalhista vigente.

## CLÁUSULA 3ª — DA JORNADA
Jornada de trabalho: {{jornada}}. Escala: {{escala}}. Horário: {{horario}}. O horário poderá ser alterado pela EMPREGADORA, respeitados os limites legais, e as horas excedentes serão compensadas na forma da lei ou de acordo individual firmado em separado.

## CLÁUSULA 4ª — DA REMUNERAÇÃO
O(A) EMPREGADO(A) receberá salário mensal de {{salario}}, pago mediante depósito em conta bancária de sua titularidade.

## CLÁUSULA 5ª — DO PRAZO
O presente contrato vigorará pelo prazo de {{prazoTotalDias}} dias, com início em {{dataInicio}} e término em {{dataFinal}}. O primeiro período de experiência é de {{primeiroPeriodoDias}} dias, encerrando-se em {{fimPrimeiroPeriodo}}. {{clausulaProrrogacao}}

## CLÁUSULA 6ª — DOS DESCONTOS
Além dos descontos previstos em lei, o(a) EMPREGADO(A) autoriza o desconto das importâncias correspondentes a danos que vier a causar, quando presentes os requisitos do artigo 462, § 1º, da CLT.

## CLÁUSULA 7ª — DOS UNIFORMES E EQUIPAMENTOS
O(A) EMPREGADO(A) utilizará os uniformes, ferramentas e Equipamentos de Proteção Individual (EPI) fornecidos pela EMPREGADORA exclusivamente no local e para a prestação do serviço, sendo responsável por sua guarda e conservação, devendo devolvê-los em caso de rescisão.

## CLÁUSULA 8ª — DAS NORMAS INTERNAS
O(A) EMPREGADO(A) declara ciência do regulamento interno, das normas de segurança e das ordens e instruções da EMPREGADORA, comprometendo-se a cumpri-las com dedicação e lealdade.

## CLÁUSULA 9ª — DA CONTINUIDADE
Permanecendo o(a) EMPREGADO(A) a serviço da EMPREGADORA após o término da experiência, o contrato passará a vigorar por prazo indeterminado, mantidas as cláusulas compatíveis, observada a legislação aplicável.

## CLÁUSULA 10ª — DA RESCISÃO ANTECIPADA
A rescisão antecipada observará as disposições legais aplicáveis aos contratos por prazo determinado, inclusive os artigos 479 e 480 da CLT, quando cabíveis.

E, por estarem de pleno acordo, as partes assinam o presente instrumento em duas vias de igual teor, na presença de duas testemunhas.

${RODAPE_ASSINATURA}`,
  },
  {
    key: 'colab_contrato_trabalho',
    name: 'Contrato de Trabalho por Prazo Indeterminado',
    content: `# CONTRATO INDIVIDUAL DE TRABALHO — PRAZO INDETERMINADO

Pelo presente instrumento particular, {{empregadorNome}}, inscrita no CNPJ sob nº {{empregadorCnpj}}, com sede em {{empregadorEndereco}}, doravante denominada EMPREGADORA, e {{nome}}, portador(a) do CPF nº {{cpf}}, RG nº {{rg}}, PIS/PASEP nº {{pis}}, CTPS nº {{ctpsNumero}}, série {{ctpsSerie}}/{{ctpsUf}}, residente e domiciliado(a) em {{enderecoCompleto}}, doravante denominado(a) EMPREGADO(A), firmam o presente contrato individual de trabalho por prazo indeterminado, regido pela CLT e pelas cláusulas seguintes:

## CLÁUSULA 1ª — DA FUNÇÃO
O(A) EMPREGADO(A) exercerá a função de {{funcao}}, no setor {{setor}}, executando também as atividades compatíveis com a sua condição pessoal e determinadas pela EMPREGADORA.

## CLÁUSULA 2ª — DO LOCAL DE TRABALHO
O local principal de trabalho será a unidade {{unidade}}, admitida a transferência nas hipóteses e condições previstas na legislação trabalhista vigente.

## CLÁUSULA 3ª — DA JORNADA
Jornada de trabalho: {{jornada}}. Escala: {{escala}}. Horário: {{horario}}. As horas excedentes serão compensadas na forma da lei ou de acordo individual firmado em separado.

## CLÁUSULA 4ª — DA REMUNERAÇÃO
O(A) EMPREGADO(A) receberá salário mensal de {{salario}}, pago mediante depósito em conta bancária de sua titularidade.

## CLÁUSULA 5ª — DO PRAZO
Este contrato tem início em {{dataInicio}} e vigorará por prazo indeterminado, sucedendo o contrato de experiência, quando houver.

## CLÁUSULA 6ª — DOS DESCONTOS
Além dos descontos previstos em lei, o(a) EMPREGADO(A) autoriza o desconto das importâncias correspondentes a danos que vier a causar, quando presentes os requisitos do artigo 462, § 1º, da CLT.

## CLÁUSULA 7ª — DAS NORMAS INTERNAS
O(A) EMPREGADO(A) declara ciência do regulamento interno, das normas de segurança e das ordens e instruções da EMPREGADORA, comprometendo-se a cumpri-las com dedicação e lealdade, bem como a utilizar os uniformes e equipamentos de proteção fornecidos.

{{observacoes}}

E, por estarem de pleno acordo, as partes assinam o presente instrumento em duas vias de igual teor, na presença de duas testemunhas.

${RODAPE_ASSINATURA}`,
  },
  {
    key: 'colab_prorrogacao',
    name: 'Prorrogação do Contrato de Experiência',
    content: `# TERMO DE PRORROGAÇÃO DO CONTRATO DE EXPERIÊNCIA

## Dados do contrato
Colaborador: {{nome}} — Matrícula {{matricula}}
Cargo: {{cargo}}
Data de admissão: {{admissao}}
Início da experiência: {{dataInicial}}
Término do primeiro período: {{fimPrimeiroPeriodo}}
Nova data final: {{novaDataFinal}}
Dias prorrogados: {{diasProrrogados}} (prazo total de {{prazoTotalDias}} dias)

## Termo de prorrogação
Por mútuo acordo entre as partes, {{empregadorNome}}, CNPJ nº {{empregadorCnpj}}, e {{nome}}, CPF nº {{cpf}}, ficam prorrogados por {{diasProrrogados}} dias os efeitos do Contrato de Experiência firmado em {{dataInicial}}, cujo primeiro período se encerraria em {{fimPrimeiroPeriodo}}, passando o contrato a vigorar até {{novaDataFinal}}.

O prazo total do contrato, somados o período inicial e a prorrogação, não excede 90 (noventa) dias, conforme o parágrafo único do artigo 445 da CLT. As demais cláusulas do contrato permanecem inalteradas.

${RODAPE_ASSINATURA}`,
  },
  {
    key: 'colab_efetivacao',
    name: 'Efetivação do Contrato de Experiência',
    content: `# EFETIVAÇÃO DO CONTRATO DE EXPERIÊNCIA

## Identificação
Colaborador: {{nome}} — Matrícula {{matricula}}
Cargo: {{cargo}}
Unidade: {{unidade}}
Data de admissão: {{admissao}}
Data prevista para o encerramento da experiência: {{dataPrevistaEncerramento}}

## Resultado
{{resEfetivar}} Efetivar colaborador
{{resNaoEfetivar}} Não efetivar colaborador
{{resProrrogar}} Prorrogar experiência

## Justificativa / Parecer do Gestor
{{parecer}}

## Observações
{{observacoes}}

Responsável: {{responsavel}}
Data: {{data}}`,
  },
  {
    key: 'colab_aditivo',
    name: 'Aditivo de Contrato de Trabalho',
    content: `# ADITIVO DE CONTRATO DE TRABALHO

Pelo presente instrumento, {{empregadorNome}}, inscrita no CNPJ sob nº {{empregadorCnpj}}, doravante denominada EMPREGADORA, e {{nome}}, CPF nº {{cpf}}, matrícula {{matricula}}, ocupante do cargo de {{cargo}} na unidade {{unidade}}, admitido(a) em {{admissao}}, doravante denominado(a) EMPREGADO(A), resolvem, de comum acordo e por escrito, aditar o contrato individual de trabalho vigente, nos termos do artigo 468 da CLT, mediante as cláusulas seguintes:

## CLÁUSULA 1ª — DO OBJETO
Fica alterado(a) o(a) {{campoAlterado}} do(a) EMPREGADO(A), com vigência a partir de {{vigencia}}, conforme quadro abaixo.

[[tabela:aditivo]]

Motivo da alteração: {{motivo}}.

{{clausulasAdicionais}}

## CLÁUSULA FINAL — DAS DEMAIS CLÁUSULAS
As demais cláusulas do contrato de trabalho permanecem inalteradas e em pleno vigor.

E, por estarem de pleno acordo, as partes assinam o presente aditivo em duas vias de igual teor, na presença de duas testemunhas.

${RODAPE_ASSINATURA}`,
  },
  {
    key: 'colab_acordo_compensacao',
    name: 'Acordo Individual para Compensação de Horas de Trabalho',
    content: `# ACORDO INDIVIDUAL PARA COMPENSAÇÃO DE HORAS DE TRABALHO

Empregadora: {{empregadorNome}} — CNPJ {{empregadorCnpj}}
Empregado(a): {{nome}}
Matrícula: {{matricula}} · Cargo: {{cargo}} · Unidade: {{unidade}}
Jornada: {{jornada}} · Escala: {{escala}}

Pelo presente acordo para compensação de horas de trabalho, firmado entre a EMPREGADORA acima e o(a) EMPREGADO(A) abaixo assinado(a), portador(a) da CTPS nº {{ctpsNumero}}, série {{ctpsSerie}}/{{ctpsUf}}, fica convencionado, com base no que faculta o artigo 59 da Consolidação das Leis do Trabalho, que o horário de trabalho será o seguinte: {{horario}}.

Modelo de compensação: {{modelo}}.
Vigência: a partir de {{vigenciaInicio}}{{vigenciaFimTexto}}.

As horas trabalhadas além da jornada normal serão compensadas conforme o modelo acima e a jornada de trabalho semanal constante do contrato de trabalho.

{{observacoes}}

Nota: este acordo só poderá ser assinado por empregados maiores de 18 anos.

${RODAPE_ASSINATURA}`,
  },
  {
    key: 'colab_declaracao_dependentes_ir',
    name: 'Declaração de Dependentes para Fins de Imposto de Renda',
    content: `# DECLARAÇÃO DE ENCARGOS DE FAMÍLIA PARA FINS DE IMPOSTO DE RENDA

Empresa: {{empregadorNome}}
Empregado(a): {{nome}}
CPF: {{cpf}} · RG: {{rg}} · CTPS: {{ctpsNumero}}/{{ctpsSerie}}
Estado civil: {{estadoCivil}}
Endereço: {{enderecoCompleto}}

Em obediência à legislação do Imposto de Renda, informo que tenho como encargos de família as pessoas abaixo relacionadas:

[[tabela:dependentes_ir]]

Declaro, sob as penas da lei, que as informações aqui prestadas são verdadeiras e de minha inteira responsabilidade, não cabendo à empresa qualquer responsabilidade perante a fiscalização.

Esta declaração deverá ser renovada sempre que ocorrerem alterações nos dados acima.

{{localData}}.`,
  },
  {
    key: 'colab_termo_responsabilidade',
    name: 'Termo de Responsabilidade',
    content: `# TERMO DE RESPONSABILIDADE
Concessão de Salário-Família

Empresa: {{empregadorNome}}
Nome do segurado(a): {{nome}} — Matrícula {{matricula}}
CTPS ou documento de identidade: {{ctpsNumero}}/{{ctpsSerie}} · RG {{rg}}

Dependentes abrangidos:

[[tabela:dependentes_sf]]

Pelo presente TERMO DE RESPONSABILIDADE, declaro estar ciente de que deverei comunicar de imediato a ocorrência dos seguintes fatos, que determinam a perda do direito ao salário-família:
- óbito do filho;
- cessação da invalidez de filho inválido;
- sentença judicial que determine o pagamento a outrem (casos de desquite ou separação, abandono de filho ou perda do pátrio poder).

Estou ciente, ainda, de que a falta de cumprimento do compromisso ora assumido, além de me obrigar à devolução das importâncias recebidas indevidamente, sujeitar-me-á às penalidades previstas no artigo 171 do Código Penal e à rescisão do contrato de trabalho por justa causa, nos termos do artigo 482 da CLT.

{{localData}}.`,
  },
  {
    key: 'colab_ficha_salario_familia',
    name: 'Ficha de Salário-Família',
    content: `# FICHA DE SALÁRIO-FAMÍLIA

Empresa: {{empregadorNome}} — CNPJ {{empregadorCnpj}}
Colaborador(a): {{nome}} · Matrícula {{matricula}}
Data de admissão: {{admissao}} · CTPS: {{ctpsNumero}}/{{ctpsSerie}}
Valor de uma cota de salário-família: {{valorCota}}

## Dependentes
[[tabela:dependentes_sf]]

Recebi os documentos comprobatórios relacionados nesta ficha e comprometo-me a comunicar qualquer alteração que afete o direito ao benefício.

{{localData}}.`,
  },
  {
    key: 'colab_normas_ponto',
    name: 'Normas para Ocorrências de Cartão de Ponto',
    content: `# NORMAS PARA OCORRÊNCIAS DE CARTÃO DE PONTO

Você conhece seus direitos e obrigações: eles estão no manual de integração entregue no ato da sua admissão. Abaixo explicamos como funciona a correção de qualquer irregularidade que possa ocorrer no seu registro de ponto.

## 1. Situações de ocorrência de ponto
- 1.1 Ausência de registro ou falta de marcação, de qualquer natureza, seja integral ou parcial;
- 1.2 Falta justificada por ausências legais previstas no artigo 473 da CLT;
- 1.3 Prestação de serviços fora da unidade;
- 1.4 Atrasos justificados e saídas antecipadas autorizadas;
- 1.5 Troca de plantão ou folga autorizada pela gerência;
- 1.6 Folgas para abatimento de banco de horas;
- 1.7 Horas excedentes previamente autorizadas pela diretoria;
- 1.8 Esquecimento de marcação, marcação incorreta ou outras situações que façam com que o registro de ponto fique diferente do contrato de trabalho.

## 2. Justificativa
Você deverá fazer uma justificativa utilizando o formulário de ocorrência de cartão de ponto, informando:
- 2.1 Nome, matrícula, unidade e número de protocolo;
- 2.2 Data e hora da ocorrência, motivo e justificativa;
- 2.3 O que fazer, discutido com o chefe imediato, entre as alternativas: lançar para banco de horas (atrasos e faltas), servindo para abatimento de horas excedidas previamente autorizadas pela diretoria; abonar; descontar dia ou horas; cadastrar horário alternativo; trocar plantão ou folga, somente mediante prévia autorização.

## 3. Prazo de entrega
Você deverá entregar o formulário à unidade de administração de pessoal no prazo de 72 horas ou 03 (três) dias úteis, devidamente assinado por você e por sua gerência imediata.

Declaro que li e estou ciente das normas acima e que as mesmas me foram explicadas.

Colaborador(a): {{nome}} · Matrícula {{matricula}}
Cargo: {{cargo}} · Unidade: {{unidade}}
Data: {{data}}`,
  },
  {
    key: 'colab_outro_documento',
    name: 'Outro Documento',
    content: `# {{titulo}}

{{corpo}}

{{localData}}.`,
  },
]

// Modelo de avaliação do período de experiência (critérios configuráveis via DocumentTemplate).
export const AVALIACAO_MODELO_KEY = 'colab_avaliacao_criterios'
export const AUTOAVALIACAO_MODELO_KEY = 'colab_autoavaliacao_perguntas'

export const AVALIACAO_MODELO_DEFAULT = {
  escala: [
    { valor: 'EXCELENTE', rotulo: 'Excelente' },
    { valor: 'BOM', rotulo: 'Bom' },
    { valor: 'REGULAR', rotulo: 'Regular' },
    { valor: 'NECESSITA_MELHORIA', rotulo: 'Necessita melhoria' },
    { valor: 'INSATISFATORIO', rotulo: 'Insatisfatório' },
  ],
  criterios: [
    { id: 'aprender', rotulo: 'Facilidade para aprender', descricao: 'Capacidade de assimilação de novas ideias e tarefas.' },
    { id: 'qualidade', rotulo: 'Qualidade do trabalho', descricao: 'Grau de perfeição e atenção com que executa o trabalho.' },
    { id: 'produtividade', rotulo: 'Quantidade / produtividade', descricao: 'Volume de trabalho apresentado.' },
    { id: 'iniciativa', rotulo: 'Iniciativa', descricao: 'Capacidade de tomar providências por conta própria.' },
    { id: 'equipe', rotulo: 'Espírito de equipe', descricao: 'Interesse em conhecer e participar dos assuntos do setor.' },
    { id: 'relacionamento', rotulo: 'Relacionamento', descricao: 'Maneira de agir e de se relacionar.' },
    { id: 'assiduidade', rotulo: 'Assiduidade', descricao: 'Responsabilidade com a frequência ao trabalho.' },
    { id: 'pontualidade', rotulo: 'Pontualidade', descricao: 'Responsabilidade com os horários.' },
    { id: 'comunicacao', rotulo: 'Comunicação', descricao: 'Clareza e adequação na comunicação com a equipe e a liderança.' },
    { id: 'organizacao', rotulo: 'Organização', descricao: 'Organização do trabalho e dos materiais.' },
    { id: 'adaptacao', rotulo: 'Adaptação à função', descricao: 'Ajuste às atribuições e à rotina da função.' },
    { id: 'normas', rotulo: 'Cumprimento de normas', descricao: 'Observância das normas e procedimentos da instituição.' },
  ],
  periodos: [45, 90],
  decisoes: [
    { valor: 'PROSSEGUIR', rotulo: 'Prosseguir normalmente' },
    { valor: 'EFETIVAR', rotulo: 'Efetivar' },
    { valor: 'PRORROGAR', rotulo: 'Prorrogar' },
    { valor: 'NAO_EFETIVAR', rotulo: 'Não efetivar' },
  ],
}

export const AUTOAVALIACAO_MODELO_DEFAULT = {
  escalaSimNao: [
    { valor: 'SIM', rotulo: 'Sim' },
    { valor: 'PARCIALMENTE', rotulo: 'Parcialmente' },
    { valor: 'NAO', rotulo: 'Não' },
  ],
  escala: AVALIACAO_MODELO_DEFAULT.escala,
  perguntas: [
    { id: 'informacoes', rotulo: 'Recebi as informações necessárias para desempenhar meu trabalho?', tipo: 'sim_nao' },
    { id: 'materiais', rotulo: 'Possuo os materiais e equipamentos necessários?', tipo: 'sim_nao' },
    { id: 'comunicacao', rotulo: 'A comunicação com minha liderança está adequada?', tipo: 'sim_nao' },
    { id: 'integracao', rotulo: 'Como avalio minha integração com a equipe?', tipo: 'escala' },
    { id: 'adaptacao', rotulo: 'Como avalio minha adaptação às tarefas?', tipo: 'escala' },
    { id: 'dificuldades', rotulo: 'Tenho alguma dificuldade?', tipo: 'texto' },
    { id: 'melhorias', rotulo: 'Quais pontos poderiam melhorar?', tipo: 'texto' },
    { id: 'comentarios', rotulo: 'Comentários e sugestões', tipo: 'texto' },
  ],
}

export type AvaliacaoModelo = typeof AVALIACAO_MODELO_DEFAULT
export type AutoavaliacaoModelo = typeof AUTOAVALIACAO_MODELO_DEFAULT
