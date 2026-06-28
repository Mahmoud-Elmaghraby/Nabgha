!include "MUI2.nsh"
!include "LogicLib.nsh"

Unicode true

Name "نبغة"
OutFile "nabgha-setup.exe"
InstallDir "C:\Program Files\Nabgha"
RequestExecutionLevel admin

!define MUI_ICON "apps\desktop\assets\icon.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "Arabic"

Section "Install"

  ; ── Node.js ──
  IfFileExists "C:\Program Files\nodejs\node.exe" NodeFound InstallNode
  NodeFound:
    DetailPrint "Node.js موجود بالفعل — تم تخطيه ✓"
    Goto NodeDone
  InstallNode:
    DetailPrint "جاري تحميل Node.js..."
    inetc::get "https://nodejs.org/dist/v20.19.2/node-v20.19.2-x64.msi" "$TEMP\node-setup.msi" /END
    ExecWait 'msiexec /i "$TEMP\node-setup.msi" /quiet /norestart'
    DetailPrint "تم تثبيت Node.js ✓"
  NodeDone:

  ; ── PostgreSQL ──
  IfFileExists "C:\Program Files\PostgreSQL\16\bin\psql.exe" PGFound InstallPG
  PGFound:
    DetailPrint "PostgreSQL موجود بالفعل — تم تخطيه ✓"
    Goto PGDone
  InstallPG:
    DetailPrint "جاري تحميل PostgreSQL..."
    inetc::get "https://get.enterprisedb.com/postgresql/postgresql-16.9-1-windows-x64.exe" "$TEMP\pg-setup.exe" /END
    ExecWait '"$TEMP\pg-setup.exe" --mode unattended --unattendedmodeui none --superpassword nabgha123 --serverport 5432'
    DetailPrint "تم تثبيت PostgreSQL ✓"
  PGDone:

  ; ── ملفات نبغة ──
  DetailPrint "جاري نسخ ملفات نبغة..."

  SetOutPath "$INSTDIR\api"
  File "/oname=package.json" "apps\api\package.production.json"
  File "apps\api\setup-db.js"
  File "apps\api\setup-tenant.js"
  File "/oname=schema.prisma" "packages\db\prisma\schema.prisma"

  SetOutPath "$INSTDIR\api\dist"
  File /r "apps\api\dist\*.*"

  SetOutPath "$INSTDIR\web\dist"
  File /r "apps\web\dist\*.*"

  SetOutPath "$INSTDIR\electron"
  File /r "apps\desktop\release\win-unpacked\*.*"

  SetOutPath "$INSTDIR\nssm"
  File "C:\nssm\nssm.exe"

  DetailPrint "تم نسخ الملفات ✓"

  ; ── تثبيت المكتبات ──
  DetailPrint "جاري تثبيت المكتبات..."
  ExecWait '"C:\Program Files\nodejs\npm.cmd" install --prefix "$INSTDIR\api" --omit=dev'
  DetailPrint "تم تثبيت المكتبات ✓"

  ; ── إعداد قاعدة البيانات (DB + Prisma schema) ──
  DetailPrint "جاري إعداد قاعدة البيانات..."
  ExecWait '"C:\Program Files\nodejs\node.exe" "$INSTDIR\api\setup-db.js"'
  DetailPrint "تم إعداد قاعدة البيانات ✓"

  ; ── إنشاء Tenant وحساب Admin الأول ──
  DetailPrint "جاري إنشاء بيانات المركز الافتراضية..."
  ExecWait '"C:\Program Files\nodejs\node.exe" "$INSTDIR\api\setup-tenant.js"'
  DetailPrint "تم إنشاء بيانات المركز ✓"

  ; ── NSSM Service ──
  nsExec::ExecToStack '"$INSTDIR\nssm\nssm.exe" status NabghaAPI'
  Pop $0
  Pop $1
  StrCmp $1 "SERVICE_RUNNING" ServiceFound InstallService
  StrCmp $1 "SERVICE_STOPPED" ServiceFound InstallService
  InstallService:
    DetailPrint "جاري تسجيل خدمة نبغة..."
    ExecWait '"$INSTDIR\nssm\nssm.exe" install NabghaAPI "C:\Program Files\nodejs\node.exe" "$INSTDIR\api\dist\main.js"'
    ExecWait '"$INSTDIR\nssm\nssm.exe" set NabghaAPI AppDirectory "$INSTDIR\api"'
    ExecWait '"$INSTDIR\nssm\nssm.exe" set NabghaAPI AppEnvironmentExtra "PORT=3001" "DEPLOY_MODE=desktop" "DATABASE_URL=postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha" "JWT_SECRET=nabgha-desktop-jwt-2026" "PLATFORM_JWT_SECRET=nabgha-platform-jwt-2026" "MULTI_TENANT=true" "STORAGE_PROVIDER=local" "ALLOW_NETWORK=true" "STATIC_PATH=$INSTDIR\web\dist"'
    ExecWait '"$INSTDIR\nssm\nssm.exe" set NabghaAPI Start SERVICE_AUTO_START'
    ExecWait '"$INSTDIR\nssm\nssm.exe" start NabghaAPI'
    DetailPrint "تم تسجيل الخدمة وتشغيلها ✓"
    Goto ServiceDone
  ServiceFound:
    DetailPrint "خدمة نبغة موجودة — جاري إعادة التشغيل..."
    ExecWait '"$INSTDIR\nssm\nssm.exe" stop NabghaAPI'
    ExecWait '"$INSTDIR\nssm\nssm.exe" start NabghaAPI'
    DetailPrint "تم إعادة التشغيل ✓"
  ServiceDone:

  ; ── Shortcut ──
  CreateShortcut "$DESKTOP\نبغة.lnk" "$INSTDIR\electron\Nabgha.exe"
  DetailPrint "تم إنشاء الاختصار على سطح المكتب ✓"

SectionEnd