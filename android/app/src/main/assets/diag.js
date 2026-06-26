// Diagnostic script - embed in the app
import { NativeModules, Platform } from 'react-native';

const diagnosticInfo = {
  platform: Platform.OS,
  timestamp: new Date().toISOString(),
  hasSMBModule: !!NativeModules.SMBModule,
  nativeModulesKeys: Object.keys(NativeModules).filter(k => 
    k.toLowerCase().includes('smb') || 
    k.toLowerCase().includes('file') ||
    k.toLowerCase().includes('share')
  ),
  totalModules: Object.keys(NativeModules).length,
};

console.log('=== NativeModules Diagnostic ===');
console.log('NativeModules.SMBModule:', NativeModules.SMBModule);
console.log('All SMB/File related modules:', diagnosticInfo.nativeModulesKeys);
console.log('Total native modules:', diagnosticInfo.totalModules);
console.log('Full NativeModules keys:', JSON.stringify(Object.keys(NativeModules).slice(0, 20)));
console.log('=== End Diagnostic ===');
