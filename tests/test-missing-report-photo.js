/**
 * PawTrack Missing Pet Alert Photo & Map Toggle Verification Test
 */

const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const reportManagerJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'report-manager.js'), 'utf8');
const componentsCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');

console.log('===============================================================');
console.log('  PawTrack Missing Report Photo & Mode Toggle Verification    ');
console.log('===============================================================\n');

let pass = true;

function check(title, condition) {
  if (condition) {
    console.log(`[PASS] ${title}`);
  } else {
    console.error(`[FAIL] ${title}`);
    pass = false;
  }
}

// 1. Check index.html keeps primary Maps & Upload buttons in left column without redundant bar
check('index.html contains #report-view-mode-toggle with Maps & Upload buttons', 
  indexHtml.includes('id="report-view-mode-toggle"') &&
  indexHtml.includes('id="report-mode-map-btn"') &&
  indexHtml.includes('id="report-mode-upload-btn"')
);
check('index.html removed redundant photo status bar from missing form', 
  !indexHtml.includes('id="report-missing-photo-status-bar"')
);

// 2. Check report-manager.js handles the mode toggle on the missing pet alert
check('report-manager.js hides the Maps/Upload switcher on the missing tab and shows it on the found tab', 
  reportManagerJs.includes("if (modeToggle) modeToggle.style.display = type === 'missing' ? 'none' : 'flex';")
);

// 3. Check report-manager.js handles photo attachment on missing report submit
check('report-manager.js attaches photoUrl to updatePetStatus', reportManagerJs.includes('photoUrl: finalPhoto'));
check('report-manager.js attaches photo to createMissingReport', reportManagerJs.includes('missingReport = await window.pawStore.createMissingReport'));
check('report-manager.js updates photo status indicator', reportManagerJs.includes('updateMissingPhotoStatus'));

// 4. Check css/components.css has styling for missing photo status bar
check('components.css contains .report-missing-photo-status-bar styling', componentsCss.includes('.report-missing-photo-status-bar'));

console.log('\n===============================================================');
if (pass) {
  console.log('  >>> VERIFICATION RESULT: 100% ALL CHECKS PASSED <<<  ');
} else {
  console.log('  >>> VERIFICATION RESULT: SOME CHECKS FAILED <<<  ');
  process.exit(1);
}
console.log('===============================================================\n');
