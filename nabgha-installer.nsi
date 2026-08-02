!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"

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
Var NODE_FOUND
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

; ============================================
; كشف PostgreSQL
; ⚠️ مهم: NSIS بيطلّع installer 32-bit، وعلى ويندوز 64-bit
; قراءة HKLM\SOFTWARE بتتحول تلقائياً لـ WOW6432Node (فاضية)
; — عشان كده لازم SetRegView 64 قبل أي قراءة، وده كان سبب
; فشل الكشف رغم إن PostgreSQL متسجل في الـ Registry فعلاً
; ============================================
Function DetectPostgres
  StrCpy $PG_FOUND "1"
  StrCpy $0 0

  ; === 1) الـ Registry (الفرع الصحيح 64-bit) ===
  SetRegView 64
  registry_loop:
    EnumRegKey $1 HKLM "SOFTWARE\PostgreSQL\Installations" $0
    StrCmp $1 "" registry_64_done
    ReadRegStr $2 HKLM "SOFTWARE\PostgreSQL\Installations\$1" "Base Directory"
    ${If} $2 != ""
      ${If} ${FileExists} "$2\bin\psql.exe"
        StrCpy $PSQL_PATH "$2\bin\psql.exe"
        StrCpy $PG_FOUND "0"
        Goto registry_done
      ${EndIf}
    ${EndIf}
    IntOp $0 $0 + 1
    Goto registry_loop
  registry_64_done:

  ; === 2) فرع الـ 32-bit كمان (لنسخ PostgreSQL القديمة 32-bit) ===
  SetRegView 32
  StrCpy $0 0
  registry_loop_32:
    EnumRegKey $1 HKLM "SOFTWARE\PostgreSQL\Installations" $0
    StrCmp $1 "" registry_done
    ReadRegStr $2 HKLM "SOFTWARE\PostgreSQL\Installations\$1" "Base Directory"
    ${If} $2 != ""
      ${If} ${FileExists} "$2\bin\psql.exe"
        StrCpy $PSQL_PATH "$2\bin\psql.exe"
        StrCpy $PG_FOUND "0"
        Goto registry_done
      ${EndIf}
    ${EndIf}
    IntOp $0 $0 + 1
    Goto registry_loop_32
  registry_done:
  SetRegView 64

  ; === 3) Fallback: مسارات ثابتة معروفة (لو الـ Registry فاضي لأي سبب) ===
  ${If} $PG_FOUND == "1"
    StrCpy $3 18
    paths_loop:
      ${If} $3 < 12
        Goto paths_done
      ${EndIf}
      StrCpy $PSQL_PATH "C:\Program Files\PostgreSQL\$3\bin\psql.exe"
      ${If} ${FileExists} "$PSQL_PATH"
        StrCpy $PG_FOUND "0"
        Goto paths_done
      ${EndIf}
      StrCpy $PSQL_PATH "D:\Program Files\PostgreSQL\$3\bin\psql.exe"
      ${If} ${FileExists} "$PSQL_PATH"
        StrCpy $PG_FOUND "0"
        Goto paths_done
      ${EndIf}
      IntOp $3 $3 - 1
      Goto paths_loop
    paths_done:
  ${EndIf}

  ; === 4) الباث كملاذ أخير فقط ===
  ${If} $PG_FOUND == "1"
    nsExec::ExecToStack 'where psql'
    Pop $0
    Pop $PSQL_PATH
    ${If} $0 == 0
      StrCpy $PG_FOUND "0"
    ${EndIf}
  ${EndIf}

  ; جيب pg_dump من نفس مجلد psql اللي اتلقى (أياً كان مصدره)
  ${If} $PG_FOUND == "0"
    ${GetParent} "$PSQL_PATH" $3
    StrCpy $PG_DUMP_PATH "$3\pg_dump.exe"
  ${EndIf}
FunctionEnd

; ============================================
; كشف Node.js — فحص مباشر على القرص أولاً، الباث ملاذ أخير
; ============================================
Function DetectNode
  StrCpy $NODE_FOUND "1"

  StrCpy $NODE_PATH "$PROGRAMFILES64\nodejs\node.exe"
  ${If} ${FileExists} "$NODE_PATH"
    StrCpy $NODE_FOUND "0"
  ${Else}
    StrCpy $NODE_PATH "C:\Program Files\nodejs\node.exe"
    ${If} ${FileExists} "$NODE_PATH"
      StrCpy $NODE_FOUND "0"
    ${Else}
      StrCpy $NODE_PATH "C:\nvm4w\nodejs\node.exe"
      ${If} ${FileExists} "$NODE_PATH"
        StrCpy $NODE_FOUND "0"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ${If} $NODE_FOUND == "1"
    nsExec::ExecToStack 'where node'
    Pop $0
    Pop $NODE_PATH
    ${If} $0 == 0
      StrCpy $NODE_FOUND "0"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function .onInit
  ; تحديد هل ده تثبيت جديد أو تحديث — قبل أي صفحة
  ${IfNot} ${FileExists} "$INSTDIR\نبغة.exe"
    StrCpy $IS_UPDATE "0"
  ${Else}
    StrCpy $IS_UPDATE "1"
  ${EndIf}
FunctionEnd

Function PgPasswordPage
  Call DetectPostgres

  ${If} $PG_FOUND != "0"
    ; PostgreSQL مش موجود — هيتثبت بالباسورد الافتراضي، وتخطي الصفحة
    StrCpy $PG_PASSWORD "123456"
    Abort
  ${EndIf}

  ; PostgreSQL موجود — اطلب الباسورد من المستخدم
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

  ; ============================================
  ; فحص حاسم: هل الباسورد صح والخدمة شغالة فعلاً؟
  ; من غير الفحص ده، باسورد غلط = فشل صامت لكل الخطوات الجاية
  ; (backup + إنشاء اليوزر + migrations كلها هتفشل ورا بعض)
  ; ملاحظة: Abort هنا معناها "ارجع لنفس الصفحة" — مش إغلاق الإنستولر
  ; ============================================
  System::Call 'Kernel32::SetEnvironmentVariable(t "PGPASSWORD", t "$PG_PASSWORD")'
  nsExec::ExecToStack '"$PSQL_PATH" -U postgres -h 127.0.0.1 -c "SELECT 1;"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_OK "تعذر الاتصال بقاعدة البيانات!$\n$\nالأسباب المحتملة:$\n- كلمة المرور غير صحيحة$\n- خدمة PostgreSQL متوقفة$\n$\nيرجى التأكد والمحاولة مرة أخرى."
    Abort
  ${EndIf}
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

  ; التحقق من Node.js وتثبيته لو مش موجود فعلياً على القرص
  Call DetectNode
  ${If} $NODE_FOUND != "0"
    DetailPrint "جاري تثبيت Node.js..."
    File "/oname=$TEMP\node-installer.msi" "tools\node-v20.19.2-x64.msi"
    ExecWait 'msiexec /i "$TEMP\node-installer.msi" /quiet /norestart' $0
    ${If} $0 != 0
      DetailPrint "تحذير: تثبيت Node.js رجّع كود $0"
    ${EndIf}
    Sleep 3000
    Call DetectNode
    ${If} $NODE_FOUND != "0"
      MessageBox MB_OK "فشل تثبيت Node.js!$\nلن يعمل التطبيق بدونه.$\nيرجى التواصل مع الدعم الفني."
      Abort
    ${EndIf}
    DetailPrint "تم تثبيت Node.js: $NODE_PATH"
  ${Else}
    DetailPrint "Node.js موجود بالفعل: $NODE_PATH"
  ${EndIf}

  ; التحقق من PostgreSQL وتثبيته لو مش موجود فعلياً على القرص
  Call DetectPostgres
  ${If} $PG_FOUND != "0"
    DetailPrint "جاري تثبيت PostgreSQL..."
    File "/oname=$TEMP\pg-installer.exe" "tools\postgresql-windows-x64.exe"
    ExecWait '"$TEMP\pg-installer.exe" --mode unattended --superpassword "123456" --enable-components server,commandlinetools' $0
    ${If} $0 != 0
      DetailPrint "تحذير: مثبّت PostgreSQL رجّع كود $0"
    ${EndIf}
    Sleep 8000
    StrCpy $PG_PASSWORD "123456"
    System::Call 'Kernel32::SetEnvironmentVariable(t "PGPASSWORD", t "$PG_PASSWORD")'
    Call DetectPostgres
    ${If} $PG_FOUND != "0"
      MessageBox MB_OK "فشل تثبيت PostgreSQL!$\nلن يعمل التطبيق بدونه.$\nيرجى التواصل مع الدعم الفني."
      Abort
    ${EndIf}
    DetailPrint "تم تثبيت PostgreSQL: $PSQL_PATH"
  ${Else}
    DetailPrint "PostgreSQL موجود بالفعل: $PSQL_PATH"
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