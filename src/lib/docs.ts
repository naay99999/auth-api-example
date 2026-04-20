export function shouldEnableOpenApi(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production'
}
