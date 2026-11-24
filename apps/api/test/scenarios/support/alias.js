/**
 * اختياري — لو bcrypt (native) أو Prisma client مش متبنيين على الجهاز (مثلاً بيئة CI/sandbox):
 *   NODE_OPTIONS="-r ./test/scenarios/support/alias.js"
 * - bcrypt → bcryptjs (نفس الـ API)
 * - @prisma/client → stub فاضي (الاختبارات دي مش بتلمس الـ public schema)
 */
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === 'bcrypt') {
    try { const p = orig.call(this, req, ...rest); require(p); return p; } catch { return require.resolve('bcryptjs'); }
  }
  if (req === '@prisma/client') {
    try { require(orig.call(this, req, ...rest)).PrismaClient; return orig.call(this, req, ...rest); }
    catch { return require.resolve('./prisma-stub.js'); }
  }
  return orig.call(this, req, ...rest);
};
