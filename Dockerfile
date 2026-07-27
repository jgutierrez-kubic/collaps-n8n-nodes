# Usar la imagen oficial válida de n8n
FROM n8nio/n8n:2.31.4

USER root

# Crear directorio para el paquete de nodos
WORKDIR /home/node/.n8n/custom/node_modules/n8n-nodes-collaps

# Copiar solo el manifest y el código TypeScript compilado
COPY package.json ./
COPY dist ./dist

# Instalar dependencias de producción limpias dentro del contenedor Linux
RUN npm install --omit=dev --no-audit --no-fund

# Permisos
RUN chown -R node:node /home/node/.n8n

USER node
WORKDIR /data
