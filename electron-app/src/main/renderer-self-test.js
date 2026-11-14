const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { printDocument } = require('./native-print');
const { recordDiagnostic } = require('./diagnostics');

function fixturePdf() {
  const content = 'BT /F1 20 Tf 50 750 Td (ScanItPrintIt renderer self-test) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function verifyRenderer() {
  const temp = path.join(os.tmpdir(), `sip_selftest_${crypto.randomUUID()}.pdf`);
  try {
    fs.writeFileSync(temp, fixturePdf());
    await printDocument(temp, {}, null, (message, detail) => recordDiagnostic({
      stage: detail.stage, code: detail.code, level: detail.level, message, data: { ...detail, selfTest: true },
    }), { validateOnly: true });
    return { success: true };
  } catch (error) {
    recordDiagnostic({ stage: 'startup', code: 'RENDER_SELF_TEST_FAILED', level: 'error', message: error.message, data: { failedStage: error.printStage } });
    return { success: false, error: error.message };
  } finally { fs.unlink(temp, () => {}); }
}
module.exports = { verifyRenderer, fixturePdf };
