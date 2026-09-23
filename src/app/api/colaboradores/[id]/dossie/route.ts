import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { employeeDocumentHistory } from '@/lib/dossie/documentHistory'
import { admissionImportStatus } from '@/lib/dossie/admissaoImport'
import { dossieRoute } from '@/lib/dossie/http'
import { fmtCpf } from '@/lib/dossie/format'
import { getPerfilView, findLinkedAdmissionId } from '@/lib/dossie/perfil'
import { permissionsFor } from '@/lib/dossie/permissions'
import { buildSnapshot } from '@/lib/dossie/snapshot'
import { SELECAO } from '@/lib/dossie/dossier'

/** Visão geral do dossiê: cabeçalho, contadores e cadastro complementar. Não carrega arquivos. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador, actor }) => {
    const snapshot = await buildSnapshot(colaborador.id)
    if (!snapshot) return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 })
    const [documentos, aditivos, dependentes, avaliacoes, perfil, linked] = await Promise.all([
      employeeDocumentHistory(colaborador).then(files => files.length),
      prisma.colaboradorAditivo.count({ where: { colaboradorId: colaborador.id } }),
      prisma.colaboradorDependente.count({ where: { colaboradorId: colaborador.id, exclusaoEm: null } }),
      prisma.colaboradorAvaliacao.count({ where: { colaboradorId: colaborador.id, status: { not: 'CANCELADA' } } }),
      getPerfilView(colaborador.id),
      findLinkedAdmissionId(colaborador),
    ])
    const admissao = await admissionImportStatus(colaborador)
    return NextResponse.json({
      colaborador: {
        id: colaborador.id, nome: snapshot.nome, matricula: snapshot.matricula, cpf: fmtCpf(snapshot.cpf), cargo: snapshot.cargo, setor: snapshot.setor,
        unidade: snapshot.unidade, centroCusto: snapshot.centroCusto, admissao: snapshot.admissao, tipoContrato: snapshot.tipoContrato,
        jornada: snapshot.jornada, escala: snapshot.escala, horario: snapshot.horario, situacao: snapshot.situacao, gestor: snapshot.gestor,
        ultimaAlteracao: snapshot.ultimaAlteracao, salario: snapshot.salario, temFoto: !!(colaborador.imagePath || linked),
      },
      contadores: { documentos, aditivos, dependentes, avaliacoes },
      perfil,
      admissaoVinculada: !!linked,
      admissao: { pendentes: admissao.pendentes },
      permissoes: permissionsFor(actor.role),
      selecaoDossie: SELECAO,
    })
  })
}
