# Levanta el ambiente de demostración y corre las pruebas de interfaz con el navegador a la vista.
#
# Pensado para sustentar: un solo comando en vez de tres terminales delante del público.
#
#   .\scripts\demo-pruebas.ps1              levanta todo y corre las pruebas visibles
#   .\scripts\demo-pruebas.ps1 -Grabar      además graba el video de la corrida
#   .\scripts\demo-pruebas.ps1 -SoloPruebas el ambiente ya está arriba, solo corre
#   .\scripts\demo-pruebas.ps1 -Bajar       apaga backend, frontend y base de datos
#
# El backend y el frontend quedan en ventanas minimizadas: existen, pero no estorban en pantalla.
# Lo único que se ve es el navegador haciendo lo suyo.

param(
  [switch]$Grabar,
  [switch]$SoloPruebas,
  [switch]$Bajar,
  [string]$Backend = '',
  [string]$Navegador = 'msedge',
  [string]$Pruebas = 'e2e/web/flujos-criticos-rnf17.spec.ts',
  [string]$Etiqueta = '@flujos'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
if (-not $Backend) { $Backend = Join-Path (Split-Path -Parent $raiz) 'fixup-backend' }

$CONTENEDOR = 'fixup-demo-db'
$CLAVE = 'demo-local'

function Paso($t) { Write-Host "`n==== $t ====" -ForegroundColor Yellow }
function Bien($t) { Write-Host $t -ForegroundColor Green }

# Devuelve el código HTTP de una URL, o 0 si no respondió. Invoke-WebRequest lanza excepción en
# cualquier código de error y -SkipHttpErrorCheck solo existe en PowerShell 7, así que se lee del
# objeto de la excepción.
function CodigoDe($url) {
  try {
    return [int](Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing).StatusCode
  } catch {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
    return 0
  }
}

function Esperar($url, $esperado, $segundos, $queEs) {
  foreach ($i in 1..$segundos) {
    if ((CodigoDe $url) -eq $esperado) { Bien "$queEs listo." ; return }
    Start-Sleep -Seconds 1
    if ($i % 15 -eq 0) { Write-Host "  esperando $queEs... ${i}s" }
  }
  throw "$queEs no respondió $esperado en $segundos s."
}

# ──────────────────────────────────────────────────────────── apagar
if ($Bajar) {
  Paso 'Apagando'
  Get-Process -Name node, java -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and ($_.Path -like "$raiz*" -or $_.Path -like "$Backend*") } |
    Stop-Process -Force -ErrorAction SilentlyContinue
  Get-Job -Name 'demo-*' -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
  docker rm -f $CONTENEDOR 2>$null | Out-Null
  Bien 'Listo. Si quedaron ventanas de backend o frontend abiertas, ciérralas a mano.'
  exit 0
}

if (-not $SoloPruebas) {
  # ────────────────────────────────────────────────────────── 1. base
  Paso '1. Base de datos'
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Docker no responde. Abre Docker Desktop y espera a que diga Engine running.' }

  $existe = docker ps -a --filter "name=^/$CONTENEDOR$" --format '{{.Names}}'
  if ($existe) {
    docker start $CONTENEDOR | Out-Null
    Bien 'Contenedor existente reiniciado (conserva los datos de la corrida anterior).'
  } else {
    docker run -d --name $CONTENEDOR -e POSTGRES_DB=fixup -e POSTGRES_USER=fixup `
      -e POSTGRES_PASSWORD=$CLAVE -p 5432:5432 postgres:17 | Out-Null
    Bien 'Contenedor creado.'
  }

  foreach ($i in 1..60) {
    docker exec $CONTENEDOR pg_isready -U fixup -d fixup 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL no quedó listo.' }
  Bien 'PostgreSQL aceptando conexiones.'

  # ────────────────────────────────────────────────────────── 2. backend
  Paso '2. Backend (perfil demo)'
  if (-not (Test-Path (Join-Path $Backend 'mvnw.cmd'))) { throw "No encuentro el backend en $Backend. Pásalo con -Backend <ruta>." }

  if ((CodigoDe 'http://127.0.0.1:8080/demo/token?role=OWNER') -eq 200) {
    Bien 'Ya había un backend demo respondiendo; se reutiliza.'
  } else {
    # Las variables van en el comando y no en el entorno de esta sesión, para que la ventana nueva
    # las reciba sin depender de lo que haya quedado de corridas anteriores.
    $comando = "cd '$Backend'; " +
      "`$env:DATABASE_URL='jdbc:postgresql://localhost:5432/fixup'; " +
      "`$env:DATABASE_USERNAME='fixup'; " +
      "`$env:DATABASE_PASSWORD='$CLAVE'; " +
      ".\mvnw.cmd spring-boot:run '-Dspring-boot.run.profiles=demo'"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $comando -WindowStyle Minimized
    Write-Host '  compilando y aplicando migraciones, suele tardar un par de minutos...'
    # 200 en /demo/token prueba dos cosas: que el servidor está arriba y que el perfil demo quedó
    # activo. Un 404 aquí significa que arrancó sin el perfil y las pruebas no tendrían cuentas.
    Esperar 'http://127.0.0.1:8080/demo/token?role=OWNER' 200 300 'El backend'
  }

  # ────────────────────────────────────────────────────────── 3. frontend
  Paso '3. Frontend'
  if ((CodigoDe 'http://localhost:4200/') -eq 200) {
    Bien 'Ya había un frontend sirviendo; se reutiliza.'
  } else {
    if (-not (Test-Path (Join-Path $raiz 'node_modules'))) {
      Write-Host '  instalando dependencias (npm ci), la primera vez tarda...'
      npm ci
      if ($LASTEXITCODE -ne 0) { throw 'Falló npm ci.' }
    }
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$raiz'; npm start" -WindowStyle Minimized
    Esperar 'http://localhost:4200/' 200 180 'El frontend'
  }
}

# Con -SoloPruebas no se levanta nada, así que se confirma que el ambiente esté arriba. Sin esto,
# si alguien se saltó el montaje, las ocho pruebas fallan con "connection refused" y no queda
# claro que el problema no son las pruebas.
if ($SoloPruebas) {
  $faltan = @()
  if ((CodigoDe 'http://127.0.0.1:8080/demo/token?role=OWNER') -ne 200) { $faltan += 'backend (8080)' }
  if ((CodigoDe 'http://localhost:4200/') -ne 200) { $faltan += 'frontend (4200)' }
  if ($faltan.Count) {
    Write-Host "`nEl ambiente no está arriba: falta $($faltan -join ' y ')." -ForegroundColor Red
    Write-Host 'Corre primero el script sin -SoloPruebas para levantarlo:' -ForegroundColor Red
    Write-Host '    .\scripts\demo-pruebas.ps1' -ForegroundColor White
    exit 1
  }
}

# ──────────────────────────────────────────────────────────── 4. pruebas
Paso '4. Pruebas de interfaz'
$env:E2E_DEMO = '1'
$env:PLAYWRIGHT_CHANNEL = $Navegador
if ($Grabar) {
  # Grabar necesita ffmpeg, y Playwright no lo instala al traer solo un navegador del sistema como
  # Edge o Chrome: la corrida falla entera con "Executable doesn't exist". El comando es idempotente
  # y tarda un segundo si ya está, así que se corre siempre antes de grabar.
  Write-Host 'Comprobando ffmpeg (lo necesita la grabación)...'
  npx playwright install ffmpeg
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar ffmpeg; sin él no se puede grabar. Corre sin -Grabar.' }
  $env:PLAYWRIGHT_VIDEO = 'on'
  Write-Host 'Grabando video de la corrida.' -ForegroundColor Cyan
} else {
  Remove-Item Env:\PLAYWRIGHT_VIDEO -ErrorAction SilentlyContinue
}

Write-Host "Corriendo $Pruebas con etiqueta $Etiqueta, navegador a la vista." -ForegroundColor Cyan
# --trace on en vez del 'retain-on-failure' de la configuración: aquí interesa la traza de las
# corridas que SÍ pasan, que es lo que se muestra. Con el valor por omisión, una corrida en verde
# no deja ninguna y el visor queda sin nada que abrir.
npx playwright test $Pruebas --grep $Etiqueta --headed --trace on
$codigo = $LASTEXITCODE

# ──────────────────────────────────────────────────────────── 5. qué mostrar después
Paso '5. Qué abrir ahora'
Write-Host '  Informe con capturas y pasos de cada prueba:'
Write-Host '      npx playwright show-report' -ForegroundColor White

# La ruta de la traza se imprime completa, no como plantilla: en una sustentación no se está para
# adivinar nombres de carpeta con acentos y recortes.
$traza = Get-ChildItem -Path (Join-Path $raiz 'test-results') -Filter 'trace.zip' -Recurse -ErrorAction SilentlyContinue |
         Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host '  Visor de trazas, reproduce la corrida cuadro por cuadro con el DOM de cada momento:'
if ($traza) {
  Write-Host "      npx playwright show-trace `"$($traza.FullName)`"" -ForegroundColor White
} else {
  Write-Host '      (no se generó ninguna traza en esta corrida)' -ForegroundColor DarkGray
}
if ($Grabar) {
  Write-Host '  Videos de la corrida:'
  Write-Host '      test-results\<carpeta>\video.webm' -ForegroundColor White
}
Write-Host '  Evidencia de los flujos (capturas y JSON):'
Write-Host "      $raiz\test-results\flujos-criticos-rnf17" -ForegroundColor White

if ($codigo -ne 0) {
  Write-Host "`nAlguna prueba falló (código ${codigo}). El informe de arriba dice cuál y por qué." -ForegroundColor Red
} else {
  Write-Host "`nTodas en verde." -ForegroundColor Green
}
Write-Host 'Para apagar todo:  .\scripts\demo-pruebas.ps1 -Bajar'
exit $codigo
