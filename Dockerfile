# Usa una imagen oficial de Node.js ligera. Alpine es una distribución de Linux pequeña.
FROM node:18-alpine

# Instala las dependencias del sistema: Tesseract, sus datos en español y GraphicsMagick
# Esto es CRUCIAL y la razón principal para usar Docker aquí.
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-spa graphicsmagick ghostscript

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala solo las dependencias de producción
RUN npm install --production

# Copia el resto del código de tu aplicación
COPY . .

# Expone el puerto en el que corre tu aplicación
EXPOSE 3000

# El comando para iniciar tu aplicación
CMD ["npm", "start"]