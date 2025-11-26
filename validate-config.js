#!/usr/bin/env node

import { SUPABASE_CONFIG } from './supabase.config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Validating Supabase configuration consistency...\n');

const CONFIG_URL = SUPABASE_CONFIG.url;
const CONFIG_KEY = SUPABASE_CONFIG.anonKey;

console.log(`✅ Central Config URL: ${CONFIG_URL}`);
console.log(`✅ Central Config Key: ${CONFIG_KEY.substring(0, 20)}...\n`);

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

  if (urlMatch && urlMatch[1] !== CONFIG_URL) {
    console.warn(`⚠️  .env URL mismatch: ${urlMatch[1]}`);
    console.warn(`   Should be: ${CONFIG_URL}\n`);
  } else {
    console.log(`✅ .env URL matches central config`);
  }

  if (keyMatch && keyMatch[1] !== CONFIG_KEY) {
    console.warn(`⚠️  .env Key mismatch`);
    console.warn(`   Should match central config\n`);
  } else {
    console.log(`✅ .env Key matches central config`);
  }
}

const extensionConfigPath = path.join(__dirname, 'extension', 'supabase.config.js');
if (fs.existsSync(extensionConfigPath)) {
  const extensionConfigContent = fs.readFileSync(extensionConfigPath, 'utf8');
  const urlMatch = extensionConfigContent.match(/url:\s*'([^']+)'/);
  const keyMatch = extensionConfigContent.match(/anonKey:\s*'([^']+)'/);

  if (urlMatch && urlMatch[1] !== CONFIG_URL) {
    console.error(`❌ extension/supabase.config.js URL mismatch: ${urlMatch[1]}`);
    console.error(`   Should be: ${CONFIG_URL}\n`);
    process.exit(1);
  } else {
    console.log(`✅ extension/supabase.config.js URL matches`);
  }

  if (keyMatch && keyMatch[1] !== CONFIG_KEY) {
    console.error(`❌ extension/supabase.config.js Key mismatch`);
    console.error(`   Should match central config\n`);
    process.exit(1);
  } else {
    console.log(`✅ extension/supabase.config.js Key matches`);
  }
}

const filesToCheck = [
  'extension/popup.js',
  'extension/background.js',
  'extension/content.js'
];

let hasHardcodedCredentials = false;

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');

  if (content.match(/const\s+\w+\s*=\s*'https:\/\/\w+\.supabase\.co'/)) {
    console.error(`❌ ${file} contains hardcoded Supabase URL`);
    hasHardcodedCredentials = true;
  }

  if (content.match(/const\s+anonKey\s*=\s*'eyJ[^']+'/)) {
    console.error(`❌ ${file} contains hardcoded anon key`);
    hasHardcodedCredentials = true;
  }
}

if (!hasHardcodedCredentials) {
  console.log(`\n✅ No hardcoded credentials found in extension files`);
}

console.log('\n✨ All Supabase configurations are consistent!\n');
console.log('📝 To change Supabase instance:');
console.log('   1. Edit supabase.config.js');
console.log('   2. Copy to extension/supabase.config.js');
console.log('   3. Run: npm run validate-config');
console.log('   4. Reload extension in browser\n');

if (hasHardcodedCredentials) {
  process.exit(1);
}
