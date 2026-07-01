!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Name "نبغة"
OutFile "nabgha-setup.exe"
InstallDir "$PROGRAMFILES64\Nabgha"
RequestExecutionLevel admin

!define MUI_ABORTWARNING
!define MUI_ICON "apps\desktop\assets\icon.ico"

Var PG_PASSWORD
Var Dialog
Var Label
Var PasswordInput
Var PG_FOUND
Var NODE_PATH
Var PSQL_PATH
Var PG_DUMP_PATH
Var IS_UPDATE
Var BACKUP_RESULT

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
Page custom PgPasswordPage PgPasswordPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Arabic"

Function .onInit
  ; تحديد هل ده تثبيت جديد أو تحديث — قبل أي صفحة
  ${IfNot} ${FileExists} "$INSTDIR\نبغة.exe"
    StrCpy $IS_UPDATE "0"
  ${Else}
    StrCpy $IS_UPDATE "1"
  ${EndIf}
FunctionEnd

Function PgPasswordPage
  nsExec::ExecToStack 'psql --version'
  Pop $PG_FOUND

  ${If} $PG_FOUND != 0
    StrCpy $PG_PASSWORD "123456"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $IS_UPDATE == "1"
    ${NSD_CreateLabel} 0 0 100% 40u "تحديث نبغة — يوجد تثبيت سابق على جهازك.$\nأدخل كلمة مرور المستخدم postgres لإتمام التحديث بأمان:"
  ${Else}
    ${NSD_CreateLabel} 0 0 100% 40u "PostgreSQL موجود على جهازك.$\nأدخل كلمة مرور المستخدم postgres:"
  ${EndIf}
  Pop $Label

  ${NSD_CreatePassword} 0 50u 100% 14u ""
  Pop $PasswordInput

  nsDialogs::Show
FunctionEnd

Function PgPasswordPageLeave
  ${NSD_GetText} $PasswordInput $PG_PASSWORD
FunctionEnd

Section "نبغة" SecMain
  SetOutPath "$INSTDIR"

  ${If} $IS_UPDATE == "1"
    DetailPrint "============================================"
    DetailPrint "تحديث مكتشف — جاري المتابعة بوضع التحديث الآمن"
    DetailPrint "============================================"
  ${Else}
    DetailPrint "============================================"
    DetailPrint "تثبيت جديد"
    DetailPrint "============================================"
  ${EndIf}

  ; إيقاف التطبيق لو شغال (مهم جداً في وضع التحديث)
  ${If} $IS_UPDATE == "1"
    DetailPrint "جاري إيقاف نبغة..."
    nsExec::ExecToStack 'taskkill /f /im "نبغة.exe" /t'
    Sleep 2000
  ${EndIf}

  ; نسخ ملفات نبغة
  File /r "apps\desktop\release\win-unpacked\*.*"

  ; التحقق من Node.js وتثبيته لو مش موجود
  nsExec::ExecToStack 'node --version'
  Pop $0
  ${If} $0 != 0
    DetailPrint "جاري تثبيت Node.js..."
    File "/oname=$TEMP\node-installer.msi" "tools\node-v20.19.2-x64.msi"
    ExecWait 'msiexec /i "$TEMP\node-installer.msi" /quiet /norestart'
    Sleep 3000
    DetailPrint "تم تثبيت Node.js"
  ${Else}
    DetailPrint "Node.js موجود بالفعل"
  ${EndIf}

  ; جيب node path الصح — جرب كل المسارات المعروفة بالترتيب
  StrCpy $NODE_PATH "$PROGRAMFILES64\nodejs\node.exe"
  ${IfNot} ${FileExists} "$NODE_PATH"
    StrCpy $NODE_PATH "C:\Program Files\nodejs\node.exe"
  ${EndIf}
  ${IfNot} ${FileExists} "$NODE_PATH"
    StrCpy $NODE_PATH "C:\nvm4w\nodejs\node.exe"
  ${EndIf}
  ${IfNot} ${FileExists} "$NODE_PATH"
    nsExec::ExecToStack 'where node'
    Pop $0
    Pop $NODE_PATH
  ${EndIf}
  DetailPrint "Node path: $NODE_PATH"

  ; التحقق من PostgreSQL وتثبيته لو مش موجود
  nsExec::ExecToStack 'psql --version'
  Pop $0
  ${If} $0 != 0
    DetailPrint "جاري تثبيت PostgreSQL..."
    File "/oname=$TEMP\pg-installer.exe" "tools\postgresql-windows-x64.exe"
    ExecWait '"$TEMP\pg-installer.exe" --mode unattended --superpassword "123456" --enable-components server,commandlinetools'
    Sleep 8000
    DetailPrint "تم تثبيت PostgreSQL"
    StrCpy $PG_PASSWORD "123456"
  ${Else}
    DetailPrint "PostgreSQL موجود بالفعل"
  ${EndIf}

  ; جيب psql path الصح
  StrCpy $PSQL_PATH "C:\Program Files\PostgreSQL\16\bin\psql.exe"
  ${IfNot} ${FileExists} "$PSQL_PATH"
    StrCpy $PSQL_PATH "C:\Program Files\PostgreSQL\17\bin\psql.exe"
  ${EndIf}

  ; جيب pg_dump path الصح (نفس مجلد psql)
  StrCpy $PG_DUMP_PATH "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
  ${IfNot} ${FileExists} "$PG_DUMP_PATH"
    StrCpy $PG_DUMP_PATH "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
  ${EndIf}

  System::Call 'Kernel32::SetEnvironmentVariable(t "PGPASSWORD", t "$PG_PASSWORD")'

  ; ============================================
  ; وضع التحديث: Backup إجباري قبل أي migration
  ; ============================================
  ${If} $IS_UPDATE == "1"
    DetailPrint "جاري إنشاء نسخة احتياطية من قاعدة البيانات..."
    CreateDirectory "$INSTDIR\backups"
    nsExec::ExecToStack '"$PG_DUMP_PATH" -U postgres -d nabgha -F c -f "$INSTDIR\backups\backup_pre_update.dump"'
    Pop $BACKUP_RESULT
    ${If} $BACKUP_RESULT != 0
      MessageBox MB_YESNO "تحذير: فشل إنشاء نسخة احتياطية من قاعدة البيانات!$\nهل تريد المتابعة بدون نسخة احتياطية؟ (غير موصى به)" IDYES continue_update IDNO abort_install
      abort_install:
        DetailPrint "تم إلغاء التحديث بناءً على طلب المستخدم"
        Abort
      continue_update:
        DetailPrint "تم تجاوز فشل النسخة الاحتياطية بناءً على طلب المستخدم"
    ${Else}
      DetailPrint "تم إنشاء النسخة الاحتياطية بنجاح: $INSTDIR\backups\backup_pre_update.dump"
    ${EndIf}
  ${EndIf}

  ; ============================================
  ; إعداد قاعدة البيانات (آمن — مش بيمسح لو موجودة)
  ; ============================================
  DetailPrint "جاري إعداد قاعدة البيانات..."
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -c "CREATE USER nabgha WITH PASSWORD $\'nabgha123$\';"'
  Pop $0
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -c "CREATE DATABASE nabgha OWNER nabgha;"'
  Pop $0
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE nabgha TO nabgha;"'
  Pop $0

  ; ============================================
  ; تشغيل الـ Migrations (public + tenant)
  ; idempotent — آمن في التثبيت الجديد والتحديث
  ; الجداول الآن تُنشأ هنا (CREATE TABLE IF NOT EXISTS داخل
  ; 001_initial.sql) — لا حاجة بعد الآن لـ prisma db push
  ; ============================================
  DetailPrint "جاري تشغيل الـ Migrations..."
  System::Call 'Kernel32::SetEnvironmentVariable(t "DATABASE_URL", t "postgresql://nabgha:nabgha123@127.0.0.1:5432/nabgha")'
  nsExec::ExecToStack '"$NODE_PATH" "$INSTDIR\resources\db\src\migrate.js"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "خطأ: Migration فشلت — راجع الـ logs"
    ${If} $IS_UPDATE == "1"
      MessageBox MB_OK "فشلت عملية التحديث!$\nالنسخة الاحتياطية موجودة في:$\n$INSTDIR\backups\backup_pre_update.dump$\nيرجى التواصل مع الدعم الفني."
    ${EndIf}
  ${Else}
    DetailPrint "تم تشغيل الـ Migrations بنجاح"
  ${EndIf}

  ${If} $IS_UPDATE == "1"
    DetailPrint "تم التحديث بنجاح!"
  ${Else}
    DetailPrint "تم التثبيت بنجاح!"
  ${EndIf}

  ; Shortcuts (مش هتتكرر لو موجودة)
  CreateDirectory "$SMPROGRAMS\نبغة"
  CreateShortcut "$SMPROGRAMS\نبغة\نبغة.lnk" "$INSTDIR\نبغة.exe"
  CreateShortcut "$DESKTOP\نبغة.lnk" "$INSTDIR\نبغة.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nabgha" "DisplayName" "نبغة"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nabgha" "UninstallString" "$INSTDIR\Uninstall.exe"

SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\نبغة.lnk"
  Delete "$SMPROGRAMS\نبغة\نبغة.lnk"
  RMDir "$SMPROGRAMS\نبغة"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nabgha"
SectionEnd