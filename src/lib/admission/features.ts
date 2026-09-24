/**
 * A validação facial fica desligada por padrão. Para reativá-la no futuro,
 * habilite explicitamente a variável no servidor e faça uma nova implantação.
 */
export function isFaceVerificationEnabled() {
  return process.env.ADMISSION_FACE_VERIFICATION_ENABLED === 'true'
}
