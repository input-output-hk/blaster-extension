
export function getBinaryPath(): string {
  return `bin/afv-rpc-api-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
}