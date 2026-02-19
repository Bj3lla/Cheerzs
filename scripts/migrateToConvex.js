/**
 * Script to migrate data from local files to Convex database
 * 
 * Run with: node scripts/migrateToConvex.js
 * 
 * Prerequisites:
 * - Convex dev instance running (npx convex dev)
 * - VITE_CONVEX_URL in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if dry-run mode is enabled
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

// Read .env.local file
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_CONVEX_URL\s*=\s*["']?([^"'\n]+)["']?/);
    if (match) return match[1];
  } catch (e) {
    // File doesn't exist or can't be read
  }
  return null;
}

// Helper to extract exported data from TypeScript files
function extractExport(filePath, exportName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find the export statement - match everything until end of file or next export
  const exportPattern = `export const ${exportName}`;
  const startIndex = content.indexOf(exportPattern);
  
  if (startIndex === -1) {
    throw new Error(`Could not find export ${exportName} in ${filePath}`);
  }
  
  // Find where the value starts (after the =)
  const equalsIndex = content.indexOf('=', startIndex);
  if (equalsIndex === -1) {
    throw new Error(`Malformed export for ${exportName}`);
  }
  
  // Extract until the next export or end of file
  let endIndex = content.indexOf('\nexport', equalsIndex);
  if (endIndex === -1) {
    endIndex = content.length;
  }
  
  let dataString = content.substring(equalsIndex + 1, endIndex).trim();
  
  // Remove trailing semicolon
  if (dataString.endsWith(';')) {
    dataString = dataString.slice(0, -1).trim();
  }
  
  // Simple regex-based comment removal (handles inline comments carefully)
  // Remove single-line comments at end of lines
  dataString = dataString.replace(/,(\s*)\/\/[^\n]*/g, ','); // Remove comments after commas
  dataString = dataString.replace(/([;}])(\s*)\/\/[^\n]*/g, '$1'); // Remove comments after brackets
  
  // Remove standalone comment lines
  dataString = dataString.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return '';
    return line;
  }).filter(line => line.trim() !== '').join('\n');
  
  // Remove multi-line comments
  dataString = dataString.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove TypeScript type annotations  
  dataString =  dataString
    .replace(/:\s*string/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*boolean/g, '');
  
  // Try to parse
  try {
    const parsed = new Function(`'use strict'; return (${dataString})`)();
    return parsed;
  } catch (error) {
    console.error(`\n❌ Failed to parse ${exportName} from ${path.basename(filePath)}`);
    console.error('Error:', error.message);
    console.error('\nFirst 1000 chars of cleaned data:');
    console.error(dataString.substring(0, 1000));
    console.error('\n...Last 500 chars:');
    console.error(dataString.substring(Math.max(0, dataString.length - 500)));
    throw error;
  }
}

// Helper to run Convex mutations via CLI
// Uses temp file to avoid shell escaping issues with special characters
const runConvexMutation = (functionName, args) => {
  const argsJson = JSON.stringify(args);
  
  if (isDryRun) {
    console.log(`[DRY RUN] Would call: ${functionName}`);
    console.log(`[DRY RUN] Args preview: ${JSON.stringify(args).substring(0, 200)}...`);
    if (args.questions) {
      console.log(`[DRY RUN] Question count: ${args.questions.length}`);
      console.log(`[DRY RUN] First question:`, args.questions[0]);
    } else if (args.songs) {
      console.log(`[DRY RUN] Song count: ${args.songs.length}`);
    } else if (args.wildcards) {
      console.log(`[DRY RUN] Wildcard count: ${args.wildcards.length}`);
    }
    return { inserted: args.questions?.length || args.songs?.length || args.wildcards?.length || 0 };
  }
  
  // Use temp file to avoid shell escaping issues with quotes and special chars
  const tempFile = path.join(os.tmpdir(), `convex-args-${Date.now()}.json`);
  
  try {
    fs.writeFileSync(tempFile, argsJson, 'utf-8');
    
    // Use cat to read file and pass to convex run
    // The $(...) syntax reads the file content into the command
    const result = execSync(
      `npx convex run ${functionName} "$(cat \"${tempFile}\")"`,
      { encoding: 'utf-8', cwd: path.join(__dirname, '..'), shell: '/bin/bash' }
    );
    
    return JSON.parse(result.trim());
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
};

async function migrate() {
  const convexUrl = loadEnv();
  
  if (!convexUrl) {
    console.error("❌ VITE_CONVEX_URL environment variable not set");
    console.error("Make sure you've run 'npx convex dev' and have a .env.local file");
    process.exit(1);
  }

  console.log(`🔗 Using Convex deployment: ${convexUrl}\n`);
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written');
    console.log('   Run without --dry-run to execute the migration\n');
  } else {
    console.log('🚀 Starting migration to Convex...\n');
  }

  try {
    // Extract data from TypeScript files
    const spotifyUrls = extractExport(
      path.join(__dirname, '../src/data/urls/spotifyUrls.ts'),
      'spotifyUrls'
    );
    const drinkingBuddy = extractExport(
      path.join(__dirname, '../src/data/drinkingBuddy.ts'),
      'drinkingBuddy'
    );
    const neverHaveIEver = extractExport(
      path.join(__dirname, '../src/data/neverHaveIEver.ts'),
      'neverHaveIEver'
    );
    const pointAtSomeone = extractExport(
      path.join(__dirname, '../src/data/pointAtSomeone.ts'),
      'pointAtSomeone'
    );
    const truthOrDare = extractExport(
      path.join(__dirname, '../src/data/truthOrDare.ts'),
      'truthOrDare'
    );
    const newRules = extractExport(
      path.join(__dirname, '../src/data/newRule.ts'),
      'newRules'
    );
    const wildcard = extractExport(
      path.join(__dirname, '../src/data/wildcard.ts'),
      'wildcard'
    );

    // 1. Migrate Songs
    console.log("📀 Migrating songs...");
    const songs = spotifyUrls.map((song) => ({
      id: song.id,
      url: song.url,
      title: song.title || `Song ${song.id}`,
      artists: song.artists || [],
    }));

    const songsResult = runConvexMutation('seed:seedSongs', { songs });
    console.log(`✅ Inserted ${songsResult.inserted} songs\n`);

    // 2. Migrate Truth Questions
    console.log("🎲 Migrating Truth questions...");
    const truthQuestions = truthOrDare.truth.map((q) => ({
      en: q.en,
      no: q.no,
    }));
    const truthResult = runConvexMutation('seed:seedTruth', {
      questions: truthQuestions,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${truthResult.inserted} Truth questions\n`);

    // 3. Migrate Dare Questions
    console.log("🎯 Migrating Dare questions...");
    const dareQuestions = truthOrDare.dare.map((q) => ({
      en: q.en,
      no: q.no,
    }));
    const dareResult = runConvexMutation('seed:seedDare', {
      questions: dareQuestions,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${dareResult.inserted} Dare questions\n`);

    // 4. Migrate Never Have I Ever Questions
    console.log("🙊 Migrating Never Have I Ever questions...");
    const nhieQuestions = neverHaveIEver.map((q) => ({
      en: q.en,
      no: q.no,
    }));
    const nhieResult = runConvexMutation('seed:seedNeverHaveIEver', {
      questions: nhieQuestions,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${nhieResult.inserted} Never Have I Ever questions\n`);

    // 5. Migrate Pointing Game Questions
    console.log("👉 Migrating Pointing Game questions...");
    const pointingQuestions = pointAtSomeone.map((q) => ({
      en: q.en,
      no: q.no,
    }));
    const pointingResult = runConvexMutation('seed:seedPointingGame', {
      questions: pointingQuestions,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${pointingResult.inserted} Pointing Game questions\n`);

    // 6. Migrate Drinking Buddy Questions
    console.log("🍺 Migrating Drinking Buddy questions...");
    const dbQuestions = drinkingBuddy.map((q) => ({
      en: q.en,
      no: q.no,
    }));
    const dbResult = runConvexMutation('seed:seedDrinkingBuddy', {
      questions: dbQuestions,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${dbResult.inserted} Drinking Buddy questions\n`);

    // 7. Migrate Wildcards
    console.log("🃏 Migrating wildcards...");
    const allWildcards = [
      ...wildcard.onePlayer.map((w) => ({ type: "onePlayer", en: w.en, no: w.no })),
      ...wildcard.allPlayers.map((w) => ({ type: "allPlayers", en: w.en, no: w.no })),
    ];
    const wildcardsResult = runConvexMutation('seed:seedWildcard', {
      wildcards: allWildcards,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${wildcardsResult.inserted} wildcards\n`);

    // 8. Migrate New Rules
    console.log("📜 Migrating New Rules...");
    const rules = newRules.map((r) => ({
      en: r.en,
      no: r.no,
      repelEn: r.repelEn,
      repelNo: r.repelNo,
    }));
    const rulesResult = runConvexMutation('seed:seedNewRule', {
      rules: rules,
    });
    console.log(`✅ ${isDryRun ? 'Would insert' : 'Inserted'} ${rulesResult.inserted} New Rules\n`);

    if (isDryRun) {
      console.log("✅ Dry run completed successfully! All data validated.");
      console.log("\nTo actually migrate the data, run:");
      console.log("  npm run convex:migrate");
    } else {
      console.log("🎉 Migration completed successfully!");
    }
    console.log("\nSummary:");
    console.log(`  - Songs: ${songsResult.inserted}`);
    console.log(`  - Truth: ${truthResult.inserted}`);
    console.log(`  - Dare: ${dareResult.inserted}`);
    console.log(`  - Never Have I Ever: ${nhieResult.inserted}`);
    console.log(`  - Pointing Game: ${pointingResult.inserted}`);
    console.log(`  - Drinking Buddy: ${dbResult.inserted}`);
    console.log(`  - Wildcards: ${wildcardsResult.inserted}`);
    console.log(`  - New Rules: ${rulesResult.inserted}`);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    if (error.stderr) {
      console.error("\nError output:", error.stderr.toString());
    }
    console.error(error.stack);
    process.exit(1);
  }
}

migrate();
