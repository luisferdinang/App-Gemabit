# Guía: Cómo subir cambios manualmente al repositorio

Si necesitas subir cambios y no tienes acceso al asistente, abre una terminal (PowerShell o CMD) en la carpeta del proyecto `c:\proyecto\App-Gemabit` y sigue estos pasos:

### 1. Preparar los archivos
Este comando selecciona todos los archivos que has modificado.
```bash
git add .
```

### 2. Crear el "punto de guardado" (Commit)
Este comando guarda tus cambios localmente con un mensaje descriptivo de lo que hiciste.
```bash
git commit -m "Escribe aquí un resumen de tus cambios"
```

### 3. Enviar a la nube (Repositorio)
Este comando sube tus cambios guardados al servidor (GitHub/Vercel).
```bash
git push origin main
```

---

### Otros comandos útiles:

*   **Ver qué archivos has cambiado:**
    ```bash
    git status
    ```

*   **Bajar cambios nuevos desde la nube (si alguien más editó el código):**
    ```bash
    git pull origin main
    ```

*   **Descartar todos tus cambios locales y volver a como estaba antes:**
    > [!CAUTION]
    > Esto borrará lo que hayas escrito y no se puede deshacer.
    ```bash
    git reset --hard HEAD
    ```

### Consejos importantes:
1.  **Haz commits frecuentes**: Es mejor subir cambios pequeños que uno gigante.
2.  **Mensajes claros**: Usa mensajes como "corregir error en login" o "cambiar color de botón" para que sepas qué hiciste en el futuro.
3.  **Vercel**: Al hacer `git push`, Vercel detectará el cambio automáticamente y comenzará a publicar la nueva versión de tu app.
