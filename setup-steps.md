# Setup Steps - NeuralCut (Windows)

Guia paso a paso para levantar el proyecto desde cero en Windows.
Si es tu primer proyecto de software, no te preocupes: cada paso esta explicado.

> **Antes de empezar:** Abrí **PowerShell como Administrador** (click derecho en el menu Inicio > "Terminal (Administrador)" o "Windows PowerShell (Administrador)"). Vas a necesitarlo para todos los pasos de instalacion.

---

## Indice

1. [Instalar herramientas base (Git + Node.js + Docker)](#1-instalar-herramientas-base)
2. [Instalar Bun](#2-instalar-bun)
3. [Clonar el repositorio](#3-clonar-el-repositorio)
4. [Configurar variables de entorno](#4-configurar-variables-de-entorno)
5. [Levantar la base de datos con Docker](#5-levantar-la-base-de-datos-con-docker)
6. [Instalar dependencias del proyecto](#6-instalar-dependencias-del-proyecto)
7. [Correr migraciones de la base de datos](#7-correr-migraciones-de-la-base-de-datos)
8. [Iniciar el servidor de desarrollo](#8-iniciar-el-servidor-de-desarrollo)
9. [Configurar VS Code](#9-configurar-vs-code-recomendado)
10. [Comandos utiles](#10-comandos-utiles)
11. [Instalar y usar opencode](#11-instalar-y-usar-opencode)

---

## 1. Instalar herramientas base

Vamos a instalar todo de una con **winget**, el gestor de paquetes que ya viene en Windows. Abrí **PowerShell como Administrador** y ejecuta estos tres comandos:

```powershell
winget install Git.Git --accept-source-agreements --accept-package-agreements
```

```powershell
winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
```

```powershell
winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
```

> **Que son estas herramientas?**
> - **Git**: Control de versiones. Permite que varias personas trabajen en el mismo codigo sin pisarse.
> - **Node.js**: Entorno para ejecutar JavaScript fuera del navegador. Incluye `npm` automaticamente.
> - **Docker Desktop**: Permite correr servicios (base de datos, Redis) en contenedores sin instalarlos a mano.

Cada uno se baja e instala solo. Cuando terminen los tres, **cierra la terminal y abri una nueva** (no hace falta que sea admin esta vez). Verifica que anden:

```powershell
git --version
node --version
npm --version
docker --version
```

Si los cuatro te muestran numeros de version, todo bien.

**Configura tu identidad en Git** (necesario para hacer commits):

```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

> **Si `winget` no existe** (muy poco probable en Windows 10/11): Instalá cada herramienta manualmente desde sus webs: [Git](https://git-scm.com/download/win), [Node.js LTS](https://nodejs.org/), [Docker Desktop](https://www.docker.com/products/docker-desktop/).

> **Si Docker no arranca** despues de instalarlo, saltea a [Solucion de problemas de Docker](#solucion-de-problemas-de-docker-en-windows).

---

## 2. Instalar Bun

Bun es el gestor de paquetes que usa este proyecto (es mas rapido que npm). Se instala con npm:

```powershell
npm install -g bun
```

Verifica:

```powershell
bun --version
```

Deberias ver algo como `1.2.x`.

---

## 3. Clonar el repositorio

Clonar significa descargar una copia del codigo fuente a tu computadora.

1. Navega a la carpeta donde quieras guardar el proyecto:

```powershell
cd C:\Users\TuUsuario\Documents
```

2. Clona el repo:

```powershell
git clone https://github.com/TU-USUARIO/NeuralCut.git
```

> **OJO:** Reemplaza `TU-USUARIO` con el usuario/organizacion correcta del repositorio. Si te dieron un fork propio, usa tu usuario.

3. Entra a la carpeta del proyecto:

```powershell
cd NeuralCut
```

---

## 4. Configurar variables de entorno

Las variables de entorno son configuraciones que la aplicacion necesita para funcionar (conexion a la base de datos, claves secretas, etc.).

El proyecto tiene un archivo de ejemplo con los valores por defecto. Copialo:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

> El `.env.example` ya tiene valores por defecto que coinciden con la configuracion de Docker. Para desarrollo local deberia funcionar tal cual. **No cambies los valores a menos que sepas lo que haces.**

---

## 5. Levantar la base de datos con Docker

**Antes de continuar:** Abri Docker Desktop desde el menu Inicio y espera a que diga "Docker Desktop is running" (el icono de la ballena en la barra de tareas deja de animarse). Esto puede tardar un minuto la primera vez.

Desde la raiz del proyecto, ejecuta:

```powershell
docker compose up -d db redis serverless-redis-http
```

Esto levanta tres servicios:
- **db**: Base de datos PostgreSQL (puerto 5432)
- **redis**: Cache en memoria (puerto 6379)
- **serverless-redis-http**: Interfaz HTTP para Redis (puerto 8079)

Verifica que esten corriendo:

```powershell
docker compose ps
```

Deberias ver tres servicios con estado `Up` o `healthy`.

> **Para detener los contenedores** cuando termines de trabajar: `docker compose down`
>
> **Para detener y borrar los datos**: `docker compose down -v` (solo si queres empezar de cero)

---

## 6. Instalar dependencias del proyecto

Las dependencias son librerias externas que el proyecto necesita para funcionar (React, Next.js, etc.).

```powershell
bun install
```

Esto lee el `package.json` y descarga todo. Puede tardar un par de minutos la primera vez. Si no hay errores rojos, todo bien (algunos warnings amarillos son normales).

> **Si falla:** Prueba borrar `node_modules` y `bun.lock` y volver a correr `bun install`.

---

## 7. Correr migraciones de la base de datos

Las migraciones crean las tablas y estructuras necesarias en la base de datos.

Asegurate de que Docker este corriendo (paso 5) y ejecuta:

```powershell
bun run db:migrate
```

> **Si dice "no migrations to apply"**: No pasa nada, significa que ya estan aplicadas o que se aplicaran automaticamente.

---

## 8. Iniciar el servidor de desarrollo

```powershell
bun dev:web
```

Espera a que veas algo como:

```
  ▲ Next.js 16.x.x
  - Local:   http://localhost:3000
```

Abre tu navegador en **http://localhost:3000**. Deberias ver la aplicacion corriendo. Listo!

> **Para detener el servidor:** Presiona `Ctrl + C` en la terminal.

---

## 9. Configurar VS Code (recomendado)

Si no tenes VS Code, instalalo con winget:

```powershell
winget install Microsoft.VisualStudioCode --accept-source-agreements --accept-package-agreements
```

El proyecto ya tiene configuracion de VS Code en `.vscode/settings.json`. Para que funcione bien, instala estas extensiones:

### Obligatoria

1. **Biome** - Linter y formateador del proyecto. Corrige errores de codigo y formatea automaticamente al guardar.

### Recomendadas

2. **Tailwind CSS IntelliSense** - Autocompletado de clases CSS
3. **Error Lens** - Muestra errores inline directamente en el editor
4. **GitLens** - Muestra quien escribio cada linea de codigo y cuando

Para instalar extensiones: abri VS Code, anda a la barra lateral izquierda (icono de cuadrados), busca cada extension por nombre y dale "Install".

---

## 10. Comandos utiles

Los comandos que van a usar dia a dia, desde la **raiz del proyecto**:

| Comando | Que hace |
|---------|----------|
| `bun dev:web` | Inicia el servidor de desarrollo |
| `bun run build:web` | Compila el proyecto para produccion |
| `bun run lint:web` | Revisa errores de codigo |
| `bun run lint:web:fix` | Revisa y corrige errores automaticamente |
| `bun run format:web` | Formatea el codigo |
| `bun run db:migrate` | Aplica migraciones de base de datos |
| `docker compose up -d` | Levanta los servicios de Docker |
| `docker compose down` | Detiene los servicios de Docker |

---

## 11. Instalar y usar opencode

opencode es una herramienta de IA que te ayuda a escribir codigo, resolver bugs y navegar el proyecto directo desde la terminal.

### Instalacion

```powershell
npm install -g opencode
```

Verifica:

```powershell
opencode --version
```

### Configuracion inicial

opencode necesita una API key de un proveedor de IA. Preguntale al equipo cual usar y te pasan la config.

### Como usarlo

Desde la raiz del proyecto:

```powershell
opencode
```

Se abre una interfaz interactiva en la terminal. Ahi podes:

- **Preguntar sobre el codigo:** "Explicame que hace el archivo `apps/web/src/app/page.tsx`"
- **Pedir cambios:** "Agrega un boton que diga Hola en la pagina principal"
- **Buscar bugs:** "Revisa por que falla el login"
- **Buscar archivos:** "Donde esta el componente del timeline?"

Para salir: `Ctrl + C` o `/exit`

| Comando | Que hace |
|---------|----------|
| `/help` | Muestra la ayuda completa |
| `/exit` | Sale de opencode |
| `/compact` | Compacta la conversacion para ahorrar contexto |

> **Tip:** opencode lee el archivo `AGENTS.md` del proyecto para entender las convenciones. No hace falta que le expliques la arquitectura cada vez.

---

## Resumen rapido (para cuando ya lo configuraste una vez)

```powershell
# 1. Abrir Docker Desktop manualmente

# 2. Levantar servicios
docker compose up -d db redis serverless-redis-http

# 3. Iniciar el servidor
bun dev:web

# 4. Abrir http://localhost:3000 en el navegador

# 5. Cuando termines de trabajar
# Ctrl+C en la terminal del servidor
docker compose down
```

---

## Solucion de problemas de Docker en Windows

Docker Desktop en Windows necesita **virtualizacion** (hardware) y **WSL 2** (Windows). Si Docker tira un error al iniciar, segui estos pasos.

### Paso 1: Verificar virtualizacion

1. Abri **Administrador de tareas** (`Ctrl + Shift + Esc`)
2. Pestaña **Rendimiento** > **CPU**
3. Busca **Virtualización: Habilitada**

Si dice **Deshabilitada**, hay que habilitarla en el BIOS:

1. Reinicia la compu y presiona repetidamente la tecla para entrar al BIOS:
   - **HP**: `F10` o `Esc`
   - **Lenovo**: `F2` o `Fn + F2`
   - **Dell**: `F2`
   - **ASUS**: `F2` o `Supr`
   - **Acer**: `F2` o `Supr`
2. Busca alguna de estas opciones (suele estar en **Advanced** > **CPU Configuration** o **Security**):
   - `Intel Virtualization Technology` / `Intel VT-x` (Intel)
   - `SVM Mode` / `AMD-V` (AMD)
3. Cambiala a **Enabled**
4. Guarda y sali (generalmente `F10`)

### Paso 2: Habilitar WSL 2

Abri **PowerShell como Administrador** y ejecuta:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

**Reinicia la computadora.** Despues, abri PowerShell normal y ejecuta:

```powershell
wsl --set-default-version 2
```

Si te pide instalar un kernel update, bajalo de https://aka.ms/wsl2kernel y ejecutalo.

Verifica con `wsl --status` — deberia decir `Default Version: 2`.

### Paso 3: Reiniciar Docker

1. Abri Docker Desktop
2. Anda a **Settings** (engranaje) > **General**
3. Asegurate que **"Use the WSL 2 based engine"** este marcado
4. Docker deberia arrancar ahora

> **Si despues de todo sigue sin funcionar**, desinstala Docker, reinicia, y vuelve a instalar: `winget install Docker.DockerDesktop`. Si aun asi falla, hablale a un companero.

---

## Problemas comunes

### "winget no se reconoce como un comando"
Tu Windows es muy viejo. Instalá las herramientas manualmente desde sus webs: [Git](https://git-scm.com/download/win), [Node.js LTS](https://nodejs.org/), [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### "bun no se reconoce como un comando"
Cerra la terminal y abrila de nuevo. Si persiste, corre `npm install -g bun` otra vez.

### "docker compose up" falla con error de conexion
Asegurate de que Docker Desktop este abierto y mostrando "Docker Desktop is running". Espera unos segundos y vuelve a intentar.

### "Error: connect ECONNREFUSED 127.0.0.1:5432"
La base de datos no esta levantada. Corre `docker compose up -d db` y espera a que diga `healthy`.

### "Next.js build error" o errores de TypeScript
Borra la cache y reinstala:

```powershell
Remove-Item -Recurse -Force apps\web\.next
bun install
bun dev:web
```

### Los estilos se ven mal o no cargan
Reinicia el servidor: `Ctrl+C` y `bun dev:web` de nuevo.

---

Si llegaste hasta aca y la app corre en `http://localhost:3000`, estas listo para trabajar. Bienvenido al equipo!
