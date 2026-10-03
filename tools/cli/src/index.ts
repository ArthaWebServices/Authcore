#!/usr/bin/env node

const command = process.argv[2];

console.log(`\n⚡ AuthCore CLI v1.0.0\n`);

switch (command) {
  case 'generate:keys': {
    import('../../scripts/generate-keys.js' as any).catch(() => {
      console.log('Run: pnpm tsx scripts/generate-keys.ts');
    });
    break;
  }
  case 'version':
  case '-v': {
    console.log('1.0.0');
    break;
  }
  case 'help':
  default: {
    console.log(`Usage: authcore <command>

Commands:
  generate:keys   Generate JWT RSA keys and encryption keys for .env
  version         Print AuthCore CLI version
  help            Print this help message
`);
    break;
  }
}
