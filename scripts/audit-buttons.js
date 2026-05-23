#!/usr/bin/env node

/**
 * Button Consistency Audit Script
 * 
 * Tìm tất cả các button elements trong codebase và phân tích
 * xem button nào cần được migrate sang Button component
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns để tìm buttons không consistent
const PATTERNS = {
  // Button elements với className dài
  inlineButton: /<button[^>]*className="[^"]{60,}"[^>]*>/g,
  
  // Link elements styled như button
  linkAsButton: /<Link[^>]*className="[^"]*(?:px-|py-|rounded|border|bg-|hover:)[^"]{40,}"[^>]*>/g,
  
  // Anchor tags styled như button
  anchorAsButton: /<a[^>]*className="[^"]*(?:px-|py-|rounded|border|bg-|hover:)[^"]{40,}"[^>]*>/g,
};

// Files to scan
const SCAN_DIRS = [
  'app',
  'components',
];

// Files to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  'ui/button.tsx', // Exclude the Button component itself
  'ui/button.example.tsx',
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function findTsxFiles(dir) {
  const files = [];
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (shouldExclude(fullPath)) continue;
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Check if file already imports Button component
  const hasButtonImport = /import.*Button.*from.*@\/components\/ui\/button/.test(content);
  
  // Find inline buttons
  const inlineButtons = content.match(PATTERNS.inlineButton) || [];
  if (inlineButtons.length > 0) {
    issues.push({
      type: 'inline-button',
      count: inlineButtons.length,
      samples: inlineButtons.slice(0, 2), // Show first 2 examples
    });
  }
  
  // Find links styled as buttons
  const linkButtons = content.match(PATTERNS.linkAsButton) || [];
  if (linkButtons.length > 0) {
    issues.push({
      type: 'link-as-button',
      count: linkButtons.length,
      samples: linkButtons.slice(0, 2),
    });
  }
  
  // Find anchors styled as buttons
  const anchorButtons = content.match(PATTERNS.anchorAsButton) || [];
  if (anchorButtons.length > 0) {
    issues.push({
      type: 'anchor-as-button',
      count: anchorButtons.length,
      samples: anchorButtons.slice(0, 2),
    });
  }
  
  if (issues.length === 0) return null;
  
  return {
    file: filePath,
    hasButtonImport,
    issues,
    totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0),
  };
}

function generateReport(results) {
  const totalFiles = results.length;
  const totalIssues = results.reduce((sum, r) => sum + r.totalIssues, 0);
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           BUTTON CONSISTENCY AUDIT REPORT                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Summary:`);
  console.log(`   - Files with issues: ${totalFiles}`);
  console.log(`   - Total buttons to review: ${totalIssues}\n`);
  
  // Group by priority
  const highPriority = results.filter(r => r.totalIssues >= 5);
  const mediumPriority = results.filter(r => r.totalIssues >= 2 && r.totalIssues < 5);
  const lowPriority = results.filter(r => r.totalIssues < 2);
  
  if (highPriority.length > 0) {
    console.log('\n🔴 HIGH PRIORITY (5+ buttons):');
    highPriority.forEach(result => {
      console.log(`\n   📁 ${result.file}`);
      console.log(`      Total: ${result.totalIssues} buttons`);
      console.log(`      Has Button import: ${result.hasButtonImport ? '✅' : '❌'}`);
      result.issues.forEach(issue => {
        console.log(`      - ${issue.type}: ${issue.count}`);
      });
    });
  }
  
  if (mediumPriority.length > 0) {
    console.log('\n🟡 MEDIUM PRIORITY (2-4 buttons):');
    mediumPriority.forEach(result => {
      console.log(`   📁 ${result.file} (${result.totalIssues} buttons)`);
    });
  }
  
  if (lowPriority.length > 0) {
    console.log('\n🟢 LOW PRIORITY (1 button):');
    lowPriority.forEach(result => {
      console.log(`   📁 ${result.file}`);
    });
  }
  
  console.log('\n\n💡 Recommendations:');
  console.log('   1. Start with HIGH PRIORITY files');
  console.log('   2. Import Button component: import { Button } from "@/components/ui/button"');
  console.log('   3. Replace inline buttons with <Button variant="...">');
  console.log('   4. Use asChild prop for Link components');
  console.log('   5. Refer to BUTTON_CONSISTENCY_AUDIT.md for detailed guide\n');
}

// Main execution
console.log('🔍 Scanning for inconsistent buttons...\n');

const allResults = [];

for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(dir)) continue;
  
  const files = findTsxFiles(dir);
  console.log(`   Scanning ${files.length} files in ${dir}/...`);
  
  for (const file of files) {
    const result = analyzeFile(file);
    if (result) {
      allResults.push(result);
    }
  }
}

if (allResults.length === 0) {
  console.log('\n✅ No inconsistent buttons found! All buttons are using the Button component.\n');
} else {
  generateReport(allResults);
}
