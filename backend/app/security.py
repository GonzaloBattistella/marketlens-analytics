import bcrypt
from datetime import datetime, timedelta, timezone
import jwt
import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import models


# Cargamos el archivo .env para que Python pueda leerlo.
load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Convierto los minutos a entero (porque os.getenv) siempre devuelve texto.
try:
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
except (ValueError, TypeError):
    ACCESS_TOKEN_EXPIRE_MINUTES = 60


# Función 1: Recibe la contraseña limpia, la convierte a bytes, la encripta y devuelve el string
def hash_password(password: str) -> str:
    # Genero la "sal" (salt) necesaria para el algoritmo
    salt = bcrypt.gensalt()
    # Encripto
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    # Devuelvo como string para guardar en Postgres
    return hashed.decode('utf-8')

# Función 2: Compara la contraseña limpia del login con el hash de la DB
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False   

# Funcion 3: Genera el Token encriptado con los datos del usuario.
def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    # Calculo el tiempo en que va a expirar el token. (Hora actual + 60 minutos.)
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # Meto la expiracion adentro de los datos del token.
    to_encode.update({"exp": expire})

    # Firmamos el token, con nuestra SECRET_KEY
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt

# Funcion 4: Toma el token, lo va a abrir, va a extraer el usuario y lo va a buscar en Postgres, si esta todo bien, le da paso al endpoint.
# Esto le dice a FastAPI donde buscar el token. (en la cabecera 'Authorization')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="http://127.0.0.1:8000/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Armo una excepción genérica por si el token no es válido
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Desencripto el token, usando nuestra SECRET_KEY.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = str = payload.get("sub")

        if username is None:
            raise credentials_exception
        
    except jwt.PyJWTError:
        # Si el token expiró, esta alterado o es invalido, salta aca.
        raise credentials_exception
    
    # Busco al dueño del token en la base de datos.
    usuario = db.query(models.User).filter(models.User.username == username).first()

    if usuario is None:
        raise credentials_exception
    
    # todo ok! Devolvemos el objeto usuario, con todos sus datos.
    return usuario

