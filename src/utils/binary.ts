
export function getBinaryPath(): string {
  return `bin/blaster-rpc-api-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
}