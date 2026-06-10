import bcrypt
from datetime import datetime, timedelta, timezone
import jwt
import os
from dotenv import load_dotenv


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

